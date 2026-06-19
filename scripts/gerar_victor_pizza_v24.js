const fs = require('fs');

// v24: PRODUCAO — remove o email fixo de teste, usa email real do lead
// Baseado no v34 (fix global schedule + montar_email + Gmail)
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v44.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v24.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v24 - producao (email real dos leads)';
console.log('OK Nome atualizado');

// Localiza Gmail node
var gmailNode = d.nodes.find(function(n) { return n.name === 'enviar_email_gmail'; });
if (!gmailNode) { console.error('ERRO: enviar_email_gmail nao encontrado'); process.exit(1); }
console.log('OK enviar_email_gmail encontrado');

// Restaura o email real do lead como destinatario
gmailNode.parameters.sendTo = "={{ $json.email }}";
console.log('OK sendTo restaurado para email real do lead');

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v24',           json.includes('Victor Pizza v24')],
  ['email real do lead', json.includes('$json.email')],
  ['sem email fixo',     !json.includes('guimaraesclebeclebe')],
  ['isExecuted fixado',  json.includes('isExecuted')],
  ['schedule_diario',    json.includes('"schedule_diario"')],
  ['montar_email node',  json.includes('"montar_email"')],
  ['Gmail node',         json.includes('n8n-nodes-base.gmail')],
  ['processar_leads',    json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== ATENCAO ===');
console.log('Este e o workflow de PRODUCAO.');
console.log('Emails vao para os clientes reais — so importar quando Victor fechar contrato.');
