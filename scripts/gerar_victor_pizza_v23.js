const fs = require('fs');

// v23: guarda de teste — sendTo fixo para o email de teste
// Para producao: rodar gerar_victor_pizza_v24.js que remove o hardcode
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v22.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v23.json';

var TEST_EMAIL = 'guimaraesclebeclebe@gmail.com';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v23 - guarda de teste (email fixo)';
console.log('OK Nome atualizado');

// Localiza Gmail node
var gmailNode = d.nodes.find(function(n) { return n.name === 'enviar_email_gmail'; });
if (!gmailNode) { console.error('ERRO: enviar_email_gmail nao encontrado'); process.exit(1); }
console.log('OK enviar_email_gmail encontrado');

// Substitui o destinatario por um email fixo de teste
// Todos os emails vao para TEST_EMAIL independente do lead
gmailNode.parameters.sendTo = TEST_EMAIL;
console.log('OK sendTo fixado em:', TEST_EMAIL);

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v23',          json.includes('Victor Pizza v23')],
  ['email de teste',    json.includes(TEST_EMAIL)],
  ['tem_email node',    json.includes('"tem_email"')],
  ['Gmail node',        json.includes('n8n-nodes-base.gmail')],
  ['processar_leads',   json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== COMO FUNCIONA ===');
console.log('MODO TESTE (agora): todos os emails vao para ' + TEST_EMAIL);
console.log('MODO PRODUCAO: rodar gerar_victor_pizza_v24.js para usar email real dos leads');
