const fs = require('fs');

// v37: salva lead JA como PROSPECTADOS se tem email — nunca passa pelo painel de aprovacao
// Remove o node atualizar_prospectado (nao precisa mais de PATCH depois)
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v36.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v37.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v37 - leads com email vao direto pra prospectados';
console.log('OK Nome atualizado');

// ── 1. Muda status no HTTP Request6 ──────────────────────────────────────────
// Se tem email → PROSPECTADOS direto. Se nao tem → mantém _status_final (LOCALIZADOS/RESERVA)
var hr6 = d.nodes.find(function(n) { return n.name === 'HTTP Request6'; });
if (!hr6) { console.error('ERRO: HTTP Request6 nao encontrado'); process.exit(1); }

var statusAntigo = '"status":           "{{ $json._status_final }}"';
var statusNovo   = '"status":           "{{ ($json.email || $json._email) ? \'PROSPECTADOS\' : $json._status_final }}"';

hr6.parameters.jsonBody = hr6.parameters.jsonBody.replace(
  '"status":           "{{ $json._status_final }}"',
  statusNovo
);

console.log('OK HTTP Request6 status atualizado:');
hr6.parameters.jsonBody.split('\n').forEach(function(l) {
  if (l.includes('status')) console.log('  ', l.trim());
});

// ── 2. Remove node atualizar_prospectado (nao precisa mais) ──────────────────
var antes = d.nodes.length;
d.nodes = d.nodes.filter(function(n) { return n.name !== 'atualizar_prospectado'; });
var removido = antes - d.nodes.length;
console.log('OK atualizar_prospectado removido:', removido === 1 ? 'sim' : 'nao encontrado');

// ── 3. Reconecta: enviar_email_gmail → patch_busca_concluida (direto) ────────
d.connections['enviar_email_gmail'] = {
  main: [[{ node: 'patch_busca_concluida', type: 'main', index: 0 }]]
};
delete d.connections['atualizar_prospectado'];
console.log('OK enviar_email_gmail → patch_busca_concluida (direto)');

// ── 4. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 5. Verificacao ────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var connEmail = d.connections['enviar_email_gmail'];

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v37',                    json.includes('Victor Pizza v37')],
  ['status PROSPECTADOS no save', json.includes("PROSPECTADOS' : $json._status_final")],
  ['sem atualizar_prospectado',   !json.includes('"atualizar_prospectado"')],
  ['email → patch direto',        connEmail && connEmail.main[0][0].node === 'patch_busca_concluida'],
  ['schedule_diario',             json.includes('"schedule_diario"')],
  ['montar_email node',           json.includes('"montar_email"')],
  ['Gmail node',                  json.includes('n8n-nodes-base.gmail')],
  ['isExecuted fixado',           json.includes('isExecuted')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== LOGICA DE STATUS (v37) ===');
console.log('Lead COM email  → salvo como PROSPECTADOS → vai direto ao Kanban');
console.log('Lead SEM email  → salvo como LOCALIZADOS  → nao tem como prospectar por email');
