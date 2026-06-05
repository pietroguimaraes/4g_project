const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v1.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v2.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Atualizar enriquecer_leads — prompt IA mais específico ──────────────────
const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado!'); process.exit(1); }

// Substituir apenas a função buscarTelefoneIA dentro do código existente
const codeAtual = enriquece.parameters.jsCode;

const promptAntigo = `const prompt = \`Busque o número de WhatsApp ou celular da empresa: "\${nome}", localizada em \${endereco ? endereco + ', ' : ''}\${cidade}, Brasil.
Responda APENAS com o número de telefone (com DDD), sem formatação, sem texto adicional.
Se não encontrar com certeza, responda: não encontrado\`;`;

const promptNovo = `const prompt = \`Preciso do WhatsApp pessoal do dono, diretor, gerente ou comprador da empresa: "\${nome}", localizada em \${endereco ? endereco + ', ' : ''}\${cidade}, Brasil.

Procure nas seguintes fontes, nessa ordem:
1. Instagram da empresa — o dono costuma colocar o WhatsApp pessoal na bio ou nos posts
2. Facebook da empresa ou do dono — verifique a página e o perfil pessoal
3. Google — pesquise "\${nome} \${cidade} dono WhatsApp" ou "\${nome} \${cidade} comprador contato"
4. Site da empresa — procure por wa.me/ ou número de celular na página de contato

Responda APENAS com o número de telefone com DDD (ex: 82912345678), sem formatação, sem texto adicional.
Se não encontrar com certeza, responda: não encontrado\`;`;

if (!codeAtual.includes('Responda APENAS com o número de telefone (com DDD), sem formatação')) {
  console.error('✗ Prompt antigo não encontrado no código — verifique o texto de busca');
  process.exit(1);
}

enriquece.parameters.jsCode = codeAtual.replace(promptAntigo, promptNovo);

// Verificar se a substituição funcionou
if (enriquece.parameters.jsCode === codeAtual) {
  console.error('✗ Substituição falhou — o prompt não foi alterado');
  process.exit(1);
}

console.log('✓ Prompt da IA atualizado para buscar dono/comprador via Instagram, Facebook e Google');

// ─── Renomear fluxo ───────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v2 — prompt IA dono/comprador';
console.log('✓ Nome do fluxo atualizado para v2');

// ─── Salvar ───────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');
const json = JSON.stringify(d);
console.log('Contém "dono, diretor":', json.includes('dono, diretor') ? '✓' : '✗');
console.log('Contém Instagram:', json.includes('Instagram') ? '✓' : '✗');
console.log('Contém Facebook:', json.includes('Facebook') ? '✓' : '✗');
console.log('Contém distribuidora-b2b-nu:', json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
console.log('Contém 4g-project.vercel.app:', json.includes('4g-project.vercel.app') ? '✗ PROBLEMA!' : '✓ Não encontrado');
