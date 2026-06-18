const fs = require('fs');

// v35: fix reserva_suficiente — aplica fix global APENAS em Code nodes (jsCode)
// e corrige reserva_suficiente de volta para expressao simples (so dashboard chega la)
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v31.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v35.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v35 - dashboard + schedule funcionando';
console.log('OK Nome atualizado');

// ── 1. Fix global: APENAS Code nodes (jsCode) ────────────────────────────────
var TARGET      = "$('receber_busca_dashboard').first().json";
var REPLACEMENT = "($('receber_busca_dashboard').isExecuted ? $('receber_busca_dashboard').first().json : $('parametros_schedule').first().json)";

var codeNodesFixados = 0;
d.nodes.forEach(function(node) {
  if (!node.parameters || !node.parameters.jsCode) return;
  if (!node.parameters.jsCode.includes(TARGET)) return;
  node.parameters.jsCode = node.parameters.jsCode.split(TARGET).join(REPLACEMENT);
  codeNodesFixados++;
  console.log('OK jsCode fixado:', node.name);
});
console.log('Total Code nodes fixados:', codeNodesFixados);

// ── 2. Fix reserva_suficiente: expressao simples (so dashboard chega aqui) ───
var reserva = d.nodes.find(function(n) { return n.name === 'reserva_suficiente'; });
if (!reserva) {
  console.error('ERRO: reserva_suficiente nao encontrado');
  process.exit(1);
}

// rightValue: quanto o usuario pediu (so vem do dashboard aqui)
reserva.parameters.conditions.conditions[0].rightValue =
  "={{ $('receber_busca_dashboard').first().json.body.quantidade || 20 }}";

console.log('OK reserva_suficiente corrigido para expressao simples');
console.log('   rightValue:', reserva.parameters.conditions.conditions[0].rightValue);

// ── 3. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 4. Verificacao ────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var isExecutedCount = (json.match(/isExecuted/g) || []).length;
var ternarioNoReserva = reserva.parameters.conditions.conditions[0].rightValue.includes('isExecuted');

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v35',                    json.includes('Victor Pizza v35')],
  ['isExecuted em Code nodes',    isExecutedCount >= codeNodesFixados],
  ['reserva_suficiente SEM ternario', !ternarioNoReserva],
  ['parametros_schedule conectado', json.includes('"parametros_schedule"')],
  ['schedule_diario',             json.includes('"schedule_diario"')],
  ['montar_email node',           json.includes('"montar_email"')],
  ['Gmail node',                  json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\nOcorrencias de isExecuted:', isExecutedCount);
