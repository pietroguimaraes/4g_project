const fs = require('fs');
const crypto = require('crypto');

// v21: email automatico no fluxo principal
// Apos HTTP Request6 salvar o lead:
//   - IF lead tem email E status LOCALIZADOS → envia Gmail
//   - caso contrario → segue fluxo normalmente
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v20.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v21.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v21 - email automatico pos-busca';
console.log('OK Nome atualizado');

// ── Localiza nodes necessarios ─────────────────────────────────────────────────
var garantirCampos = d.nodes.find(function(n) { return n.name === 'garantir_campos'; });
if (!garantirCampos) { console.error('ERRO: garantir_campos nao encontrado'); process.exit(1); }
console.log('OK garantir_campos encontrado em', garantirCampos.position);

var hr6 = d.nodes.find(function(n) { return n.name === 'HTTP Request6'; });
if (!hr6) { console.error('ERRO: HTTP Request6 nao encontrado'); process.exit(1); }
console.log('OK HTTP Request6 encontrado em', hr6.position);

var gmailNode = d.nodes.find(function(n) { return n.name === 'enviar_email_gmail'; });
if (!gmailNode) { console.error('ERRO: enviar_email_gmail nao encontrado'); process.exit(1); }
console.log('OK enviar_email_gmail encontrado');

// ── Descobre o node que vem apos HTTP Request6 ────────────────────────────────
var hr6Conn  = d.connections['HTTP Request6'];
var nextNode = null;
if (hr6Conn && hr6Conn.main && hr6Conn.main[0] && hr6Conn.main[0][0]) {
  nextNode = hr6Conn.main[0][0].node;
}
console.log('OK Node apos HTTP Request6:', nextNode);

// ── Atualiza parametros do Gmail ──────────────────────────────────────────────
// Usa referencias ao node garantir_campos para ter certeza dos dados corretos
gmailNode.parameters.sendTo  = "={{ $('garantir_campos').item.json.email }}";
gmailNode.parameters.subject = "={{ 'Proposta de parceria \u2014 ' + ($('garantir_campos').item.json.Empresa || $('garantir_campos').item.json.empresa) }}";
gmailNode.parameters.message = buildEmailHtml();
gmailNode.position = [hr6.position[0] + 260, hr6.position[1] + 180];
console.log('OK Parametros do Gmail atualizados');

// ── Cria o node IF (tem_email) ────────────────────────────────────────────────
// Condicao: lead tem email E status e LOCALIZADOS (nao envia para reserva)
var ifNode = {
  id: crypto.randomUUID(),
  name: 'tem_email',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [hr6.position[0] + 260, hr6.position[1]],
  parameters: {
    conditions: {
      options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' },
      combinator: 'and',
      conditions: [
        {
          id: crypto.randomUUID(),
          leftValue: "={{ $('garantir_campos').item.json.email }}",
          rightValue: '',
          operator: { type: 'string', operation: 'notEmpty' }
        },
        {
          id: crypto.randomUUID(),
          leftValue: "={{ $('garantir_campos').item.json._status_final }}",
          rightValue: 'LOCALIZADOS',
          operator: { type: 'string', operation: 'equals' }
        }
      ]
    }
  }
};
d.nodes.push(ifNode);
console.log('OK IF node tem_email adicionado');

// ── Reconecta o fluxo ─────────────────────────────────────────────────────────
// HTTP Request6 → tem_email
d.connections['HTTP Request6'] = {
  main: [[{ node: 'tem_email', type: 'main', index: 0 }]]
};
console.log('OK HTTP Request6 → tem_email');

// tem_email TRUE → Gmail | FALSE → proximo node original
var ifConns = [
  [{ node: 'enviar_email_gmail', type: 'main', index: 0 }]  // TRUE
];
if (nextNode) {
  ifConns.push([{ node: nextNode, type: 'main', index: 0 }]); // FALSE
} else {
  ifConns.push([]); // FALSE sem destino
}
d.connections['tem_email'] = { main: ifConns };
console.log('OK tem_email TRUE → Gmail | FALSE →', nextNode);

