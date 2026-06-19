const fs = require('fs');

// v42: remove sistema de reserva completamente
// Nodes removidos: verificar_reserva, reserva_suficiente, ativar_reserva, patch_reserva_concluida
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v41.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v42.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v42 - sem sistema de reserva';
console.log('OK Nome atualizado');

var RESERVA_NODES = ['verificar_reserva', 'reserva_suficiente', 'ativar_reserva', 'patch_reserva_concluida'];

// Remove nodes
var antes = d.nodes.length;
d.nodes = d.nodes.filter(function(n) { return !RESERVA_NODES.includes(n.name); });
console.log('Nodes removidos:', antes - d.nodes.length, '→', RESERVA_NODES.join(', '));

// Remove conexoes
RESERVA_NODES.forEach(function(name) {
  if (d.connections[name]) {
    delete d.connections[name];
    console.log('OK conexao removida:', name);
  }
});

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v42',                    json.includes('Victor Pizza v42')],
  ['verificar_reserva removido',  !json.includes('"verificar_reserva"')],
  ['reserva_suficiente removido', !json.includes('"reserva_suficiente"')],
  ['ativar_reserva removido',     !json.includes('"ativar_reserva"')],
  ['patch_reserva_concluida rem', !json.includes('"patch_reserva_concluida"')],
  ['dashboard → extrair_params',  d.connections['receber_busca_dashboard'].main[0][0].node === 'extrair_params'],
  ['schedule → extrair_params',   d.connections['parametros_schedule'].main[0][0].node === 'extrair_params'],
  ['schedule_diario',             json.includes('"schedule_diario"')],
  ['Gmail node',                  json.includes('n8n-nodes-base.gmail')],
  ['atualizar_prospectado',       json.includes('atualizar_prospectado')],
  ['chave CNPJa nova',            json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
