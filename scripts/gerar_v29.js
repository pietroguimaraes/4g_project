const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v23_salva_todos.json', 'utf8'));

// =============================================================
// v29 — Volta ao Google Maps com estratégia de busca correta
//
// Problemas v24-v28 (Receita Federal): retornou 1 lead em vez de 7.
// A abordagem RF foi descartada — Google Maps dava 7/10.
//
// Problemas identificados no v23 base (Google Maps):
//   1. maxResults = quantidade (hard cap igual ao pedido)
//      → se pede 10, busca 10, filtros reduzem para 7 = perde 3
//   2. perSearch = ceil(quantidade / nStrings)
//      → com 7 strings e quantidade=10: perSearch=2, absurdamente baixo
//   3. Sem categoryFilterWords no actor — Google Maps não pré-filtra
//      por categoria, aceita qualquer tipo de estabelecimento
//   4. filtrar_categoria não prioriza itens com telefone
//      → finalizar_busca pega os N primeiros, sem garantia de ter phone
//
// Solução v29:
//   1. maxResults = quantidade * 4 (buffer de 4x)
//   2. perSearch = max(ceil(maxResults / nStrings), 5)
//   3. categoryFilterWords por tipo_loja → pré-filtro no actor
//   4. filtrar_categoria prioriza items COM telefone
//   5. finalizar_busca limita ao quantidade pedido
// =============================================================

// Remove qualquer node de IBGE que tenha sido adicionado em v27/v28
d.nodes = d.nodes.filter(n => n.name !== 'buscar_ibge_municipios');
// Restaura conexão reserva_suficiente[false] → mapear_tipo_loja (era assim no v23)
if (d.connections['reserva_suficiente']?.main?.[1]) {
  d.connections['reserva_suficiente'].main[1][0].node = 'mapear_tipo_loja';
}
delete d.connections['buscar_ibge_municipios'];
console.log('✓ Node buscar_ibge_municipios removido, conexões restauradas');

// ---- 1. ATUALIZAR mapear_tipo_loja ----
const mapearNode = d.nodes.find(n => n.name === 'mapear_tipo_loja');

