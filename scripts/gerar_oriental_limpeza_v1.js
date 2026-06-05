const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_4g_v46_ia.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v1.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── 1. Renomear o fluxo ─────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v1 — supermercados/atacadistas SE/BA/AL';
console.log('✓ Nome do fluxo atualizado');

// ─── 2. Trocar todas as URLs 4g-project → distribuidora-b2b-nu ───────────────
const OLD_URL = 'https://4g-project.vercel.app';
const NEW_URL = 'https://distribuidora-b2b-nu.vercel.app';

let trocas = 0;
d.nodes.forEach(n => {
  const s = JSON.stringify(n);
  if (s.includes(OLD_URL)) {
    const novo = JSON.parse(s.replace(new RegExp(OLD_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_URL));
    Object.assign(n, novo);
    trocas++;
  }
});
console.log(`✓ URLs trocadas em ${trocas} nó(s): ${OLD_URL} → ${NEW_URL}`);

// ─── 3. Atualizar definir_termos com categorias Oriental Limpeza ─────────────
const defTermos = d.nodes.find(n => n.name === 'definir_termos');
if (!defTermos) { console.error('✗ nó definir_termos não encontrado!'); process.exit(1); }

defTermos.parameters.jsCode = `const body = $('receber_busca_dashboard').first().json.body;
const tipoLoja = body.tipo_loja || '';
const cidade = body.cidade || '';
const estado = body.estado || '';
const quantidade = parseInt(body.quantidade) || 30;

const TERMOS = {
  'Supermercados': [
    'supermercado',
    'mercado supermercado',
    'rede supermercadista',
    'hipermercado',
    'supermercado atacarejo',
  ],
  'Atacadistas e atacarejos': [
    'atacadista',
    'atacarejo',
    'atacado distribuidor',
    'cash and carry',
    'distribuidora atacado',
  ],
  'Distribuidoras': [
    'distribuidora',
    'distribuidora produtos limpeza',
    'distribuidora higiene limpeza',
    'atacado distribuidora',
    'distribuidora higiene',
  ],
};

const DEFAULT_TERMOS = TERMOS['Supermercados'];
const searchStringsArray = TERMOS[tipoLoja] || DEFAULT_TERMOS;
const locationQuery = cidade + ', ' + estado + ', Brasil';
const maxResults = quantidade * 3; // multiplicador 3x
const quantidade_pedida = quantidade;
const perSearch = Math.max(Math.ceil(maxResults / searchStringsArray.length), 4);

return [{ json: {
  searchStringsArray, locationQuery, quantidade, maxResults, perSearch, quantidade_pedida,
  tipo_loja: tipoLoja, cidade, estado, ...body,
} }];`;

console.log('✓ definir_termos atualizado com termos de supermercados/atacadistas/distribuidoras');

// ─── 4. Atualizar mapear_catalogo com placeholder Oriental Limpeza ───────────
const mapCatalogo = d.nodes.find(n => n.name === 'mapear_catalogo');
if (mapCatalogo) {
  mapCatalogo.parameters.jsCode = `const lead = $input.first().json;
const tipoLoja = (lead && !lead.error) ? (lead.tipo_loja || '') : '';

let mensagem = '';
try { mensagem = $('set_texto_mensagem1').item.json.mensagem || ''; } catch(e) {}
if (!mensagem) { try { mensagem = $('set_texto_audio').item.json.mensagem || ''; } catch(e) {} }

// Catálogo Oriental Limpeza — placeholder (adicionar links reais após contrato)
const CATALOGO_PLACEHOLDER = 'https://wa.me/p/oriental-limpeza-catalogo';

return [{ json: {
  mensagem,
  catalogoSemPreco: CATALOGO_PLACEHOLDER,
  catalogoComPreco: CATALOGO_PLACEHOLDER,
  tipoLoja,
} }];`;
  console.log('✓ mapear_catalogo atualizado com placeholder Oriental Limpeza');
}

// ─── 5. Salvar ────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── 6. Verificação ──────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');
const json = JSON.stringify(d);
console.log('Contém 4g-project.vercel.app:', json.includes('4g-project.vercel.app') ? '✗ AINDA TEM — revisar!' : '✓ Não encontrado');
console.log('Contém distribuidora-b2b-nu:', json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗ NÃO ENCONTRADO');
console.log('Contém Supermercados no definir_termos:', json.includes("'Supermercados'") ? '✓' : '✗');
console.log('Contém Atacadistas no definir_termos:', json.includes("'Atacadistas e atacarejos'") ? '✓' : '✗');
console.log('Total de nós:', d.nodes.length);
