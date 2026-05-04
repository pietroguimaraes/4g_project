const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v23_salva_todos.json', 'utf8'));

// =============================================================
// v28 — Fix crítico: mapear_tipo_loja lia $input (= IBGE data)
//
// Bug v27:
//   mapear_tipo_loja usa $input.first().json.body para obter
//   tipo_loja / cidade / estado / quantidade.
//   Mas após a inserção do node buscar_ibge_municipios entre
//   reserva_suficiente e mapear_tipo_loja, $input agora aponta
//   para a resposta do IBGE (array de municípios), não para o
//   body do webhook.
//   Resultado: tipo_loja = '', cidade = '', estado = '' → actor
//   RF não filtra por CNAE nem por município → resultados errados.
//
// Fix v28:
//   mapear_tipo_loja lê o body via $('reserva_suficiente').first().json
//   (node que ainda tem o webhook body intacto).
//   $input é usado apenas para confirmar que chegou alguma entrada.
//
// Demais mudanças: idênticas ao v27.
// =============================================================

// ---- 1. ADICIONAR node HTTP Request para IBGE ----
const ibgeNode = {
  parameters: {
    method: 'GET',
    url: '=https://servicodados.ibge.gov.br/api/v1/localidades/estados/{{ $json.body.estado }}/municipios',
    options: {},
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [11100, 10480],
  id: 'buscar-ibge-municipios-v28',
  name: 'buscar_ibge_municipios',
  onError: 'continueRegularOutput',
};

d.nodes.push(ibgeNode);
console.log('✓ Node buscar_ibge_municipios adicionado');

// ---- 2. ATUALIZAR mapear_tipo_loja ----
// FIX: lê body de $('reserva_suficiente'), não de $input
const mapearNode = d.nodes.find(n => n.name === 'mapear_tipo_loja');

mapearNode.parameters.jsCode = `// FIX v28: body vem de reserva_suficiente, não de $input
// ($input agora aponta para buscar_ibge_municipios = dados IBGE)
const bodyRaw = $('reserva_suficiente').first().json;
const body = bodyRaw.body || bodyRaw;

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

// Lê lista de municípios do node HTTP Request
let ibge_code = '';
try {
  const ibgeData = $('buscar_ibge_municipios').first().json;
  const municipios = Array.isArray(ibgeData) ? ibgeData : [];
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

console.log('✓ mapear_tipo_loja: lê body de reserva_suficiente (fix $input bug)');

// ---- 3. TROCAR actor Apify: Google Maps → Receita Federal ----
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

apifyNode.parameters.customBody = "={{ JSON.stringify(Object.assign(\n  { cnae: $('mapear_tipo_loja').item.json.cnaes[0], maxItems: $('mapear_tipo_loja').item.json.quantidade * 5 },\n  $('mapear_tipo_loja').item.json.ibge_code\n    ? { municipio: $('mapear_tipo_loja').item.json.ibge_code }\n    : { state: $('mapear_tipo_loja').item.json.estado }\n)) }}";

console.log('✓ Apify node: actor RF, municipio ou estado como fallback, maxItems 5x');

// ---- 4. ATUALIZAR filtrar_categoria ----
const filtrarNode = d.nodes.find(n => n.name === 'filtrar_categoria');

filtrarNode.parameters.jsCode = `const items = $input.all();
const approvedCategories = $('mapear_tipo_loja').first().json.approvedCategories || [];
const deniedCategories = $('mapear_tipo_loja').first().json.deniedCategories || [];

const isReceitaFederal = items.length > 0 && (
  items[0].json.telefone1 !== undefined ||
  items[0].json.razao_social !== undefined
);

function normalizar_item(item) {
  if (!isReceitaFederal) return item.json;

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
    website: '',
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
  if (isReceitaFederal) {
    const status = (item.json.situacao_cadastral || '').toUpperCase();
    if (!STATUS_ATIVOS.includes(status)) continue;
  }

  const json = normalizar_item(item);
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

console.log('✓ filtrar_categoria: usa telefone1, filtra ATIVA');

// ---- 5. ATUALIZAR finalizar_busca ----
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

// ---- 6. ATUALIZAR CONEXÕES ----
d.connections['reserva_suficiente'].main[1][0].node = 'buscar_ibge_municipios';

d.connections['buscar_ibge_municipios'] = {
  main: [[{ node: 'mapear_tipo_loja', type: 'main', index: 0 }]],
};

d.connections['mapear_tipo_loja'].main[0][0].node = 'Run an Actor and get dataset1';

console.log('✓ Conexões: reserva_suficiente → buscar_ibge → mapear_tipo_loja → Apify');

// ---- 7. SALVAR v28 ----
d.name = 'Fluxo_4g — Dashboard v2 (v28 fix-input-bug)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v28_receita_federal.json', output);
console.log('✓ Fluxo_4g_v28_receita_federal.json salvo em Downloads');
console.log('  Tamanho:', (output.length / 1024).toFixed(1), 'KB');

console.log('\n=== FIXES v28 ===');
console.log('1. BUG CRITICO CORRIGIDO: mapear_tipo_loja agora lê body via');
console.log('   $("reserva_suficiente").first().json (em vez de $input)');
console.log('   → tipo_loja, cidade, estado, quantidade corretos');
console.log('2. IBGE lookup: node HTTP Request dedicado (100% confiável)');
console.log('3. Fallback: se IBGE falhar, filtra por estado (UF)');
console.log('4. maxItems: 5x quantidade');
