const fs = require('fs');

// v22: corrige sintaxe de expressao no body do email
// Dentro do HTML, usar {{ expr }} sem o = inicial
// O = so vai no campo inteiro quando ele e uma expressao pura
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v21.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v22.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v22 - fix expressao no body do email';
console.log('OK Nome atualizado');

// Localiza Gmail node
var gmailNode = d.nodes.find(function(n) { return n.name === 'enviar_email_gmail'; });
if (!gmailNode) { console.error('ERRO: enviar_email_gmail nao encontrado'); process.exit(1); }
console.log('OK enviar_email_gmail encontrado');

// Corrige o body do email
// Dentro do HTML: usar {{ expr }} (sem =) para expressoes inline
gmailNode.parameters.message = buildEmailHtml();
console.log('OK Body do email corrigido (expressoes inline sem =)');

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v22',           json.includes('Victor Pizza v22')],
  ['tem_email node',     json.includes('"tem_email"')],
  ['Gmail node',         json.includes('n8n-nodes-base.gmail')],
  ['garantir_campos ref',json.includes('garantir_campos')],
  ['sem = no body',      !json.includes('={ { $')],
  ['processar_leads',    json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== INSTRUCOES ===');
console.log('1. Importa Fluxo_victor_pizza_v22.json no n8n');
console.log('2. Verifica credencial Gmail em enviar_email_gmail');
console.log('3. Ativa o workflow');
console.log('4. Roda nova busca — email vai mostrar o nome da empresa corretamente');

// ── Template HTML corrigido ───────────────────────────────────────────────────
// REGRA N8N: dentro de uma string HTML, expressoes inline usam {{ sem = }}
// O = so vai no inicio quando o campo inteiro e uma expressao
function buildEmailHtml() {
  var empresa = "{{ $('garantir_campos').item.json.Empresa || $('garantir_campos').item.json.empresa }}";
  var L = [];
  L.push('<!DOCTYPE html>');
  L.push('<html>');
  L.push('<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">');
  L.push('  <div style="border-left:4px solid #c0392b;padding-left:16px;margin-bottom:24px;">');
  L.push('    <h2 style="margin:0;color:#c0392b;">Proposta de parceria</h2>');
  L.push('    <p style="margin:4px 0 0;color:#888;font-size:14px;">Distribuidora de Pizza Victor</p>');
  L.push('  </div>');
  L.push('  <p>Ol&aacute;, equipe da <strong>' + empresa + '</strong>!</p>');
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
