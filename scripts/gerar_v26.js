const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v23_salva_todos.json', 'utf8'));

// =============================================================
// v26 — Correções pós-teste do actor Receita Federal CNPJ
//
// Bugs identificados no teste da v25:
//   1. Campo telefone é "telefone1", não "ddd_telefone_1"
//   2. Lookup IBGE falhou (ibge_code = "") — municipio não filtrou
//   3. Actor retornou empresas INAPTA — precisa filtrar situacao_cadastral
//
// Fixes:
//   1. filtrar_categoria: usa telefone1 como campo de phone
//   2. mapear_tipo_loja: usa fetch() em vez de $helpers.httpRequest
//      para lookup IBGE (mais compatível com versões do n8n)
//   3. filtrar_categoria: descarta INAPTA/BAIXADA, mantém só ATIVA
// =============================================================

// ---- 1. ATUALIZAR mapear_tipo_loja ----
const mapearNode = d.nodes.find(n => n.name === 'mapear_tipo_loja');

mapearNode.parameters.jsCode = `const body = $input.first().json.body;
const tipoLoja = body.tipo_loja || '';
const cidade = body.cidade || '';
const estado = body.estado || '';
const quantidade = parseInt(body.quantidade) || 30;

const CNAES = {
  'Lojas de artigos esportivos': ['4763602'],
  'Lojas de brinquedos': ['4763601'],
  'Papelaria': ['4761002'],
  'Lojas de Variedades/1,99/miudezas/bazares': ['4789099'],
};

function normalizar(str) {
  return (str || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
}

const APPROVED = {
  'Lojas de artigos esportivos': [
    'artigos esportivos','material esportivo','equipamentos esportivos',
    'sporting goods','loja esportiva','bicicletas','ciclismo','bicycle',
    'pesca esportiva','loja de pesca','fishing store','artigos de pesca',
    'surf','skate','skateboard','roupas esportivas','sportswear','sports clothing',
    'corrida','running','futebol','artigos de futebol','football store',
    'tênis esportivo','calçados esportivos',
  ],
  'Lojas de brinquedos': [
    'brinquedos','toy store','hobby','jogos infantis','loja de jogos','brinquedo',
    'artigos infantis','loja infantil','kids','bonecas','boneca',
  ],
  'Papelaria': [
    'papelaria','stationery','material escolar','office supply','livraria','material de escritório',
  ],
  'Lojas de Variedades/1,99/miudezas/bazares': [
    'variedades','variety store','bazar','bazaar','armarinho',
    'utilidades domésticas','home goods','utilidades',
    'casa e cozinha','cozinha e lar','kitchen','presentes','gift shop',
    'importados','import store','1,99','dollar store','miudezas',
    'loja geral','general store','quinquilharias','bijuterias','bijuteria',
    'loja de desconto','discount store',
  ],
};

const DENIED_GLOBAL = [
  'academia','gym','fitness','crossfit','pilates','yoga',
  'clube','club','arena esportiva','complexo esportivo','sports complex',
  'restaurante','restaurant','lanchonete','padaria','confeitaria','bar ',
  'supermercado','hipermercado','atacado de alimentos',
  'farmácia','drogaria','pharmacy',
  'clínica','médico','dentista','hospital',
  'escola de ','escola infantil','educação infantil','colégio','creche','buffet',
  'construtora','construção','empreiteira','construction',
  'assistência técnica','conserto','manutenção','reparo',
  'imobiliária','real estate',
  'salão de beleza','cabeleireiro','barbearia','hair salon',
  'estética','spa','beauty salon',
  'agropecuária','veterinário','feed store',
  'alimentos','mercearia','açougue','food manufacturer',
  'tecidos','costura',
];

const cnaes = CNAES[tipoLoja] || CNAES['Lojas de Variedades/1,99/miudezas/bazares'];
const approvedCategories = APPROVED[tipoLoja] || APPROVED['Lojas de Variedades/1,99/miudezas/bazares'];
const deniedCategories = DENIED_GLOBAL;

// Busca código IBGE do município via fetch() — mais compatível com n8n
let ibge_code = '';
try {
  const resp = await fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + estado + '/municipios'
  );
  const municipios = await resp.json();
  const mun = municipios.find(function(m) {
    return normalizar(m.nome) === normalizar(cidade);
  });
  ibge_code = mun ? String(mun.id) : '';
} catch(e) {
  ibge_code = '';
}

const locationQuery = cidade + ', ' + estado + ', Brasil';
const buscarQtd = quantidade;
const maxResults = quantidade;

return [{ json: {
  cnaes,
  ibge_code,
  approvedCategories,
  deniedCategories,
  locationQuery,
  quantidade,
  buscarQtd,
  maxResults,
  tipo_loja: tipoLoja,
  cidade,
  estado,
  ...body,
} }];`;