mapearNode.parameters.jsCode = `const body = $input.first().json.body;
const tipoLoja = body.tipo_loja || '';
const cidade = body.cidade || '';
const estado = body.estado || '';
const quantidade = parseInt(body.quantidade) || 30;

const SEARCH_STRINGS = {
  'Lojas de artigos esportivos': [
    'loja de artigos esportivos',
    'loja de bicicletas',
    'loja de pesca esportiva',
    'artigos de futebol loja',
    'loja de roupas esportivas',
    'loja de surf skate',
    'loja de material esportivo',
  ],
  'Lojas de brinquedos': [
    'loja de brinquedos',
    'loja de artigos infantis',
    'loja de jogos infantis',
    'loja de hobby',
  ],
  'Eletroportáteis/eletrônicos': [
    'loja de eletrônicos',
    'loja de eletrodomésticos',
    'loja de celulares',
    'loja de informática',
  ],
  'Papelaria': [
    'papelaria',
    'loja de material escolar',
  ],
  'Lojas de Variedades/1,99/miudezas/bazares': [
    'loja de variedades',
    'bazar',
    'armarinho',
    'utilidades domésticas loja',
    'casa e cozinha loja',
    'loja 1,99',
    'loja de presentes',
  ],
};

// Pré-filtro por categoria no Google Maps (reduz ruído antes da busca)
const CATEGORY_FILTER_WORDS = {
  'Lojas de artigos esportivos': [
    'sporting goods store','sport store','bicycle store','fishing store',
    'surf shop','skate shop','loja esportiva','artigos esportivos',
  ],
  'Lojas de brinquedos': [
    'toy store','hobby shop','loja de brinquedos','loja infantil',
  ],
  'Eletroportáteis/eletrônicos': [
    'electronics store','cell phone store','computer store','appliance store',
    'loja de eletrônicos','loja de celulares',
  ],
  'Papelaria': [
    'stationery store','office supply store','book store','papelaria',
  ],
  'Lojas de Variedades/1,99/miudezas/bazares': [
    'variety store','gift shop','home goods store','dollar store',
    'bazar','loja de variedades','armarinho',
  ],
};

const APPROVED = {
  'Lojas de artigos esportivos': [
    'artigos esportivos','material esportivo','equipamentos esportivos',
    'sporting goods','loja esportiva',
    'bicicletas','ciclismo','bicycle',
    'pesca esportiva','loja de pesca','fishing store','artigos de pesca',
    'surf','skate','skateboard',
    'roupas esportivas','sportswear','sports clothing',
    'corrida','running',
    'futebol','artigos de futebol','football store',
    'tênis esportivo','calçados esportivos',
  ],
  'Lojas de brinquedos': [
    'brinquedos','toy store','hobby','jogos infantis','loja de jogos','brinquedo',
    'artigos infantis','loja infantil','kids','bonecas','boneca',
  ],
  'Eletroportáteis/eletrônicos': [
    'eletrônicos','electronics','eletrodomésticos','home appliance',
    'celulares','cell phone','informática','computer store',
    'eletroportáteis','appliance store','eletroeletrônicos','games','video game',
  ],
  'Papelaria': [
    'papelaria','stationery','material escolar','office supply','livraria','material de escritório',
  ],
  'Lojas de Variedades/1,99/miudezas/bazares': [
    'variedades','variety store',
    'bazar','bazaar',
    'armarinho',
    'utilidades domésticas','home goods','utilidades',
    'casa e cozinha','cozinha e lar','kitchen',
    'presentes','gift shop',
    'importados','import store',
    '1,99','dollar store','miudezas',
    'loja geral','general store','quinquilharias',
    'bijuterias','bijuteria',
    'loja de desconto','discount store',
  ],
};

const DENIED_GLOBAL = [
  'academia','gym','fitness','crossfit','pilates','yoga',
  'clube','club','arena esportiva','complexo esportivo','sports complex',
  'tiro ao alvo','shooting range',
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

const searchStringsArray = SEARCH_STRINGS[tipoLoja] || SEARCH_STRINGS['Lojas de Variedades/1,99/miudezas/bazares'];
const categoryFilterWords = CATEGORY_FILTER_WORDS[tipoLoja] || CATEGORY_FILTER_WORDS['Lojas de Variedades/1,99/miudezas/bazares'];
const approvedCategories = APPROVED[tipoLoja] || APPROVED['Lojas de Variedades/1,99/miudezas/bazares'];
const locationQuery = cidade + ', ' + estado + ', Brasil';

// Buffer 4x: compensar filtro de categoria + filtro de telefone em code_in_java
const maxResults = quantidade * 4;
const perSearch = Math.max(Math.ceil(maxResults / searchStringsArray.length), 5);

return [{ json: {
  searchStringsArray,
  categoryFilterWords,
  approvedCategories,
  deniedCategories: DENIED_GLOBAL,
  locationQuery,
  quantidade,
  maxResults,
  perSearch,
  tipo_loja: tipoLoja,
  cidade,
  estado,
  ...body,
} }];`;

console.log('✓ mapear_tipo_loja: buffer 4x, categoryFilterWords, perSearch correto');

// ---- 2. ATUALIZAR parâmetros do Apify Google Maps ----
const apifyNode = d.nodes.find(n => n.name === 'Run an Actor and get dataset1');

// Restaura para Google Maps caso tenha sido trocado
apifyNode.parameters.actorId = {
  __rl: true,
  value: 'nwua9Gu5YrADL7ZDj',
  mode: 'list',
  cachedResultName: 'Google Maps Scraper (compass/crawler-google-places)',
  cachedResultUrl: 'https://console.apify.com/actors/nwua9Gu5YrADL7ZDj/input',
};
delete apifyNode.parameters.actorSource;
apifyNode.parameters.operation = 'Run actor and get dataset';

// categoryFilterWords removido: o actor exige enum específica do Google Maps,
// não aceita texto livre. A filtragem por categoria já é feita via searchStringsArray.
apifyNode.parameters.customBody = "={{ JSON.stringify({\n  searchStringsArray: $('mapear_tipo_loja').item.json.searchStringsArray,\n  maxCrawledPlacesPerSearch: $('mapear_tipo_loja').item.json.perSearch,\n  maxResults: $('mapear_tipo_loja').item.json.maxResults,\n  language: 'pt-PT',\n  locationQuery: $('mapear_tipo_loja').item.json.locationQuery\n}) }}";

console.log('✓ Apify: Google Maps restaurado, maxResults 4x (categoryFilterWords removido — enum inválida)');

// ---- 3. ATUALIZAR filtrar_categoria ----
// Prioriza items COM telefone — garantia de leads acionáveis no topo
const filtrarNode = d.nodes.find(n => n.name === 'filtrar_categoria');

