const fs = require('fs');

// v40: dashboard pula reserva — vai direto para extrair_params igual ao schedule
// Resolve: ativar_reserva mudava leads para LOCALIZADOS, apareciam no painel de aprovacao
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v39.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v40.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v40 - dashboard e schedule ambos pulam reserva';
console.log('OK Nome atualizado');

// Antes: receber_busca_dashboard → verificar_reserva → reserva_suficiente → ...
// Depois: receber_busca_dashboard → extrair_params (igual ao schedule)
d.connections['receber_busca_dashboard'] = {
  main: [[{ node: 'extrair_params', type: 'main', index: 0 }]]
};

console.log('OK receber_busca_dashboard → extrair_params (reserva ignorada)');

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
var conn = d.connections['receber_busca_dashboard'];

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v40',                     json.includes('Victor Pizza v40')],
  ['dashboard → extrair_params',   conn.main[0][0].node === 'extrair_params'],
  ['schedule → extrair_params',    d.connections['parametros_schedule'].main[0][0].node === 'extrair_params'],
  ['sem verificar_reserva no path', conn.main[0][0].node !== 'verificar_reserva'],
  ['isExecuted fixado',            json.includes('isExecuted')],
  ['chave CNPJa nova',             json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
  ['schedule_diario',              json.includes('"schedule_diario"')],
  ['montar_email node',            json.includes('"montar_email"')],
  ['Gmail node',                   json.includes('n8n-nodes-base.gmail')],
  ['atualizar_prospectado',        json.includes('atualizar_prospectado')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== FLUXO FINAL (v40) ===');
console.log('[Dashboard] receber_busca_dashboard → extrair_params → Apify/CNPJa → email → PROSPECTADOS');
console.log('[Schedule]  schedule_diario → parametros_schedule → extrair_params → Apify/CNPJa → email → PROSPECTADOS');
console.log('Reserva: IGNORADA nos dois caminhos');
