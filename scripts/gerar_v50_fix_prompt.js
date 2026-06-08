const fs = require('fs');

// ─── Objetivo ────────────────────────────────────────────────────────────────
// O nó "AI Agent1" tem o systemMessage em modo "fixed value" (texto estático).
// Por isso, {{ $json.catalogoSemPreco }} é enviado literalmente ao LLM em vez
// do link real.
//
// Solução: converter para modo expression, envolvendo o texto em ={{ `...` }}
// e substituindo {{ expressao }} por ${expressao} (template literal JS).
// ─────────────────────────────────────────────────────────────────────────────

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_4g_v49_fix_campo.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_4g_v50_fix_prompt.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Encontra o nó AI Agent1 ─────────────────────────────────────────────────
const agente = d.nodes.find(n => n.name === 'AI Agent1');
if (!agente) {
  console.error('✗ nó "AI Agent1" não encontrado!');
  process.exit(1);
}

const systemMessage = agente.parameters.options.systemMessage;
if (typeof systemMessage !== 'string') {
  console.error('✗ systemMessage não é string:', typeof systemMessage);
  process.exit(1);
}

// Verifica se já está em modo expression (não deve estar)
if (systemMessage.startsWith('=')) {
  console.warn('⚠ systemMessage já está em modo expression — nenhuma alteração necessária.');
  console.warn('  Valor atual começa com:', systemMessage.substring(0, 60));
  process.exit(0);
}

console.log('✓ systemMessage encontrado em modo fixed value');
console.log('  Ocorrências de {{ }}:');

// ─── Substituições de {{ expressao }} → ${expressao} ─────────────────────────
const substituicoes = [
  {
    de: '{{ $json.catalogoSemPreco }}',
    para: '${$json.catalogoSemPreco}',
  },
  {
    de: '{{ $json.catalogoComPreco }}',
    para: '${$json.catalogoComPreco}',
  },
  {
    de: "{{ $('recebe_msg_do_lead').item.json.body.message.chatid.split('@')[0] }}",
    para: "${$('recebe_msg_do_lead').item.json.body.message.chatid.split('@')[0]}",
  },
];

let textoCorrigido = systemMessage;

for (const s of substituicoes) {
  let count = 0;
  while (textoCorrigido.includes(s.de)) {
    textoCorrigido = textoCorrigido.replace(s.de, s.para);
    count++;
  }
  console.log(`  ${count}x  "${s.de.substring(0, 40)}..." → "${s.para.substring(0, 40)}..."`);
}

// Verifica se ainda sobrou algum {{ }}
const restantes = (textoCorrigido.match(/\{\{/g) || []).length;
if (restantes > 0) {
  console.warn(`\n⚠ Ainda há ${restantes} ocorrências de {{ }} não substituídas!`);
  const regex = /\{\{[^}]+\}\}/g;
  let m;
  while ((m = regex.exec(textoCorrigido)) !== null) {
    console.warn('  Não substituído:', m[0].substring(0, 80));
  }
}

// ─── Converte para modo expression: =`...texto...` ───────────────────────────
// IMPORTANTE: backticks no valor precisam ser escapados (\`)
// Aspas simples e duplas dentro do texto não precisam de escape em JSON.
// O n8n reconhece modo expression quando o valor começa com "=".
const textoExpression = '=`' + textoCorrigido.replace(/`/g, '\\`') + '`';

agente.parameters.options.systemMessage = textoExpression;

console.log('\n✓ systemMessage convertido para modo expression');

// ─── Salva ───────────────────────────────────────────────────────────────────
d.name = 'Fluxo_4g — Dashboard v2 (v50 fix-system-prompt-expression)';
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');

const sm = d.nodes.find(n => n.name === 'AI Agent1').parameters.options.systemMessage;
console.log('Começa com "=`":', sm.startsWith('=`') ? '✓' : '✗ ' + sm.substring(0, 20));
console.log('Contém $json.catalogoSemPreco:', sm.includes('${$json.catalogoSemPreco}') ? '✓' : '✗ NÃO ENCONTRADO');
console.log('Contém $json.catalogoComPreco:', sm.includes('${$json.catalogoComPreco}') ? '✓' : '✗ NÃO ENCONTRADO');
console.log('Contém $recebe_msg chatid split:', sm.includes("${$('recebe_msg_do_lead')") ? '✓' : '✗ NÃO ENCONTRADO');
console.log('Ainda contém {{ }}:', sm.includes('{{') ? '✗ SIM — revisar!' : '✓ Não');

console.log('\nComportamento esperado:');
console.log('  catalogoSemPreco → link real do Drive (sem preços) ✓');
console.log('  catalogoComPreco → link real do Drive (com preços) ✓');
console.log('  chatid.split     → número do WhatsApp do lead     ✓');
