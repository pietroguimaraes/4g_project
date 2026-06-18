const fs = require('fs');

// v34: corrige bug do v33 — TARGET usava \\ errado
// No JSON serializado, aspas simples NAO sao escapadas → usar TARGET sem backslashes
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v31.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v34.json';

var raw = fs.readFileSync(INPUT, 'utf8');
var d = JSON.parse(raw);
d.name = 'Fluxo Victor Pizza v34 - schedule funcionando (fix global correto)';

var jsonStr = JSON.stringify(d);

// Conta referencias antes
var antes = (jsonStr.match(/\$\('receber_busca_dashboard'\)\.first\(\)\.json/g) || []).length;
console.log('Referencias antes:', antes);

// TARGET correto: aspas simples aparecem literalmente no JSON (nao precisam escape)
var TARGET      = "$('receber_busca_dashboard').first().json";
var REPLACEMENT = "($('receber_busca_dashboard').isExecuted ? $('receber_busca_dashboard').first().json : $('parametros_schedule').first().json)";

var jsonFixed = jsonStr.split(TARGET).join(REPLACEMENT);

// Conta depois
var depois = (jsonFixed.match(/\$\('receber_busca_dashboard'\)\.first\(\)\.json/g) || []).length;
var withIsExecuted = (jsonFixed.match(/isExecuted/g) || []).length;

console.log('Referencias diretas depois (deveria ser 0):', depois);
console.log('Ocorrencias de isExecuted (deveria ser', antes, '):', withIsExecuted);

var dFixed = JSON.parse(jsonFixed);
dFixed.name = 'Fluxo Victor Pizza v34 - schedule funcionando (fix global correto)';

fs.writeFileSync(OUTPUT, JSON.stringify(dFixed, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

var jsonFinal = JSON.stringify(dFixed);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v34',             jsonFinal.includes('Victor Pizza v34')],
  ['isExecuted presente',  jsonFinal.includes('isExecuted')],
  ['parametros_schedule',  jsonFinal.includes('parametros_schedule')],
  ['schedule_diario',      jsonFinal.includes('"schedule_diario"')],
  ['montar_email node',    jsonFinal.includes('"montar_email"')],
  ['Gmail node',           jsonFinal.includes('n8n-nodes-base.gmail')],
  ['processar_leads',      jsonFinal.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
