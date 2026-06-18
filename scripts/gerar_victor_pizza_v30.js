const fs = require('fs');

// v30: schedule pula a reserva completamente
// Para Victor nao faz sentido ter reserva — sem aprovacao manual, todos os leads
// sao processados e o email vai direto. Reserva era para o humano decidir.
// Schedule vai direto de parametros_schedule para definir_termos (Apify).
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v29.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v30.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v30 - schedule sem reserva';
console.log('OK Nome atualizado');

// ── Descobre qual node vem depois da reserva (caminho FALSE do reserva_suficiente)
// Esse e o node que inicia a busca real (definir_termos ou equivalente)
var reservaSuf = d.nodes.find(function(n) { return n.name === 'reserva_suficiente'; });
if (!reservaSuf) { console.error('ERRO: reserva_suficiente nao encontrado'); process.exit(1); }

var reservaSufConn = d.connections['reserva_suficiente'];
var nodePosBuscaReal = null;

// O FALSE output do reserva_suficiente (index 1) aponta para o inicio da busca real
if (reservaSufConn && reservaSufConn.main && reservaSufConn.main[1] && reservaSufConn.main[1][0]) {
  nodePosBuscaReal = reservaSufConn.main[1][0].node;
  console.log('OK No FALSE do reserva_suficiente vai para:', nodePosBuscaReal);
} else {
  // Fallback: tenta encontrar definir_termos diretamente
  var definirTermos = d.nodes.find(function(n) { return n.name === 'definir_termos'; });
  if (definirTermos) {
    nodePosBuscaReal = 'definir_termos';
    console.log('OK Encontrado definir_termos diretamente');
  }
}

if (!nodePosBuscaReal) {
  console.error('ERRO: nao foi possivel determinar o node de inicio da busca real');
  process.exit(1);
}

// ── Reconecta: parametros_schedule → nodePosBuscaReal (pula reserva) ──────────
d.connections['parametros_schedule'] = {
  main: [[{ node: nodePosBuscaReal, type: 'main', index: 0 }]]
};
console.log('OK parametros_schedule →', nodePosBuscaReal, '(reserva ignorada)');

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
var paramConn = d.connections['parametros_schedule'];
var destino = paramConn && paramConn.main && paramConn.main[0] && paramConn.main[0][0]
  ? paramConn.main[0][0].node : 'N/A';

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v30',              json.includes('Victor Pizza v30')],
  ['schedule_diario',       json.includes('"schedule_diario"')],
  ['parametros_schedule',   json.includes('"parametros_schedule"')],
  ['destino correto',       destino === nodePosBuscaReal],
  ['montar_email node',     json.includes('"montar_email"')],
  ['Gmail node',            json.includes('n8n-nodes-base.gmail')],
  ['processar_leads',       json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== FLUXO DO SCHEDULE (v30) ===');
console.log('schedule_diario → parametros_schedule → ' + nodePosBuscaReal + ' → Apify → CNPJa → email');
console.log('Reserva: IGNORADA (nao faz sentido sem aprovacao manual)');
console.log('');
console.log('=== FLUXO DO DASHBOARD (inalterado) ===');
console.log('receber_busca_dashboard → verificar_reserva → reserva_suficiente → ...');
console.log('(dashboard ainda pode usar reserva se quiser)');
