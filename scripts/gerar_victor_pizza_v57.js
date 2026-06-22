const fs = require('fs');

// v57: adiciona filtro de setor no searchQuery do LinkedIn
// Antes: "Comprador OR 'Gerente de Compras'" → pega compradores de qualquer empresa (banco, etc.)
// Agora: inclui palavras do setor → só compradores de supermercado/atacado/varejo

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v56.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v57.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v57 - LinkedIn filtra por setor correto';

var node = d.nodes.find(function(n) { return n.name === 'preparar_busca_linkedin'; });
if (!node) { console.error('ERRO: preparar_busca_linkedin nao encontrado'); process.exit(1); }

// Passo 1: injeta SETOR_MAP antes do return (fora do objeto literal)
var OLD1 = "var localizacao = cidadeBase + ', Brazil';";
var NEW1 = [
  "var localizacao = cidadeBase + ', Brazil';",
  "var SETOR_MAP = {",
  "  'SUPERMERCADO':  'supermercado OR atacado OR varejo OR hipermercado OR \"distribuidor alimentos\"',",
  "  'ATACADISTA':    'atacadista OR atacado OR distribuidor',",
  "  'DISTRIBUIDORA': 'distribuidora OR distribuidor OR atacado'",
  "};",
  "var setor = SETOR_MAP[tipo_loja] || SETOR_MAP['SUPERMERCADO'];"
].join('\n');

if (!node.parameters.jsCode.includes(OLD1)) {
  console.error('ERRO: localizacao nao encontrada'); process.exit(1);
}
node.parameters.jsCode = node.parameters.jsCode.replace(OLD1, NEW1);

// Passo 2: atualiza searchQuery para usar a variavel setor
var OLD2 = "searchQuery:       cargos[0] + ' OR \"' + cargos[1] + '\"',";
var NEW2 = "searchQuery:       cargos[0] + ' OR \"' + cargos[1] + '\" ' + setor,";

if (!node.parameters.jsCode.includes(OLD2)) {
  console.error('ERRO: searchQuery nao encontrada'); process.exit(1);
}
node.parameters.jsCode = node.parameters.jsCode.replace(OLD2, NEW2);
console.log('OK searchQuery agora inclui filtro de setor (supermercado/atacado/varejo)');

// Valida sintaxe
try {
  new Function('return async function() { ' + node.parameters.jsCode + ' }');
  console.log('OK Sintaxe valida');
} catch(e) {
  console.error('ERRO SINTAXE:', e.message); process.exit(1);
}

fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v57',              json.includes('Victor Pizza v57')],
  ['setor no searchQuery',  node.parameters.jsCode.includes('SETOR_MAP')],
  ['supermercado no setor', node.parameters.jsCode.includes('supermercado')],
  ['Gmail mantido',         json.includes('n8n-nodes-base.gmail')],
  ['schedule mantido',      json.includes('"schedule_diario"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
