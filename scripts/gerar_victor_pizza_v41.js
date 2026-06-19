const fs = require('fs');

// v41: fix URLs de marcar_busca_erro e patch_busca_concluida
// Ambos tinham $('receber_busca_dashboard').first().json.body.search_id hardcoded
// Precisam do ternario isExecuted para funcionar no caminho do schedule tambem
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v40.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v41.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v41 - fix URLs patch nodes para schedule';
console.log('OK Nome atualizado');

var URL_ANTIGA = "https://distribuidora-b2b-nu.vercel.app/api/searches/' + $('receber_busca_dashboard').first().json.body.search_id }}";
var URL_NOVA   = "https://distribuidora-b2b-nu.vercel.app/api/searches/' + ($('receber_busca_dashboard').isExecuted ? $('receber_busca_dashboard').first().json.body.search_id : $('parametros_schedule').first().json.search_id) }}";

var corrigidos = 0;
['marcar_busca_erro', 'patch_busca_concluida', 'patch_reserva_concluida'].forEach(function(name) {
  var node = d.nodes.find(function(n) { return n.name === name; });
  if (!node) return;
  if (node.parameters.url && node.parameters.url.includes("$('receber_busca_dashboard').first().json.body.search_id")) {
    node.parameters.url = node.parameters.url.replace(
      "$('receber_busca_dashboard').first().json.body.search_id",
      "($('receber_busca_dashboard').isExecuted ? $('receber_busca_dashboard').first().json.body.search_id : $('parametros_schedule').first().json.search_id)"
    );
    corrigidos++;
    console.log('OK URL fixada:', name);
    console.log('   ', node.parameters.url);
  }
});

console.log('Total corrigidos:', corrigidos);

fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v41',                      json.includes('Victor Pizza v41')],
  ['marcar_busca_erro URL fixada',  json.includes('"marcar_busca_erro"') && !json.includes("marcar_busca_erro.*receber_busca_dashboard.*first.*json.*body.*search_id")],
  ['isExecuted nos URLs',           (json.match(/search_id.*isExecuted|isExecuted.*search_id/g) || []).length >= 2],
  ['chave CNPJa nova',              json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
  ['dashboard → extrair_params',    d.connections['receber_busca_dashboard'].main[0][0].node === 'extrair_params'],
  ['schedule_diario',               json.includes('"schedule_diario"')],
  ['atualizar_prospectado',         json.includes('atualizar_prospectado')],
  ['Gmail node',                    json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
