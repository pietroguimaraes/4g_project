const fs = require('fs');
const crypto = require('crypto');

// v17: adiciona node garantir_campos entre edit_fields e HTTP Request6
// Garante que _email → email, _cnpj → cnpj, address → endereco cheguem na API
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v16.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v17.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v17 - garantir email/cnpj antes de salvar';
console.log('OK Nome atualizado');

// Localiza edit_fields
var editFieldsNode = d.nodes.find(function(n) {
  return n.name === 'edit_fields' || n.name === 'Edit Fields';
});
if (!editFieldsNode) {
  console.error('ERRO: edit_fields nao encontrado');
  process.exit(1);
}
console.log('OK edit_fields encontrado: ' + editFieldsNode.name);

// Descobre qual node vem depois de edit_fields
var efName = editFieldsNode.name;
var connDepois = null;
if (d.connections[efName] && d.connections[efName].main && d.connections[efName].main[0] && d.connections[efName].main[0][0]) {
  connDepois = d.connections[efName].main[0][0].node;
}
if (!connDepois) {
  console.error('ERRO: nao foi possivel determinar o proximo node apos edit_fields');
  process.exit(1);
}
console.log('OK Proximo apos edit_fields: ' + connDepois);

// Posicao do novo node
var pos = Array.isArray(editFieldsNode.position) ? editFieldsNode.position : [800, 300];

// Cria node garantir_campos
var nodeGarantir = {
  id: crypto.randomUUID(),
  name: 'garantir_campos',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [pos[0] + 220, pos[1]],
  parameters: {
    mode: 'runOnceForAllItems',
    jsCode: buildGarantirCampos()
  }
};
d.nodes.push(nodeGarantir);
console.log('OK garantir_campos adicionado');

// Reconecta: edit_fields -> garantir_campos -> [proximo]
d.connections[efName] = { main: [[{ node: 'garantir_campos', type: 'main', index: 0 }]] };
d.connections['garantir_campos'] = { main: [[{ node: connDepois, type: 'main', index: 0 }]] };
console.log('OK Cadeia: edit_fields -> garantir_campos -> ' + connDepois);

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao final
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v17',          json.includes('Victor Pizza v17')],
  ['garantir_campos',   json.includes('"garantir_campos"')],
  ['_email mapeado',    json.includes('_email')],
  ['_cnpj mapeado',    json.includes('_cnpj')],
  ['processar_leads',  json.includes('"processar_leads"')],
  ['buscar_cnpja',     json.includes('"buscar_cnpja"')],
  ['api.cnpja.com',    json.includes('api.cnpja.com')],
  ['emails.ex=true',   json.includes('emails.ex=true')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

// Codigo do node garantir_campos
function buildGarantirCampos() {
  var L = [];
  L.push('// Garante que campos vindos de processar_leads com prefixo _ chegam corretos ao HTTP Request');
  L.push('// Resolve o caso onde edit_fields nao mapeia _email/_cnpj para email/cnpj');
  L.push('return $input.all().map(function(item) {');
  L.push('  var j = item.json;');
  L.push('  var out = {};');
  L.push('  Object.keys(j).forEach(function(k) { out[k] = j[k]; });');
  L.push('');
  L.push('  // email: usa _email se email ausente ou vazio');
  L.push('  if (!out.email && j._email) out.email = j._email;');
  L.push('');
  L.push('  // cnpj: usa _cnpj se cnpj ausente');
  L.push('  if (!out.cnpj && j._cnpj) out.cnpj = j._cnpj;');
  L.push('');
  L.push('  // endereco: usa address se endereco ausente');
  L.push('  if (!out.endereco && j.address) out.endereco = j.address;');
  L.push('');
  L.push('  return { json: out };');
  L.push('});');
  return L.join('\n');
}
