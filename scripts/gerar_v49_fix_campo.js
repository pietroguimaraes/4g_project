const fs = require('fs');

// Lê o v47 (última versão estável antes dos nossos testes)
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_4g_v47_filtro.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_4g_v49_fix_campo.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Por que body.message.text e não wa_lastMessageTextVote? ────────────────
//
// uazapi dispara DOIS webhooks para cada mensagem recebida:
//   1. Evento "message" (chegada da mensagem)  → body.message.text = "Oi"
//                                              → wa_lastMessageTextVote pode estar vazio
//   2. Evento "updated" (atualização do chat)  → body.message.text = "Oi"
//                                              → wa_lastMessageTextVote = "Oi"
//
// O dedup em registrar_mensagem bloqueia o 2º evento (mesmo messageid).
// Então só o 1º evento chega ao tipo_mensagem1.
// Se wa_lastMessageTextVote vier vazio no 1º evento → tipo_mensagem1 FALSE → aviso.
//
// body.message.text está garantido nos dois eventos → solução correta.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Corrige tipo_mensagem1 ──────────────────────────────────────────────────
const tipoMensagem = d.nodes.find(n => n.name === 'tipo_mensagem1');
if (!tipoMensagem) { console.error('✗ tipo_mensagem1 não encontrado!'); process.exit(1); }

const condTipo = tipoMensagem.parameters.conditions.conditions[0];
condTipo.leftValue = "={{ $json.body.message.text }}";
console.log('✓ tipo_mensagem1: campo → $json.body.message.text');

// ─── Corrige set_texto_mensagem1 ────────────────────────────────────────────
const setTexto = d.nodes.find(n => n.name === 'set_texto_mensagem1');
if (!setTexto) { console.error('✗ set_texto_mensagem1 não encontrado!'); process.exit(1); }

const assignMensagem = setTexto.parameters.assignments.assignments.find(a => a.name === 'mensagem');
if (!assignMensagem) { console.error('✗ campo mensagem não encontrado!'); process.exit(1); }

assignMensagem.value = "={{ $json.body.message.text }}";
console.log('✓ set_texto_mensagem1: campo → $json.body.message.text');

// ─── Salva ───────────────────────────────────────────────────────────────────
d.name = 'Fluxo_4g — Dashboard v2 (v49 fix-body-message-text)';
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');

const c = d.nodes.find(n => n.name === 'tipo_mensagem1').parameters.conditions.conditions[0];
console.log('tipo_mensagem1:', c.leftValue === '={{ $json.body.message.text }}' ? '✓' : '✗ ' + c.leftValue);

const a = d.nodes.find(n => n.name === 'set_texto_mensagem1').parameters.assignments.assignments.find(a => a.name === 'mensagem');
console.log('set_texto_mensagem1:', a.value === '={{ $json.body.message.text }}' ? '✓' : '✗ ' + a.value);

console.log('\nComportamento esperado:');
console.log('  Texto "Oi"  → body.message.text = "Oi"  → tipo_mensagem1 TRUE  → AI Agent responde ✓');
console.log('  Áudio       → body.message.text = ""     → tipo_mensagem1 FALSE → detectar_audio    ✓');
console.log('  Imagem/doc  → body.message.text = ""     → detectar_audio FALSE → aviso             ✓');
