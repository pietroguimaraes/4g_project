const fs = require('fs');

// v18: corrige o jsonBody do HTTP Request6 para incluir email, cnpj, bairro, endereco, cep
// CAUSA RAIZ: HTTP Request6 tinha jsonBody hardcoded com apenas 8 campos e ignorava garantir_campos
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v17.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v18.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v18 - HTTP Request6 envia email/cnpj/bairro';
console.log('OK Nome atualizado');

// Localiza HTTP Request6
var hr6 = d.nodes.find(function(n) { return n.name === 'HTTP Request6'; });
if (!hr6) {
  console.error('ERRO: HTTP Request6 nao encontrado');
  process.exit(1);
}
console.log('OK HTTP Request6 encontrado');

// Novo jsonBody: le de $json (saida do garantir_campos) e inclui todos os campos necessarios
// $json.Empresa — vem do edit_fields (campo com letra maiuscula do fluxo original)
// $json.email   — adicionado pelo garantir_campos a partir de _email
// $json._cnpj   — direto do processar_leads (garantir_campos copia tudo)
hr6.parameters.jsonBody = [
  '={',
  '  "empresa":          "{{ $json.Empresa || $json.empresa }}",',
  '  "telefone":         "{{ $json.Telefone || $json.telefone }}",',
  '  "email":            "{{ $json.email || $json._email }}",',
  '  "cnpj":             "{{ $json.cnpj || $json._cnpj }}",',
  '  "website":          "{{ $json.Site || $json.website }}",',
  '  "cidade":           "{{ $json.Cidade || $json.cidade || $json.city }}",',
  '  "estado":           "{{ $json.Estado || $json.estado || $json.state }}",',
  '  "pais":             "{{ $json.Pais || $json.pais }}",',
  '  "status":           "{{ $json._status_final }}",',
  '  "tipo_loja":        "{{ $json._tipo_loja }}",',
  '  "search_id":        "{{ $json.search_id }}",',
  '  "_fonte_telefone":  "{{ $json._fonte_telefone }}",',
  '  "bairro":           "{{ $json.bairro }}",',
  '  "endereco":         "{{ $json.endereco || $json.address }}",',
  '  "cep":              "{{ $json.cep }}"',
  '}'
].join('\n');

console.log('OK HTTP Request6 jsonBody atualizado com todos os campos');

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v18',          json.includes('Victor Pizza v18')],
  ['email no body',     json.includes('"email"')],
  ['cnpj no body',      json.includes('"cnpj"')],
  ['bairro no body',    json.includes('"bairro"')],
  ['endereco no body',  json.includes('"endereco"')],
  ['search_id no body', json.includes('"search_id"')],
  ['garantir_campos',   json.includes('"garantir_campos"')],
  ['processar_leads',   json.includes('"processar_leads"')],
  ['api.cnpja.com',     json.includes('api.cnpja.com')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
