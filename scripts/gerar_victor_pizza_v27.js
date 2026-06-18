const fs = require('fs');
const crypto = require('crypto');

// v27: abordagem definitiva — Code node monta o HTML antes do Gmail
// O Gmail nao precisa avaliar nenhuma expressao no body: so le $json.emailBody
// Elimina totalmente a incerteza sobre como o n8n avalia {{ }} no campo message
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v23.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v27.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v27 - Code node monta HTML antes do Gmail';
console.log('OK Nome atualizado');

// ── Localiza nodes ────────────────────────────────────────────────────────────
var ifNode = d.nodes.find(function(n) { return n.name === 'tem_email'; });
if (!ifNode) { console.error('ERRO: tem_email nao encontrado'); process.exit(1); }

var gmailNode = d.nodes.find(function(n) { return n.name === 'enviar_email_gmail'; });
if (!gmailNode) { console.error('ERRO: enviar_email_gmail nao encontrado'); process.exit(1); }

console.log('OK Nodes localizados');

// ── Cria Code node que monta o HTML ──────────────────────────────────────────
var codeNode = {
  id: crypto.randomUUID(),
  name: 'montar_email',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [gmailNode.position[0] - 240, gmailNode.position[1]],
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: [
      "const gc = $('garantir_campos').item.json;",
      "const empresa = gc.Empresa || gc.empresa || '';",
      "",
      "const html = `<!DOCTYPE html>",
      "<html>",
      "<body style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;\">",
      "  <div style=\"border-left:4px solid #c0392b;padding-left:16px;margin-bottom:24px;\">",
      "    <h2 style=\"margin:0;color:#c0392b;\">Proposta de parceria</h2>",
      "    <p style=\"margin:4px 0 0;color:#888;font-size:14px;\">Distribuidora de Pizza Victor</p>",
      "  </div>",
      "  <p>Ol&aacute;, equipe da <strong>${empresa}</strong>!</p>",
      "  <p>Meu nome &eacute; Victor e represento uma distribuidora especializada em",
      "  <strong>pizzas congeladas e resfriadas</strong> com atua&ccedil;&atilde;o em SP, PR, RS e SC.</p>",
      "  <p>Gostar&iacute;amos de apresentar nossa linha de produtos e condi&ccedil;&otilde;es",
      "  comerciais exclusivas para redes e supermercados.</p>",
      "  <p><strong>O que oferecemos:</strong></p>",
      "  <ul>",
      "    <li>Pizzas congeladas e resfriadas em m&uacute;ltiplos sabores e tamanhos</li>",
      "    <li>Entregas programadas com pontualidade garantida</li>",
      "    <li>Alta margem de lucro para o ponto de venda</li>",
      "    <li>Condi&ccedil;&otilde;es especiais para redes</li>",
      "  </ul>",
      "  <p>Pode responder este email para agendarmos uma conversa r&aacute;pida.</p>",
      "  <div style=\"margin-top:32px;padding-top:16px;border-top:1px solid #eee;\">",
      "    <p style=\"margin:0;\"><strong>Victor</strong></p>",
      "    <p style=\"margin:4px 0 0;color:#888;font-size:13px;\">Distribuidora de Pizza | SP, PR, RS, SC</p>",
      "  </div>",
      "</body>",
      "</html>`;",
      "",
      "return { json: { ...($node['garantir_campos'] ? $('garantir_campos').item.json : $json), emailBody: html } };"
    ].join('\n')
  }
};
d.nodes.push(codeNode);
console.log('OK Code node montar_email adicionado em', codeNode.position);

// ── Atualiza Gmail: message vem do $json.emailBody (sem expressao no body) ────
gmailNode.parameters.message   = "={{ $json.emailBody }}";
gmailNode.parameters.sendTo    = 'guimaraesclebeclebe@gmail.com'; // email fixo de teste
console.log('OK Gmail atualizado: message={{ $json.emailBody }}');

// ── Reconecta: tem_email TRUE → montar_email → enviar_email_gmail ─────────────
var ifConn = d.connections['tem_email'];
// Salva o que estava no TRUE output (era enviar_email_gmail)
// Agora: TRUE → montar_email → enviar_email_gmail
ifConn.main[0] = [{ node: 'montar_email', type: 'main', index: 0 }];
d.connections['montar_email'] = {
  main: [[{ node: 'enviar_email_gmail', type: 'main', index: 0 }]]
};
console.log('OK Conexoes: tem_email TRUE → montar_email → enviar_email_gmail');

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v27',           json.includes('Victor Pizza v27')],
  ['montar_email node',  json.includes('"montar_email"')],
  ['jsCode com empresa', json.includes('gc.Empresa || gc.empresa')],
  ['emailBody no Gmail', json.includes('$json.emailBody')],
  ['email fixo teste',   json.includes('guimaraesclebeclebe')],
  ['tem_email → montar', json.includes('"montar_email"')],
  ['Gmail node',         json.includes('n8n-nodes-base.gmail')],
  ['processar_leads',    json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
