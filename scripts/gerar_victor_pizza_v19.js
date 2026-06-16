const fs = require('fs');

// v19: atualiza chave CNPJa + buscar_fones_existentes com alwaysOutputData
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v18.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v19.json';

const CNPJA_KEY_NOVA = '7c765bab-746e-489e-9e05-28bcee9fe13d-21c08566-3a4f-4ef1-aa2a-1c6c64528e46';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v19 - nova chave CNPJa + always output data';
console.log('OK Nome atualizado');

// 1. Atualiza chave CNPJa no buscar_cnpja
var buscarCnpja = d.nodes.find(function(n) { return n.name === 'buscar_cnpja'; });
if (!buscarCnpja) { console.error('ERRO: buscar_cnpja nao encontrado'); process.exit(1); }
var headers = buscarCnpja.parameters.headerParameters.parameters;
for (var i = 0; i < headers.length; i++) {
  if (headers[i].name === 'Authorization') {
    headers[i].value = CNPJA_KEY_NOVA;
    console.log('OK Chave CNPJa atualizada em buscar_cnpja');
  }
}

// 2. buscar_fones_existentes: alwaysOutputData = true
var buscarFones = d.nodes.find(function(n) { return n.name === 'buscar_fones_existentes'; });
if (!buscarFones) { console.error('ERRO: buscar_fones_existentes nao encontrado'); process.exit(1); }
buscarFones.alwaysOutputData = true;
console.log('OK buscar_fones_existentes: alwaysOutputData = true');

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v19',            json.includes('Victor Pizza v19')],
  ['Nova chave CNPJa',    json.includes(CNPJA_KEY_NOVA)],
  ['alwaysOutputData',    json.includes('"alwaysOutputData": true')],
  ['email no body HR6',   json.includes('"email"')],
  ['garantir_campos',     json.includes('"garantir_campos"')],
  ['processar_leads',     json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
