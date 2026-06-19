const fs = require('fs');

// v45: adiciona x-api-key no atualizar_prospectado
// Sem esse header o PATCH retorna 401 silenciosamente (continueOnFail)
// e o lead nunca aparece no Kanban
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v44.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v45.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v45 - fix x-api-key no atualizar_prospectado';
console.log('OK Nome atualizado');

// Pega a chave do HR6 (ja funciona)
var hr6 = d.nodes.find(function(n) { return n.name === 'HTTP Request6'; });
var apiKey = hr6.parameters.headerParameters.parameters[0].value;
console.log('x-api-key (primeiros 30 chars):', apiKey.substring(0, 30) + '...');

// Adiciona header no atualizar_prospectado
var ap = d.nodes.find(function(n) { return n.name === 'atualizar_prospectado'; });
ap.parameters.sendHeaders = true;
ap.parameters.headerParameters = {
  parameters: [{ name: 'x-api-key', value: apiKey }]
};

console.log('OK x-api-key adicionado ao atualizar_prospectado');

fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v45',                      json.includes('Victor Pizza v45')],
  ['atualizar_prospectado tem key', ap.parameters.sendHeaders === true],
  ['key igual ao HR6',              ap.parameters.headerParameters.parameters[0].value === apiKey],
  ['url usa garantir_campos',       ap.parameters.url.includes('garantir_campos')],
  ['chave CNPJa nova',              json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
  ['dashboard → extrair_params',    d.connections['receber_busca_dashboard'].main[0][0].node === 'extrair_params'],
  ['schedule_diario',               json.includes('"schedule_diario"')],
  ['Gmail node',                    json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
