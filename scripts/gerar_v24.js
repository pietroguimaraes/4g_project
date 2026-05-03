const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v23_salva_todos.json', 'utf8'));

// =============================================================
// v24 — Migração de Apify/Google Maps para Brasil.io (CNPJ)
//
// PROBLEMA v22/v23:
//   Apify retornava resultados do Google Maps onde 69% das empresas
//   não tinham telefone cadastrado. Ao solicitar 20 leads, apenas 4-6
//   chegavam ao dashboard, pois o code_in_java descartava os sem celular.
//
// SOLUÇÃO v24:
//   Substitui o node Apify por chamadas à API gratuita do Brasil.io,
//   que consulta a base CNPJ da Receita Federal filtrada por:
//     - CNAE (código de atividade econômica — equivalente ao tipo de loja)
//     - Município (cidade normalizada)
//     - situacao_cadastral = ATIVA
//     - Apenas registros COM telefone
//
//   Resultado esperado: 100% dos leads retornados têm telefone cadastrado.
//
// PRÉ-REQUISITO:
//   Criar conta gratuita em brasil.io e configurar o token no n8n:
//     Settings > Variables > BRASILIO_API_TOKEN = <seu_token>
//
// CNAES mapeados:
//   Lojas de artigos esportivos  → 4763602
//   Lojas de brinquedos          → 4763601
//   Papelaria                    → 4761002
//   Lojas de Variedades/1,99...  → 4789099, 4713002
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
  'Lojas de Variedades/1,99/miudezas/bazares': ['4789099', '4713002'],
};

function normalizarCidade(str) {
  return str.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
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
  'selaria','arreios','leather goods',
  'piscinas','pool contractor',
  'alimentos','mercearia','açougue','food manufacturer',
  'tecidos','costura',
];

const cnaes = CNAES[tipoLoja] || CNAES['Lojas de Variedades/1,99/miudezas/bazares'];
const approvedCategories = APPROVED[tipoLoja] || APPROVED['Lojas de Variedades/1,99/miudezas/bazares'];
const deniedCategories = DENIED_GLOBAL;
const municipio_brasilio = normalizarCidade(cidade);
const locationQuery = cidade + ', ' + estado + ', Brasil';

const buscarQtd = quantidade;
const perSearch = Math.max(Math.ceil(buscarQtd / 3), 2);
const maxResults = quantidade;

return [{ json: {
  cnaes,
  approvedCategories,
  deniedCategories,
  municipio_brasilio,
  locationQuery,
  quantidade,
  buscarQtd,
  perSearch,
  maxResults,
  tipo_loja: tipoLoja,
  ...body,
} }];`;

console.log('✓ mapear_tipo_loja: CNAES + normalizarCidade adicionados');

// ---- 2. SUBSTITUIR node Apify por buscar_cnpj ----
const apifyIdx = d.nodes.findIndex(n => n.name === 'Run an Actor and get dataset1');
const apifyPos  = d.nodes[apifyIdx].position;
const apifyId   = d.nodes[apifyIdx].id;

d.nodes[apifyIdx] = {
  parameters: {
    jsCode: `const data = $input.first().json;
const cnaes = data.cnaes || [];
const municipio = data.municipio_brasilio || '';
const quantidade = parseInt(data.quantidade) || 30;
const tipoLoja = data.tipo_loja || '';

// Crie conta gratuita em brasil.io e configure:
//   n8n > Settings > Variables > BRASILIO_API_TOKEN = <seu_token>
const token = $env.BRASILIO_API_TOKEN || '';
if (!token) {
  throw new Error('Configure BRASILIO_API_TOKEN em n8n > Settings > Variables.');
}

const qtdPorCnae = Math.ceil((quantidade * 2) / Math.max(cnaes.length, 1));
const allResults = [];
const visited = new Set();