filtrarNode.parameters.jsCode = `const items = $input.all();
const approvedCategories = $('mapear_tipo_loja').first().json.approvedCategories || [];
const deniedCategories = $('mapear_tipo_loja').first().json.deniedCategories || [];
const quantidade_bruta = items.length;

function classificar(item) {
  const catText = [
    item.json.categoryName || '',
    ...(item.json.categories || []),
  ].join(' ').toLowerCase();
  const titulo = (item.json.title || '').toLowerCase();
  const tudo = catText + ' ' + titulo;
  if (approvedCategories.some(function(a){ return catText.includes(a.toLowerCase()); })) return true;
  if (deniedCategories.some(function(d){ return tudo.includes(d.toLowerCase()); })) return false;
  return approvedCategories.some(function(a){ return titulo.includes(a.toLowerCase()); });
}

const vistos = new Set();
const comTelefone = [];
const semTelefone = [];

for (const item of items) {
  if (!classificar(item)) continue;

  const phone = (item.json.phoneUnformatted || '').replace(/\\D/g, '');
  const chave = phone || (item.json.title || '').toLowerCase();
  if (chave && vistos.has(chave)) continue;
  if (chave) vistos.add(chave);

  // Prioridade: com telefone primeiro — code_in_java exige celular
  if (phone) {
    comTelefone.push(item);
  } else {
    semTelefone.push(item);
  }
}

// Com telefone primeiro, sem telefone como fallback
const filtrados = [...comTelefone, ...semTelefone];
const quantidade_filtrada = filtrados.length;

if (filtrados.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: quantidade_bruta, _meta_filtrada: 0 } }];
}

return filtrados.map(function(item, idx) {
  return {
    json: Object.assign({}, item.json, {
      _meta_bruta: idx === 0 ? quantidade_bruta : undefined,
      _meta_filtrada: idx === 0 ? quantidade_filtrada : undefined,
    })
  };
});`;

console.log('✓ filtrar_categoria: items com telefone priorizados no topo');

// ---- 4. ATUALIZAR finalizar_busca ----
const finalizarNode = d.nodes.find(n => n.name === 'finalizar_busca');

finalizarNode.parameters.jsCode = `const allItems = $input.all();
const items = allItems.filter(item => !item.json._sem_resultado);
const quantidadePedida = $('mapear_tipo_loja').first().json._quantidade_pedida || $('mapear_tipo_loja').first().json.quantidade || 30;
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

// Quantidade que ainda falta (descontando reserva já ativa)
const targetNovo = Math.max(0, quantidadePedida - reservaCount);
// Buffer 1.5x para compensar filtro de celular no code_in_java
const targetComBuffer = Math.ceil(targetNovo * 1.5);
const quantidade_entregue = Math.min(items.length, targetNovo) + reservaCount;

return items.slice(0, targetComBuffer).map(function(item, idx) {
  const json = Object.assign({}, item.json);
  delete json._meta_bruta;
  delete json._meta_filtrada;
  delete json._meta_pedida;
  json._status_final = idx < targetNovo ? 'LOCALIZADOS' : 'RESERVA';
  json._tipo_loja = tipoLoja;
  json._total_entregue = quantidade_entregue;
  return { json };
});`;

console.log('✓ finalizar_busca: limita ao buffer 1.5x para absorver filtro de celular');

// ---- 5. GARANTIR CONEXÕES corretas (Google Maps, sem IBGE node) ----
d.connections['mapear_tipo_loja'].main[0][0].node = 'Run an Actor and get dataset1';
console.log('✓ Conexões: reserva_suficiente → mapear_tipo_loja → Apify → filtrar → finalizar');

// ---- 6. SALVAR v29 ----
d.name = 'Fluxo_4g — Dashboard v2 (v29 google-maps-buffer4x)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v29_google_maps.json', output);
console.log('✓ Fluxo_4g_v29_google_maps.json salvo em Downloads');
console.log('  Tamanho:', (output.length / 1024).toFixed(1), 'KB');

console.log('\n=== MUDANÇAS v29 ===');
console.log('1. VOLTA Google Maps (RF descartado — dava 1 lead vs 7 do Google Maps)');
console.log('2. maxResults = quantidade * 4 (era = quantidade — hard cap causava falta)');
console.log('3. perSearch = max(ceil(maxResults/nStrings), 5) (era ceil(qtd/nStrings) = 2)');
console.log('4. categoryFilterWords no actor → pré-filtro por categoria ANTES de retornar');
console.log('5. filtrar_categoria: itens COM telefone ficam no topo da lista');
console.log('6. finalizar_busca: buffer 1.5x para absorver filtro de celular do code_in_java');