// Gmail → proximo node (continua o fluxo apos envio)
if (nextNode) {
  d.connections['enviar_email_gmail'] = {
    main: [[{ node: nextNode, type: 'main', index: 0 }]]
  };
  console.log('OK enviar_email_gmail →', nextNode);
}

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao ───────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v21',             json.includes('Victor Pizza v21')],
  ['tem_email node',       json.includes('"tem_email"')],
  ['n8n-nodes-base.if',   json.includes('n8n-nodes-base.if')],
  ['enviar_email_gmail',   json.includes('"enviar_email_gmail"')],
  ['Gmail node',           json.includes('n8n-nodes-base.gmail')],
  ['garantir_campos ref',  json.includes("garantir_campos")],
  ['status LOCALIZADOS',   json.includes('LOCALIZADOS')],
  ['processar_leads',      json.includes('"processar_leads"')],
  ['api.cnpja.com',        json.includes('api.cnpja.com')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== O QUE MUDOU NO V21 ===');
console.log('- Email enviado AUTOMATICAMENTE logo apos salvar o lead');
console.log('- Apenas leads com email E status LOCALIZADOS recebem email');
console.log('- Leads na RESERVA nao recebem email');
console.log('- NAO precisa mais arrastar/aprovar no dashboard');

console.log('\n=== INSTRUCOES POS-IMPORT ===');
console.log('1. Importa Fluxo_victor_pizza_v21.json no n8n');
console.log('2. Clica no node enviar_email_gmail');
console.log('3. Confirma que a credencial Gmail esta selecionada');
console.log('4. Ativa o workflow');
console.log('5. Roda uma busca pelo dashboard → emails saem automaticamente');

// ── Template HTML do email ────────────────────────────────────────────────────
function buildEmailHtml() {
  var empresaExpr = "={{ $('garantir_campos').item.json.Empresa || $('garantir_campos').item.json.empresa }}";
  var L = [];
  L.push('<!DOCTYPE html>');
  L.push('<html>');
  L.push('<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">');
  L.push('  <div style="border-left:4px solid #c0392b;padding-left:16px;margin-bottom:24px;">');
  L.push('    <h2 style="margin:0;color:#c0392b;">Proposta de parceria</h2>');
  L.push('    <p style="margin:4px 0 0;color:#888;font-size:14px;">Distribuidora de Pizza Victor</p>');
  L.push('  </div>');
  L.push('  <p>Ol&aacute;, equipe da <strong>' + empresaExpr + '</strong>!</p>');
  L.push('  <p>Meu nome &eacute; Victor e represento uma distribuidora especializada em');
  L.push('  <strong>pizzas congeladas e resfriadas</strong> com atua&ccedil;&atilde;o em SP, PR, RS e SC.</p>');
  L.push('  <p>Gostar&iacute;amos de apresentar nossa linha de produtos e condi&ccedil;&otilde;es');
  L.push('  comerciais exclusivas para redes e supermercados.</p>');
  L.push('  <p><strong>O que oferecemos:</strong></p>');
  L.push('  <ul>');
  L.push('    <li>Pizzas congeladas e resfriadas em m&uacute;ltiplos sabores e tamanhos</li>');
  L.push('    <li>Entregas programadas com pontualidade garantida</li>');
  L.push('    <li>Alta margem de lucro para o ponto de venda</li>');
  L.push('    <li>Condi&ccedil;&otilde;es especiais para redes</li>');
  L.push('  </ul>');
  L.push('  <p>Pode responder este email para agendarmos uma conversa r&aacute;pida.</p>');
  L.push('  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;">');
  L.push('    <p style="margin:0;"><strong>Victor</strong></p>');
  L.push('    <p style="margin:4px 0 0;color:#888;font-size:13px;">Distribuidora de Pizza | SP, PR, RS, SC</p>');
  L.push('  </div>');
  L.push('</body>');
  L.push('</html>');
  return L.join('\n');
}
