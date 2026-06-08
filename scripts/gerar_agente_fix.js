const fs = require('fs');

// Lê o Agente-4g mais recente
const INPUT  = 'C:/Users/guima/Downloads/Agente-4g (5).json';
const OUTPUT = 'C:/Users/guima/Downloads/Agente-4g_fix.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Corrige nó "From me" ───────────────────────────────────────────────────
// Problema: operator "boolean.false" com typeValidation "strict"
//   → undefined === false → FALSO → mensagens de texto bloqueadas
// Solução: notEquals true com typeValidation "loose"
//   → undefined !== true (loose) → VERDADEIRO → passa ✓
//   → false   !== true (loose) → VERDADEIRO → passa ✓
//   → true    !== true         → FALSO      → bloqueado ✓ (bot)

const fromMe = d.nodes.find(n => n.name === 'From me');
if (!fromMe) {
  console.error('✗ nó "From me" não encontrado!');
  process.exit(1);
}

const condFromMe = fromMe.parameters.conditions.conditions[0];

// Troca operador de "boolean.false" para "notEquals" com rightValue true
condFromMe.rightValue = true;
condFromMe.operator = {
  type: 'boolean',
  operation: 'notEquals',
};

// Troca typeValidation para loose
fromMe.parameters.conditions.options.typeValidation = 'loose';

console.log('✓ From me: corrigido para fromMe !== true (loose)');

// ─── Corrige nó "From API" (mesmo padrão, mesma prevenção) ─────────────────
const fromApi = d.nodes.find(n => n.name === 'From API');
if (!fromApi) {
  console.warn('⚠ nó "From API" não encontrado — pulando.');
} else {
  const condFromApi = fromApi.parameters.conditions.conditions[0];

  condFromApi.rightValue = true;
  condFromApi.operator = {
    type: 'boolean',
    operation: 'notEquals',
  };

  fromApi.parameters.conditions.options.typeValidation = 'loose';

  console.log('✓ From API: corrigido para fromApi !== true (loose)');
}

// ─── Salva ──────────────────────────────────────────────────────────────────
d.name = 'Agente-4g (fix — fromMe e fromApi loose)';
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ────────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');

const fm = d.nodes.find(n => n.name === 'From me');
const fmCond = fm.parameters.conditions.conditions[0];
const fmType = fm.parameters.conditions.options.typeValidation;
console.log('From me — operator:', fmCond.operator.operation === 'notEquals' ? '✓ notEquals' : '✗ ' + fmCond.operator.operation);
console.log('From me — rightValue:', fmCond.rightValue === true ? '✓ true' : '✗ ' + fmCond.rightValue);
console.log('From me — typeValidation:', fmType === 'loose' ? '✓ loose' : '✗ ' + fmType);

console.log('\nComportamento esperado:');
console.log('  fromMe = true      → FALSE → bloqueado ✓  (mensagem do bot)');
console.log('  fromMe = false     → TRUE  → passa    ✓  (mensagem do cliente)');
console.log('  fromMe = undefined → TRUE  → passa    ✓  (texto/áudio/imagem)');
