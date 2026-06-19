const fs = require('fs');

// v39: fix leads duplicados — PATCH para PROSPECTADOS logo apos tem_email [TRUE]
// Isso garante que leads novos E duplicados ficam como PROSPECTADOS ao receber email
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v38.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v39.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v39 - PATCH prospectados para novos e duplicados';
console.log('OK Nome atualizado');

// ── 1. Adiciona node atualizar_prospectado entre tem_email e montar_email ─────
var montarEmail = d.nodes.find(function(n) { return n.name === 'montar_email'; });

var novoNode = {
  id: 'atualizar-prospectado-v39',
  name: 'atualizar_prospectado',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [montarEmail.position[0] - 220, montarEmail.position[1]],
  parameters: {
    method: 'PATCH',
    url: "={{ 'https://distribuidora-b2b-nu.vercel.app/api/leads/' + ($json.Telefone || $json.telefone) }}",
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={ "status": "PROSPECTADOS" }',
    options: {}
  },
  continueOnFail: true
};

d.nodes.push(novoNode);
console.log('OK node atualizar_prospectado adicionado em', novoNode.position);

// ── 2. Reconecta: tem_email [TRUE] → atualizar_prospectado → montar_email ─────
d.connections['tem_email'] = {
  main: [
    [{ node: 'atualizar_prospectado', type: 'main', index: 0 }],  // TRUE
    [{ node: 'patch_busca_concluida', type: 'main', index: 0 }]   // FALSE
  ]
};

d.connections['atualizar_prospectado'] = {
  main: [[{ node: 'montar_email', type: 'main', index: 0 }]]
};

console.log('OK conexoes:');
console.log('   tem_email [TRUE]  → atualizar_prospectado → montar_email → enviar_email_gmail');
console.log('   tem_email [FALSE] → patch_busca_concluida');

// ── 3. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 4. Verificacao ────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var connTemEmail = d.connections['tem_email'];
var connProsp    = d.connections['atualizar_prospectado'];

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v39',                    json.includes('Victor Pizza v39')],
  ['node atualizar_prospectado',  json.includes('atualizar_prospectado')],
  ['tem_email TRUE → atualizar',  connTemEmail.main[0][0].node === 'atualizar_prospectado'],
  ['atualizar → montar_email',    connProsp.main[0][0].node === 'montar_email'],
  ['status PROSPECTADOS no save', json.includes("PROSPECTADOS' : $json._status_final")],
  ['chave CNPJa nova',            json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
  ['schedule_diario',             json.includes('"schedule_diario"')],
  ['Gmail node',                  json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== LOGICA FINAL (v39) ===');
console.log('Lead novo   + tem email → HTTP Request6 salva PROSPECTADOS + PATCH confirma');
console.log('Lead duplic + tem email → HTTP Request6 skipado + PATCH atualiza para PROSPECTADOS');
console.log('Lead sem email          → HTTP Request6 salva _status_final, nao entra no PATCH');
