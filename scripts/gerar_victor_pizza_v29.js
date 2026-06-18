const fs = require('fs');

// v29: corrige reserva_suficiente — a condicao referenciava receber_busca_dashboard
// que nao executa no caminho do schedule. Usa operador ternario para suportar ambos.
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v28.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v29.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v29 - fix reserva_suficiente para schedule';
console.log('OK Nome atualizado');

// ── Localiza reserva_suficiente ───────────────────────────────────────────────
var reservaSuf = d.nodes.find(function(n) { return n.name === 'reserva_suficiente'; });
if (!reservaSuf) { console.error('ERRO: reserva_suficiente nao encontrado'); process.exit(1); }
console.log('OK reserva_suficiente encontrado');
console.log('Condicoes atuais:', JSON.stringify(reservaSuf.parameters, null, 2));

// ── Corrige a condicao ────────────────────────────────────────────────────────
// ANTES: $('receber_busca_dashboard').first().json.body.quantidade || 20
// DEPOIS: ternario — se webhook executou usa quantidade do webhook,
//         se nao (veio do schedule) usa quantidade do parametros_schedule
var quantidadeExpr = "{{ $('receber_busca_dashboard').isExecuted ? ($('receber_busca_dashboard').first().json.body.quantidade || 20) : ($('parametros_schedule').first().json.quantidade || 10) }}";

// Percorre todas as condicoes e substitui a referencia ao receber_busca_dashboard
function fixConditions(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(fixConditions);
    return;
  }
  Object.keys(obj).forEach(function(key) {
    var val = obj[key];
    if (typeof val === 'string' && val.includes('receber_busca_dashboard')) {
      console.log('  Substituindo:', val.substring(0, 80) + '...');
      obj[key] = quantidadeExpr;
      console.log('  Por:', quantidadeExpr.substring(0, 80) + '...');
    } else {
      fixConditions(val);
    }
  });
}

fixConditions(reservaSuf.parameters);
console.log('OK reserva_suficiente corrigido');

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v29',              json.includes('Victor Pizza v29')],
  ['sem ref hardcoded',     !json.includes("receber_busca_dashboard').first().json.body.quantidade")],
  ['isExecuted ternario',   json.includes('isExecuted')],
  ['parametros_schedule ref',json.includes("parametros_schedule').first().json.quantidade")],
  ['schedule_diario',       json.includes('"schedule_diario"')],
  ['montar_email node',     json.includes('"montar_email"')],
  ['Gmail node',            json.includes('n8n-nodes-base.gmail')],
  ['processar_leads',       json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== INSTRUCOES ===');
console.log('1. Importa Fluxo_victor_pizza_v29.json no n8n');
console.log('2. Confirma credencial Gmail');
console.log('3. Ativa o workflow');
console.log('4. Testa o schedule: clica em schedule_diario → Test step');
console.log('5. O fluxo deve rodar completo sem erro em reserva_suficiente');
