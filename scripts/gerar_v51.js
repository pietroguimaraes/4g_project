const fs = require('fs');

// === v51: Melhoria dos termos de busca no definir_termos ===
//
// Anderson compartilhou exemplos reais dos seus clientes (via WhatsApp, 2026-06-23):
//   - Tókio Importados (Fortaleza-CE)       → "Loja de variedades"
//   - PH Importados Comércio (Maceió-AL)    → nome com "Importados" (não coberto)
//   - Importados Cipriano (Teresina-PI)     → "Loja de departamentos" (não coberto)
//   - Wang Ma Variedades (Feira de Santana) → "Variedades"
//   - Oliveira Variedades (Teresina-PI)     → "Loja de presentes"
//   - Paraíso dos Presentes (Feira-BA)      → "Loja de presentes"
//   - Armarinho Campelo (Belém-PA)          → "Armarinho"
//   - Merlins Papelaria + Brinquedos (AL)  → "Papelaria" (não coberto)
//   - DTudo (Aracaju-SE)                    → "Artigos domésticos" (não coberto)
//   - Vitória Atacado (Vitória Conquista-BA)→ "Loja de eletrônicos" (atacado diverso)
//   - Comercial HS/HD (Feira de Santana-BA) → "Loja de brinquedos"
//
// Lacuna principal: nenhum termo buscava "importados" ou "loja de departamentos",
// onde ficam muitos dos clientes reais.

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_4g_v50_fix_prompt.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_4g_v51_termos_anderson.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Novo código do definir_termos ───────────────────────────────────────────
const codigoDefinirTermos = `const body = $input.first().json.body;
const tipoLoja = body.tipo_loja || '';
const cidade = body.cidade || '';
const estado = body.estado || '';
const quantidade = parseInt(body.quantidade) || 30;

// v51 — termos atualizados com base nos clientes reais do Anderson (2026-06-23)
// Adicionados: importados, loja de departamentos, papelaria brinquedos,
//              artigos domésticos, comércio de variedades, atacado variedades
const TERMOS = {
  'Lojas de artigos esportivos': [
    'loja de artigos esportivos',
    'loja de material esportivo',
    'loja esportiva',
    'equipamentos esportivos',
    'sport shop',
    'loja multiesportes',
    'artigos de futebol loja',
    'bola esportiva loja',
    'loja de beach tennis',
    'loja de patins',
    'loja de surf skate',
  ],
  'Lojas de brinquedos': [
    'loja de brinquedos',
    'brinquedos infantis',
    'loja de jogos e brinquedos',
    'toy store',
    'artigos infantis loja',
    'papelaria brinquedos',
    'comercial brinquedos',
  ],
  'Eletroportáteis/eletrônicos': [
    'loja de eletrônicos',
    'loja de eletrodomésticos',
    'loja de celulares',
    'loja de informática',
    'loja de games',
    'eletrodomésticos loja',
  ],
  'Lojas de Variedades/1,99/miudezas/bazares': [
    'loja de variedades',
    'importados',
    'loja de importados',
    'loja de departamentos',
    'comércio de variedades',
    'loja de presentes',
    'armarinho',
    'loja de novidades',
    'artigos domésticos loja',
    'bazar',
    'utilidades domésticas loja',
    'atacado variedades',
    'miudezas',
  ],
};

const searchStringsArray = TERMOS[tipoLoja] || TERMOS['Lojas de Variedades/1,99/miudezas/bazares'];
const locationQuery = cidade + ', ' + estado + ', Brasil';
const maxResults = quantidade;
const perSearch = Math.max(Math.ceil(maxResults / searchStringsArray.length), 4);

return [{ json: {
  searchStringsArray, locationQuery, quantidade, maxResults, perSearch,
  tipo_loja: tipoLoja, cidade, estado, ...body,
} }];`;

// ─── Aplica no nó ─────────────────────────────────────────────────────────────
const node = d.nodes.find(n => n.name === 'definir_termos');
if (!node) {
  console.error('x no "definir_termos" nao encontrado!');
  process.exit(1);
}

node.parameters.jsCode = codigoDefinirTermos;
console.log('v definir_termos atualizado com novos termos');

// ─── Salva ────────────────────────────────────────────────────────────────────
d.name = 'Fluxo_4g — Dashboard v2 (v51 termos-anderson)';
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('v Arquivo salvo:', OUTPUT);

// ─── Verificacao ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICACAO ===');
const code = node.parameters.jsCode;
console.log('importados:',            code.includes("'importados'")            ? 'v' : 'x NAO ENCONTRADO');
console.log('loja de departamentos:', code.includes("'loja de departamentos'")  ? 'v' : 'x NAO ENCONTRADO');
console.log('papelaria brinquedos:',  code.includes("'papelaria brinquedos'")   ? 'v' : 'x NAO ENCONTRADO');
console.log('artigos domésticos:',    code.includes("'artigos domésticos loja'")? 'v' : 'x NAO ENCONTRADO');
console.log('atacado variedades:',    code.includes("'atacado variedades'")     ? 'v' : 'x NAO ENCONTRADO');
console.log('comércio de variedades:',code.includes("'comércio de variedades'") ? 'v' : 'x NAO ENCONTRADO');
console.log('loja de presentes:',     code.includes("'loja de presentes'")      ? 'v' : 'x NAO ENCONTRADO');
console.log('armarinho:',             code.includes("'armarinho'")              ? 'v' : 'x NAO ENCONTRADO');

console.log('\nTermos na categoria Variedades:');
const match = code.match(/'Lojas de Variedades.*?]\s*,/s);
if (match) {
  const termos = match[0].match(/'([^']+)'/g) || [];
  termos.slice(1).forEach((t, i) => console.log('  ' + (i + 1) + '. ' + t));
}
