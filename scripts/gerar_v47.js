const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v46_ia.json', 'utf8'));

// === v47: Corrige filtro_fromMe ===
//
// Problema: filtro_fromMe usava comparação ESTRITA (fromMe === false).
// Mensagens de clientes chegam via uazapi como evento "chat update" onde
// o campo body.message.fromMe simplesmente NÃO EXISTE (undefined).
// Com typeValidation: "strict":
//   undefined === false → false → False Branch → mensagem descartada → cliente sem resposta
//
// Solução: trocar para comparação INVERSA com typeValidation: "loose"
//   fromMe !== true (loose) → undefined passa ✓, false passa ✓, true bloqueia ✓

const nodeFiltro = d.nodes.find(n => n.name === 'filtro_fromMe');
if (!nodeFiltro) {
  console.error('✗ nó filtro_fromMe não encontrado!');
  process.exit(1);
}

const conditions = nodeFiltro.parameters?.conditions?.conditions || [];
const cond = conditions.find(c =>
  JSON.stringify(c).includes('fromMe') ||
  JSON.stringify(c.leftValue || '').includes('fromMe')
);

if (!cond) {
  console.error('✗ condição fromMe não encontrada dentro do nó!');
  process.exit(1);
}

// Muda operação: notEquals (false) → notEquals (true)
cond.rightValue = true;

// Muda typeValidation: strict → loose
if (nodeFiltro.parameters.conditions.options) {
  nodeFiltro.parameters.conditions.options.typeValidation = 'loose';
} else {
  nodeFiltro.parameters.conditions.options = { typeValidation: 'loose' };
}

console.log('✓ filtro_fromMe: comparação alterada para fromMe !== true (loose)');

// Salvar
d.name = 'Fluxo_4g — Dashboard v2 (v47 filtro-fromMe-corrigido)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v47_filtro.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v47_filtro.json salvo em Downloads');

// Verificação
const condAtual = nodeFiltro.parameters?.conditions?.conditions?.[0] || cond;
const typeVal   = nodeFiltro.parameters?.conditions?.options?.typeValidation;

console.log('\n=== VERIFICACAO ===');
console.log('rightValue é true:', condAtual.rightValue === true ? '✓' : '✗ (valor: ' + condAtual.rightValue + ')');
console.log('typeValidation é loose:', typeVal === 'loose' ? '✓' : '✗ (valor: ' + typeVal + ')');
console.log('\nComportamento esperado:');
console.log('  fromMe = true  → False Branch (bot) → BLOQUEADO ✓');
console.log('  fromMe = false → True Branch  (cliente) → PASSA ✓');
console.log('  fromMe = undefined → True Branch (chat update com mensagem) → PASSA ✓');
