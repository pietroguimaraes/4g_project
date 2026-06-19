const fs = require('fs');

// v38: atualiza chave CNPJa
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v37.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v38.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v38 - chave CNPJa atualizada';

var node = d.nodes.find(function(n) { return n.name === 'buscar_cnpja'; });
if (!node) { console.error('ERRO: buscar_cnpja nao encontrado'); process.exit(1); }

var chaveAntiga = node.parameters.headerParameters.parameters[0].value;
node.parameters.headerParameters.parameters[0].value = '5b365975-c026-40c1-9ae1-7a322abf73a3-aa3ece28-012e-406d-beea-ed7cf21629b0';

console.log('Chave antiga:', chaveAntiga);
console.log('Chave nova:  ', node.parameters.headerParameters.parameters[0].value);

fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('OK Arquivo salvo: ' + OUTPUT);

var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO ===');
[
  ['Nome v38',       json.includes('Victor Pizza v38')],
  ['Chave nova',     json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
  ['Chave antiga removida', !json.includes('7c765bab-746e-489e-9e05-28bcee9fe13d')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
