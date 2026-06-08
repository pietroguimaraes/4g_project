const fs = require('fs');

// Lê o v47 (último fluxo gerado)
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_4g_v47_filtro.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_4g_v48_fix_texto.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Corrige nó "tipo_mensagem1" ────────────────────────────────────────────
// Problema: checa wa_lastMessageTextVote (campo de enquete — vazio para texto normal)
// Solução:  checar wa_lastMessage (campo de texto comum)

const tipoMensagem = d.nodes.find(n => n.name === 'tipo_mensagem1');
if (!tipoMensagem) {
  console.error('✗ nó tipo_mensagem1 não encontrado!');
  process.exit(1);
}

const condTipo = tipoMensagem.parameters.conditions.conditions[0];
if (!condTipo.leftValue.includes('wa_lastMessageTextVote')) {
  console.warn('⚠ tipo_mensagem1: campo já foi alterado ou é diferente do esperado.');
  console.warn('  Valor atual:', condTipo.leftValue);
} else {
  condTipo.leftValue = condTipo.leftValue.replace('wa_lastMessageTextVote', 'wa_lastMessage');
  console.log('✓ tipo_mensagem1: wa_lastMessageTextVote → wa_lastMessage');
}

// ─── Corrige nó "set_texto_mensagem1" ───────────────────────────────────────
// Problema: lê wa_lastMessageTextVote como conteúdo da mensagem (vem vazio)
// Solução:  ler wa_lastMessage

const setTexto = d.nodes.find(n => n.name === 'set_texto_mensagem1');
if (!setTexto) {
  console.error('✗ nó set_texto_mensagem1 não encontrado!');
  process.exit(1);
}

const assignMensagem = setTexto.parameters.assignments.assignments.find(a => a.name === 'mensagem');
if (!assignMensagem) {
  console.error('✗ campo "mensagem" não encontrado em set_texto_mensagem1!');
  process.exit(1);
}

if (!assignMensagem.value.includes('wa_lastMessageTextVote')) {
  console.warn('⚠ set_texto_mensagem1: campo já foi alterado ou é diferente do esperado.');
  console.warn('  Valor atual:', assignMensagem.value);
} else {
  assignMensagem.value = assignMensagem.value.replace('wa_lastMessageTextVote', 'wa_lastMessage');
  console.log('✓ set_texto_mensagem1: wa_lastMessageTextVote → wa_lastMessage');
}

// ─── Salva ──────────────────────────────────────────────────────────────────
d.name = 'Fluxo_4g — Dashboard v2 (v48 fix-campo-texto)';
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ────────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');

const cond = d.nodes.find(n => n.name === 'tipo_mensagem1').parameters.conditions.conditions[0];
console.log('tipo_mensagem1 leftValue:', cond.leftValue.includes('wa_lastMessage') && !cond.leftValue.includes('Vote') ? '✓ wa_lastMessage' : '✗ ' + cond.leftValue);

const assign = d.nodes.find(n => n.name === 'set_texto_mensagem1').parameters.assignments.assignments.find(a => a.name === 'mensagem');
console.log('set_texto_mensagem1 mensagem:', assign.value.includes('wa_lastMessage') && !assign.value.includes('Vote') ? '✓ wa_lastMessage' : '✗ ' + assign.value);

console.log('\nComportamento esperado:');
console.log('  Cliente envia texto  → wa_lastMessage preenchido → tipo_mensagem1 TRUE → AI Agent responde ✓');
console.log('  Cliente envia áudio  → wa_lastMessage vazio      → detectar_audio TRUE → transcreve + AI ✓');
console.log('  Cliente envia imagem → wa_lastMessage vazio      → detectar_audio FALSE → aviso ✓');
