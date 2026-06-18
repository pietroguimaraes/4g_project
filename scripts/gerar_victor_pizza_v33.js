const fs = require('fs');

// v33: substituicao GLOBAL — toda ocorrencia de $('receber_busca_dashboard').first().json
// vira o ternario com isExecuted. Resolve de uma vez todos os Code nodes.
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v31.json'; // volta ao v31 limpo
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v33.json';

var raw = fs.readFileSync(INPUT, 'utf8');
var d = JSON.parse(raw);
d.name = 'Fluxo Victor Pizza v33 - schedule funcionando (fix global)';
console.log('OK Nome atualizado');

// Serializa, faz a substituicao no texto, deserializa
// Isso garante que TODOS os nodes sao corrigidos sem logica de parsing
var jsonStr = JSON.stringify(d);

// Conta referencias antes
var antes = (jsonStr.match(/\$\('receber_busca_dashboard'\)\.first\(\)\.json/g) || []).length;
console.log('Referencias antes:', antes);

// Substituicao global: toda ocorrencia de $('receber_busca_dashboard').first().json
// vira o ternario isExecuted
var BUSCA = "$('receber_busca_dashboard').first().json";
var SUBST  = "($('receber_busca_dashboard').isExecuted ? $('receber_busca_dashboard').first().json : $('parametros_schedule').first().json)";

// No JSON serializado, aspas sao escapadas como \"
// Precisamos escapar a string de busca para o formato JSON
var BUSCA_JSON = BUSCA.replace(/'/g, "\\'").replace(/\(/g, "\\\\(").replace(/\)/g, "\\\\)");
// Usa replace com regex no texto JSON (aspas escapadas)
var BUSCA_ESCAPED  = "$(\\'receber_busca_dashboard\\').first().json";
var SUBST_ESCAPED  = "($(\\'receber_busca_dashboard\\').isExecuted ? $(\\'receber_busca_dashboard\\').first().json : $(\\'parametros_schedule\\').first().json)";

// Na verdade, no JSON.stringify o codigo JS e armazenado como string com escapes
// A sequencia '$('receber_busca_dashboard').first().json' no JSON fica como:
// "$(\\'receber_busca_dashboard\\').first().json" ou similar
// Mais simples: usar split/join no texto JSON serializado

var TARGET = "$(\\'receber_busca_dashboard\\').first().json";
var REPLACEMENT = "($(\\'receber_busca_dashboard\\').isExecuted ? $(\\'receber_busca_dashboard\\').first().json : $(\\'parametros_schedule\\').first().json)";

var jsonFixed = jsonStr.split(TARGET).join(REPLACEMENT);

// Conta referencias depois (target nao deve mais existir sem o isExecuted)
var depois = (jsonFixed.match(/\$\(\\'receber_busca_dashboard\\'\)\.first\(\)\.json/g) || []).length;
var withIsExecuted = (jsonFixed.match(/isExecuted/g) || []).length;

console.log('Referencias depois (dentro de ternarios - OK):', depois);
console.log('Ocorrencias de isExecuted:', withIsExecuted);

var dFixed = JSON.parse(jsonFixed);
dFixed.name = 'Fluxo Victor Pizza v33 - schedule funcionando (fix global)';

fs.writeFileSync(OUTPUT, JSON.stringify(dFixed, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var jsonFinal = JSON.stringify(dFixed);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v33',             jsonFinal.includes('Victor Pizza v33')],
  ['isExecuted presente',  jsonFinal.includes('isExecuted')],
  ['parametros_schedule',  jsonFinal.includes('parametros_schedule')],
  ['schedule_diario',      jsonFinal.includes('"schedule_diario"')],
  ['montar_email node',    jsonFinal.includes('"montar_email"')],
  ['Gmail node',           jsonFinal.includes('n8n-nodes-base.gmail')],
  ['processar_leads',      jsonFinal.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