console.log('✓ mapear_tipo_loja: fetch() para IBGE, CNAES adicionados');

// ---- 2. TROCAR actor Apify: Google Maps → Receita Federal ----
const apifyNode = d.nodes.find(n => n.name === 'Run an Actor and get dataset1');

apifyNode.parameters.actorId = {
  __rl: true,
  value: 'jungle_synthesizer~brazil-cnpj-receita-federal-crawler',
  mode: 'id',
  cachedResultName: 'Brazil CNPJ Receita Federal Scraper',
  cachedResultUrl: 'https://console.apify.com/actors/jungle_synthesizer~brazil-cnpj-receita-federal-crawler/input',
};

delete apifyNode.parameters.actorSource;
apifyNode.parameters.operation = 'Run actor and get dataset';

// Passa cnae, municipio (IBGE), maxItems
// Actor retorna todos os status — filtro de ATIVA é feito no filtrar_categoria
apifyNode.parameters.customBody = "={{ JSON.stringify({\n  cnae: $('mapear_tipo_loja').item.json.cnaes[0],\n  municipio: $('mapear_tipo_loja').item.json.ibge_code,\n  maxItems: $('mapear_tipo_loja').item.json.quantidade * 3\n}) }}";

console.log('✓ Apify node: actor Receita Federal com tilde ~');

// ---- 3. ATUALIZAR filtrar_categoria ----
const filtrarNode = d.nodes.find(n => n.name === 'filtrar_categoria');

filtrarNode.parameters.jsCode = `const items = $input.all();
const approvedCategories = $('mapear_tipo_loja').first().json.approvedCategories || [];
const deniedCategories = $('mapear_tipo_loja').first().json.deniedCategories || [];

// Detecta dados da Receita Federal pelo campo telefone1 ou razao_social
const isReceitaFederal = items.length > 0 && (
  items[0].json.telefone1 !== undefined ||
  items[0].json.razao_social !== undefined
);

function normalizar_item(item) {
  if (!isReceitaFederal) return item.json;

  // Campo correto: telefone1 (ex: "2126201618" = DDD + número)
  const phone = (item.json.telefone1 || '').replace(/\\D/g, '');

  const nome = (item.json.nome_fantasia && item.json.nome_fantasia.trim())
    ? item.json.nome_fantasia
    : (item.json.razao_social || '');

  const municipioNome = typeof item.json.municipio === 'string' && isNaN(item.json.municipio)
    ? item.json.municipio
    : ($('mapear_tipo_loja').first().json.cidade || '');

  const uf = item.json.uf || $('mapear_tipo_loja').first().json.estado || '';

  const address = [
    item.json.tipo_logradouro, item.json.logradouro, item.json.numero,
    item.json.complemento, item.json.bairro, municipioNome, uf
  ].filter(Boolean).join(', ');

  return {
    title: nome,
    phoneUnformatted: phone,
    address: address,
    website: item.json.email ? '' : '',
    city: municipioNome,
    state: uf,
    countryCode: 'BR',
    categoryName: 'receita_federal',
    categories: ['receita_federal'],
    _cnpj: item.json.cnpj || '',
    _tipo_loja: $('mapear_tipo_loja').first().json.tipo_loja || '',
    _fonte: 'receita_federal',
    _situacao: item.json.situacao_cadastral || '',
  };
}

const quantidade_bruta = items.length;
const STATUS_ATIVOS = ['ATIVA'];

const vistos = new Set();
const filtrados = [];

for (const item of items) {
  const json = normalizar_item(item);

  // Filtra só empresas ATIVAS (Receita Federal retorna INAPTA, BAIXADA, etc.)
  if (isReceitaFederal && !STATUS_ATIVOS.includes((item.json.situacao_cadastral || '').toUpperCase())) {
    continue;
  }

  // Filtra por telefone obrigatório
  if (!json.phoneUnformatted) continue;

  const phone = json.phoneUnformatted.replace(/\\D/g, '');
  const chave = json._cnpj || phone || (json.title || '').toLowerCase();
  if (chave && vistos.has(chave)) continue;
  if (chave) vistos.add(chave);

  filtrados.push({ json });
}

if (filtrados.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: quantidade_bruta, _meta_filtrada: 0 } }];
}

return filtrados.map(function(item, idx) {
  return {
    json: Object.assign({}, item.json, {
      _meta_bruta: idx === 0 ? quantidade_bruta : undefined,
      _meta_filtrada: idx === 0 ? filtrados.length : undefined,
    })
  };
});`;

