const fs = require('fs');

// v26: corrige o body do email — formato correto e ={{ expressao }}
// v25 usava = sem {{ }} por isso o n8n tratava como texto puro
// sendTo e subject ja usavam ={{ }} e funcionavam — body agora segue o mesmo padrao
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v23.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v26.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v26 - fix body email (={{ }} correto)';
console.log('OK Nome atualizado');

var gmailNode = d.nodes.find(function(n) { return n.name === 'enviar_email_gmail'; });
if (!gmailNode) { console.error('ERRO: enviar_email_gmail nao encontrado'); process.exit(1); }
console.log('OK enviar_email_gmail encontrado');

// Expressao para o nome da empresa (mesma que funciona no subject)
var empresa = "$('garantir_campos').item.json.Empresa || $('garantir_campos').item.json.empresa";

// Formato correto: ={{ 'html...' + (expressao) + '...html' }}
// O = abre, {{ }} delimitam a expressao JavaScript
var body = "={{ "
  + "  '<!DOCTYPE html><html>'"
  + " + '<body style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;\">'"
  + " + '<div style=\"border-left:4px solid #c0392b;padding-left:16px;margin-bottom:24px;\">'"
  + " + '<h2 style=\"margin:0;color:#c0392b;\">Proposta de parceria</h2>'"
  + " + '<p style=\"margin:4px 0 0;color:#888;font-size:14px;\">Distribuidora de Pizza Victor</p>'"
  + " + '</div>'"
  + " + '<p>Ol&aacute;, equipe da <strong>' + (" + empresa + ") + '</strong>!</p>'"
  + " + '<p>Meu nome &eacute; Victor e represento uma distribuidora especializada em <strong>pizzas congeladas e resfriadas</strong> com atua&ccedil;&atilde;o em SP, PR, RS e SC.</p>'"
  + " + '<p>Gostar&iacute;amos de apresentar nossa linha de produtos e condi&ccedil;&otilde;es comerciais exclusivas para redes e supermercados.</p>'"
  + " + '<p><strong>O que oferecemos:</strong></p>'"
  + " + '<ul>'"
  + " + '<li>Pizzas congeladas e resfriadas em m&uacute;ltiplos sabores e tamanhos</li>'"
  + " + '<li>Entregas programadas com pontualidade garantida</li>'"
  + " + '<li>Alta margem de lucro para o ponto de venda</li>'"
  + " + '<li>Condi&ccedil;&otilde;es especiais para redes</li>'"
  + " + '</ul>'"
  + " + '<p>Pode responder este email para agendarmos uma conversa r&aacute;pida.</p>'"
  + " + '<div style=\"margin-top:32px;padding-top:16px;border-top:1px solid #eee;\">'"
  + " + '<p style=\"margin:0;\"><strong>Victor</strong></p>'"
  + " + '<p style=\"margin:4px 0 0;color:#888;font-size:13px;\">Distribuidora de Pizza | SP, PR, RS, SC</p>'"
  + " + '</div>'"
  + " + '</body></html>'"
  + " }}";

gmailNode.parameters.message = body;
console.log('OK Body atualizado com formato ={{ }} correto');

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
var bodyStr = gmailNode.parameters.message;
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v26',           json.includes('Victor Pizza v26')],
  ['email fixo teste',   json.includes('guimaraesclebeclebe')],
  ['garantir_campos',    json.includes('garantir_campos')],
  ['formato ={{ }}',     bodyStr.startsWith('={{ ')],
  ['fecha com }}',       bodyStr.endsWith(' }}')],
  ['tem_email node',     json.includes('"tem_email"')],
  ['Gmail node',         json.includes('n8n-nodes-base.gmail')],
  ['processar_leads',    json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== INSTRUCOES ===');
console.log('1. Importa Fluxo_victor_pizza_v26.json no n8n');
console.log('2. Confirma credencial Gmail em enviar_email_gmail');
console.log('3. Ativa e testa — nome da empresa deve aparecer corretamente');
