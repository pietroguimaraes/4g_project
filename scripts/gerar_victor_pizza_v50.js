const fs = require('fs');

// v50: corrige preparar_busca_linkedin
// Problema: modo "runOnceForEachItem" + return array → n8n rejeita
// Fix: muda para "runOnceForAllItems" + usa $input.first().json

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v49.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v50.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v50 - fix preparar_busca_linkedin mode';
console.log('OK Nome atualizado');

// ── Corrige preparar_busca_linkedin ──────────────────────────────────────────
var node = d.nodes.find(function(n) { return n.name === 'preparar_busca_linkedin'; });
if (!node) { console.error('ERRO: preparar_busca_linkedin nao encontrado'); process.exit(1); }

// 1. Muda mode
node.parameters.mode = 'runOnceForAllItems';
console.log('OK mode: runOnceForEachItem → runOnceForAllItems');

// 2. Troca $input.item.json por $input.first().json no jsCode
var OLD = 'var ep = $input.item.json;';
var NEW = 'var ep = $input.first().json;';
if (!node.parameters.jsCode.includes(OLD)) {
  console.error('ERRO: trecho esperado nao encontrado no jsCode');
  process.exit(1);
}
node.parameters.jsCode = node.parameters.jsCode.replace(OLD, NEW);
console.log('OK jsCode: $input.item.json → $input.first().json');

// ── Valida sintaxe ────────────────────────────────────────────────────────────
try {
  new Function('return async function() { ' + node.parameters.jsCode + ' }');
  console.log('OK Sintaxe jsCode valida');
} catch(e) {
  console.error('ERRO SINTAXE:', e.message);
  process.exit(1);
}

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao ───────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v50',                        json.includes('Victor Pizza v50')],
  ['mode runOnceForAllItems',         node.parameters.mode === 'runOnceForAllItems'],
  ['usa $input.first()',              node.parameters.jsCode.includes('$input.first().json')],
  ['nao usa $input.item',            !node.parameters.jsCode.includes('$input.item.json')],
  ['x-api-key mantido',              json.includes('x-api-key')],
  ['schedule_diario mantido',         json.includes('"schedule_diario"')],
  ['Gmail node mantido',              json.includes('n8n-nodes-base.gmail')],
  ['Actor1 harvestapi search',        json.includes('harvestapi/linkedin-profile-search')],
  ['Actor2 harvestapi scraper',       json.includes('harvestapi/linkedin-profile-scraper')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