for (const cnae of cnaes) {
  let response;
  try {
    response = await $helpers.httpRequest({
      method: 'GET',
      url: 'https://brasil.io/api/dataset/cnpj/companies/data/',
      headers: {
        'Authorization': 'Token ' + token,
        'Accept': 'application/json',
      },
      qs: {
        cnae_fiscal: cnae,
        municipio: municipio,
        situacao_cadastral: 'ATIVA',
        page_size: Math.min(qtdPorCnae, 100),
        format: 'json',
      },
    });
  } catch (e) {
    continue; // cidade sem resultados para este CNAE
  }

  for (const item of (response.results || [])) {
    const phone = (item.telefone1 || '').replace(/\\D/g, '');
    if (!phone) continue; // sem telefone — descarta

    const key = item.cnpj || phone;
    if (visited.has(key)) continue;
    visited.add(key);

    const nome = (item.nome_fantasia && item.nome_fantasia.trim())
      ? item.nome_fantasia
      : item.razao_social;

    allResults.push({
      json: {
        title: nome,
        phoneUnformatted: phone,
        address: [item.logradouro, item.numero, item.bairro, item.municipio, item.uf]
          .filter(Boolean).join(', '),
        website: '',
        categoryName: 'cnae_' + cnae,
        categories: ['cnae_' + cnae],
        _cnpj: item.cnpj,
        _tipo_loja: tipoLoja,
      }
    });
  }
}

if (allResults.length === 0) {
  return [{ json: { _sem_resultado: true, title: '', phoneUnformatted: '', _cnpj: '' } }];
}

return allResults;`,
  },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: apifyPos,
  id: apifyId,
  name: 'buscar_cnpj',
  onError: 'continueRegularOutput',
};
console.log('✓ buscar_cnpj: node Apify substituído por Brasil.io CNPJ');

// ---- 3. ATUALIZAR filtrar_categoria ----
const filtrarNode = d.nodes.find(n => n.name === 'filtrar_categoria');

filtrarNode.parameters.jsCode = `const items = $input.all();
const approvedCategories = $('mapear_tipo_loja').first().json.approvedCategories || [];
const deniedCategories = $('mapear_tipo_loja').first().json.deniedCategories || [];
const quantidade_bruta = items.filter(i => !i.json._sem_resultado).length;

// Dados do Brasil.io (CNPJ) já filtrados por CNAE — pula classificação por categoria
const isCnpjData = items.length > 0 && items[0].json._cnpj !== undefined;

function classificar(item) {
  if (isCnpjData) return true;
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
const filtrados = [];
for (const item of items) {
  if (item.json._sem_resultado) continue;
  if (!classificar(item)) continue;
  const phone = (item.json.phoneUnformatted || '').replace(/\\D/g, '');
  const chave = phone || (item.json.title || '').toLowerCase();
  if (chave && vistos.has(chave)) continue;
  if (chave) vistos.add(chave);
  filtrados.push(item);
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

console.log('✓ filtrar_categoria: detecta dados CNPJ e pula filtro de categoria');

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

const targetApify = Math.max(0, quantidadePedida - reservaCount);
const targetComBuffer = Math.ceil(targetApify * 1.5);
const quantidade_entregue = Math.min(items.length, targetApify) + reservaCount;

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

console.log('✓ finalizar_busca: filtra sentinels _sem_resultado');

// ---- 5. ATUALIZAR conexões ----
d.connections['mapear_tipo_loja'].main[0][0].node = 'buscar_cnpj';
d.connections['buscar_cnpj'] = d.connections['Run an Actor and get dataset1'];
delete d.connections['Run an Actor and get dataset1'];
console.log('✓ Conexões: mapear_tipo_loja → buscar_cnpj → filtrar_categoria');

// ---- 6. SALVAR v24 ----
d.name = 'Fluxo_4g — Dashboard v2 (v24 brasilio-cnpj)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v24_brasilio.json', output);
console.log('✓ Fluxo_4g_v24_brasilio.json salvo em Downloads');
console.log('  Tamanho:', (output.length / 1024).toFixed(1), 'KB');

console.log('\n=== RESUMO v24 ===');
console.log('Fonte de leads: Brasil.io (CNPJ Receita Federal) em vez de Google Maps');
console.log('Filtro na origem: telefone obrigatório, situação ATIVA, CNAE exato');
console.log('Custo: R$ 0 (Brasil.io gratuito)');
console.log('');
console.log('AÇÃO NECESSÁRIA antes de importar:');
console.log('  1. Crie conta em https://brasil.io/auth/login/');
console.log('  2. Copie seu API token');
console.log('  3. n8n > Settings > Variables > Adicionar:');
console.log('     Nome: BRASILIO_API_TOKEN');
console.log('     Valor: <seu_token>');