console.log('✓ filtrar_categoria: usa telefone1, filtra ATIVA, descarta INAPTA/BAIXADA');

// ---- 4. ATUALIZAR finalizar_busca ----
const finalizarNode = d.nodes.find(n => n.name === 'finalizar_busca');

finalizarNode.parameters.jsCode = `const allItems = $input.all();
const items = allItems.filter(item => !item.json._sem_resultado);
const quantidadePedida = $('mapear_tipo_loja').first().json._quantidade_pedida || 30;
const reservaCount = $('mapear_tipo_loja').first().json._reserva_count || 0;
const tipoLoja = $('mapear_tipo_loja').first().json.tipo_loja || '';

if (items.length === 0) {
  return [{ json: {
    _sem_resultado: true,
    _total_entregue: reservaCount,
    _tipo_loja: tipoLoja,
    _meta_bruta: allItems[0] ? allItems[0].json._meta_bruta || 0 : 0,
  } }];
}

const targetRF = Math.max(0, quantidadePedida - reservaCount);
const targetComBuffer = Math.ceil(targetRF * 1.5);
const quantidade_entregue = Math.min(items.length, targetRF) + reservaCount;

return items.map(function(item, idx) {
  const json = Object.assign({}, item.json);
  delete json._meta_bruta;
  delete json._meta_filtrada;
  delete json._meta_pedida;
  json._status_final = idx < targetComBuffer ? 'LOCALIZADOS' : 'RESERVA';
  json._tipo_loja = tipoLoja;
  json._total_entregue = quantidade_entregue;
  return { json };
});`;

console.log('✓ finalizar_busca: atualizado');

// ---- 5. CONEXÕES (mapear_tipo_loja → Apify → filtrar_categoria) ----
d.connections['mapear_tipo_loja'].main[0][0].node = 'Run an Actor and get dataset1';
// Apify node já conecta a filtrar_categoria — mantém

console.log('✓ Conexões: mantidas (mapear → Apify → filtrar)');

// ---- 6. SALVAR v26 ----
d.name = 'Fluxo_4g — Dashboard v2 (v26 receita-federal-fixes)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v26_receita_federal.json', output);
console.log('✓ Fluxo_4g_v26_receita_federal.json salvo em Downloads');
console.log('  Tamanho:', (output.length / 1024).toFixed(1), 'KB');

console.log('\n=== FIXES v26 ===');
console.log('1. Campo telefone: telefone1 (era ddd_telefone_1 incorreto)');
console.log('2. IBGE lookup: fetch() em vez de $helpers.httpRequest');
console.log('3. Filtro status: só ATIVA (descarta INAPTA, BAIXADA, etc.)');
