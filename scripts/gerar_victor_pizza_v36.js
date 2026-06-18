const fs = require('fs');

// v36: apos enviar email, atualiza lead para PROSPECTADOS automaticamente
// Nao precisa mais de aprovacao manual no painel
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v35.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v36.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v36 - prospectados automatico apos email';
console.log('OK Nome atualizado');

// ── 1. Adiciona node atualizar_prospectado ────────────────────────────────────
// Fica entre enviar_email_gmail e patch_busca_concluida
var emailNode = d.nodes.find(function(n) { return n.name === 'enviar_email_gmail'; });
var novoNode = {
  id: 'atualizar-prospectado-v36',
  name: 'atualizar_prospectado',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [emailNode.position[0] + 220, emailNode.position[1]],
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

// ── 2. Reconecta: enviar_email_gmail → atualizar_prospectado ─────────────────
// Antes: enviar_email_gmail → patch_busca_concluida
// Depois: enviar_email_gmail → atualizar_prospectado → patch_busca_concluida
d.connections['enviar_email_gmail'] = {
  main: [[{ node: 'atualizar_prospectado', type: 'main', index: 0 }]]
};

d.connections['atualizar_prospectado'] = {
  main: [[{ node: 'patch_busca_concluida', type: 'main', index: 0 }]]
};

console.log('OK conexoes atualizadas:');
console.log('   enviar_email_gmail → atualizar_prospectado → patch_busca_concluida');

// ── 3. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 4. Verificacao ────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var connEmail = d.connections['enviar_email_gmail'];
var connProsp = d.connections['atualizar_prospectado'];

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v36',                  json.includes('Victor Pizza v36')],
  ['node atualizar_prospectado', json.includes('atualizar_prospectado')],
  ['email → atualizar_prosp',   connEmail && connEmail.main[0][0].node === 'atualizar_prospectado'],
  ['atualizar_prosp → patch',   connProsp && connProsp.main[0][0].node === 'patch_busca_concluida'],
  ['status PROSPECTADOS',       json.includes('PROSPECTADOS')],
  ['schedule_diario',           json.includes('"schedule_diario"')],
  ['montar_email node',         json.includes('"montar_email"')],
  ['Gmail node',                json.includes('n8n-nodes-base.gmail')],
  ['isExecuted fixado',         json.includes('isExecuted')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== FLUXO DO EMAIL (v36) ===');
console.log('HTTP Request6 (salva LOCALIZADOS)');
console.log('  → edit_fields');
console.log('  → tem_email');
console.log('    [TRUE]  → montar_email → enviar_email_gmail → atualizar_prospectado (PATCH) → patch_busca_concluida');
console.log('    [FALSE] → patch_busca_concluida (sem email, fica como LOCALIZADOS)');
