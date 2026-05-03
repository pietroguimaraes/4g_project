const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v23_salva_todos.json', 'utf8'));

// =============================================================
// v25 — Troca Apify Google Maps por Apify Receita Federal CNPJ
//
// PROBLEMA v22/v23:
//   Google Maps: 69% dos resultados sem telefone cadastrado.
//   Ao pedir 20 leads, chegavam 4-6 ao dashboard.
//
// SOLUÇÃO v25:
//   Substitui o actor compass/crawler-google-places pelo actor
//   jungle_synthesizer/brazil-cnpj-receita-federal-crawler que:
//     - Busca direto da base oficial da Receita Federal
//     - Filtra por CNAE exato + código IBGE do município
//     - Retorna ddd_telefone_1 (telefone registrado fiscalmente)
//     - Telefone mais confiável: obrigatório na abertura de CNPJ
//
//   O IBGE code da cidade é buscado automaticamente via API do IBGE
//   (mesmo endpoint que o frontend já usa no dropdown de cidades).
//
// CONTA APIFY: usa as credenciais já configuradas no n8n (sem novo cadastro).
//
// CNAES mapeados:
//   Lojas de artigos esportivos  → 4763602
//   Lojas de brinquedos          → 4763601
//   Papelaria                    → 4761002
//   Lojas de Variedades/1,99...  → 4789099 (principal), 4713002 (secundário)
// =============================================================

// ---- 1. ATUALIZAR mapear_tipo_loja (adiciona CNAES + lookup IBGE) ----
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
  return str.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
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

// Busca código IBGE do município (necessário para o actor da Receita Federal)
let ibge_code = '';
try {
  const municipios = await $helpers.httpRequest({
    method: 'GET',
    url: 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + estado + '/municipios',
  });
  const mun = municipios.find(function(m) {
    return normalizar(m.nome) === normalizar(cidade);
  });
  ibge_code = mun ? String(mun.id) : '';
} catch(e) {
  ibge_code = '';
}

const locationQuery = cidade + ', ' + estado + ', Brasil';
const buscarQtd = quantidade;
const perSearch = Math.max(Math.ceil(buscarQtd / 3), 2);
const maxResults = quantidade;

return [{ json: {
  cnaes,
  ibge_code,
  approvedCategories,
  deniedCategories,
  locationQuery,
  quantidade,
  buscarQtd,
  perSearch,
  maxResults,
  tipo_loja: tipoLoja,
  cidade,
  estado,
  ...body,
} }];`;

console.log('✓ mapear_tipo_loja: CNAES + lookup IBGE adicionados');

// ---- 2. TROCAR o actor Apify: Google Maps → Receita Federal ----
const apifyNode = d.nodes.find(n => n.name === 'Run an Actor and get dataset1');

apifyNode.parameters.actorId = {
  __rl: true,
  value: 'jungle_synthesizer~brazil-cnpj-receita-federal-crawler',
  mode: 'id',
  cachedResultName: 'Brazil CNPJ Receita Federal Scraper',
  cachedResultUrl: 'https://console.apify.com/actors/jungle_synthesizer~brazil-cnpj-receita-federal-crawler/input',
};

// Remove campos legados do Google Maps
delete apifyNode.parameters.actorSource;
delete apifyNode.parameters.operation;
apifyNode.parameters.operation = 'Run actor and get dataset';

apifyNode.parameters.customBody = "={{ JSON.stringify({\n  cnae: $('mapear_tipo_loja').item.json.cnaes[0],\n  municipio: $('mapear_tipo_loja').item.json.ibge_code,\n  maxItems: $('mapear_tipo_loja').item.json.quantidade * 3\n}) }}";

console.log('✓ Apify node: actor trocado para Receita Federal CNPJ');

// ---- 3. ATUALIZAR filtrar_categoria (detecta campos RF + normaliza) ----
const filtrarNode = d.nodes.find(n => n.name === 'filtrar_categoria');

filtrarNode.parameters.jsCode = `const items = $input.all();
const approvedCategories = $('mapear_tipo_loja').first().json.approvedCategories || [];
const deniedCategories = $('mapear_tipo_loja').first().json.deniedCategories || [];

// Detecta se é dado da Receita Federal (campo ddd_telefone_1 ou razao_social)
const isReceitaFederal = items.length > 0 && (
  items[0].json.ddd_telefone_1 !== undefined ||
  items[0].json.razao_social !== undefined
);

// Normaliza campos da Receita Federal para o formato padrão do fluxo
function normalizar_item(item) {
  if (!isReceitaFederal) return item.json;

  const ddd = (item.json.ddd_telefone_1 || '').replace(/\\D/g, '');
  const nome = (item.json.nome_fantasia && item.json.nome_fantasia.trim())
    ? item.json.nome_fantasia
    : (item.json.razao_social || '');

  // municipio pode vir como código numérico ou nome — tenta usar o nome da cidade do mapear
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
    phoneUnformatted: ddd,
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
  };
}

const quantidade_bruta = items.length;

function classificar(json) {
  // Dados RF já filtrados por CNAE — passa tudo
  if (isReceitaFederal) return true;
  const catText = [
    json.categoryName || '',
    ...(json.categories || []),
  ].join(' ').toLowerCase();
  const titulo = (json.title || '').toLowerCase();
  const tudo = catText + ' ' + titulo;
  if (approvedCategories.some(function(a){ return catText.includes(a.toLowerCase()); })) return true;
  if (deniedCategories.some(function(d){ return tudo.includes(d.toLowerCase()); })) return false;
  return approvedCategories.some(function(a){ return titulo.includes(a.toLowerCase()); });
}

const vistos = new Set();
const filtrados = [];

for (const item of items) {
  const json = normalizar_item(item);
  if (!json.phoneUnformatted) continue; // sem telefone — descarta direto
  if (!classificar(json)) continue;

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

console.log('✓ filtrar_categoria: normaliza campos Receita Federal');

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

// ---- 5. SALVAR v25 ----
d.name = 'Fluxo_4g — Dashboard v2 (v25 receita-federal-cnpj)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v25_receita_federal.json', output);
console.log('✓ Fluxo_4g_v25_receita_federal.json salvo em Downloads');
console.log('  Tamanho:', (output.length / 1024).toFixed(1), 'KB');

console.log('\n=== RESUMO v25 ===');
console.log('Actor: jungle_synthesizer/brazil-cnpj-receita-federal-crawler');
console.log('Filtros: CNAE exato + código IBGE do município');
console.log('Conta: Apify já configurada no n8n (sem novo cadastro)');
console.log('Campos: ddd_telefone_1, razao_social, nome_fantasia, logradouro...');
console.log('');
console.log('Fluxo:');
console.log('  receber_busca → verificar_reserva → calcular_estrategia');
console.log('  → mapear_tipo_loja (CNAE + lookup IBGE)');
console.log('  → Run an Actor (Receita Federal scraper)');
console.log('  → filtrar_categoria (normaliza campos RF → padrão)');
console.log('  → finalizar_busca → code_in_java → edit_fields → salvar');
