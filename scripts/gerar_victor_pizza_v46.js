const fs = require('fs');

// v46: limita saída do processar_leads a quantidade_pedida
// Buffer interno (* 3) continua para filtrar blacklist/phones inválidos,
// mas o return final faz .slice(0, quantidade_pedida)
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v45.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v46.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v46 - limitar saida processar_leads a quantidade_pedida';
console.log('OK Nome atualizado');

var pl = d.nodes.find(function(n) { return n.name === 'processar_leads'; });
if (!pl) { console.error('ERRO: processar_leads nao encontrado'); process.exit(1); }

var OLD_RETURN = 'return resultado.map(function(item) { return { json: item }; });';
var NEW_RETURN = 'return resultado.slice(0, quantidade_pedida).map(function(item) { return { json: item }; });';

if (!pl.parameters.jsCode.includes(OLD_RETURN)) {
  console.error('ERRO: trecho esperado nao encontrado no processar_leads');
  console.error('Ultimo 200 chars do jsCode:', pl.parameters.jsCode.slice(-200));
  process.exit(1);
}

pl.parameters.jsCode = pl.parameters.jsCode.replace(OLD_RETURN, NEW_RETURN);
console.log('OK processar_leads: return limitado a quantidade_pedida');

fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v46',                   json.includes('Victor Pizza v46')],
  ['slice quantidade_pedida',    pl.parameters.jsCode.includes('slice(0, quantidade_pedida)')],
  ['buffer * 3 mantido',         pl.parameters.jsCode.includes('quantidade_pedida * 3')],
  ['x-api-key atualizar',        json.includes('x-api-key')],
  ['chave CNPJa nova',           json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
  ['dashboard → extrair_params', d.connections['receber_busca_dashboard'].main[0][0].node === 'extrair_params'],
  ['schedule_diario',            json.includes('"schedule_diario"')],
  ['Gmail node',                 json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
