// Base compartilhada pelos scripts v31, v32, v33
// Aplicar ANTES das mudanças específicas de cada versão.

module.exports = function aplicarBase(d, versao) {
  // Remove node IBGE caso exista
  d.nodes = d.nodes.filter(n => n.name !== 'buscar_ibge_municipios');
  delete d.connections['buscar_ibge_municipios'];
  if (d.connections['reserva_suficiente']?.main?.[1]) {
    d.connections['reserva_suficiente'].main[1][0].node = 'mapear_tipo_loja';
  }

  // Garante actor = Google Maps
  const apifyNode = d.nodes.find(n => n.name === 'Run an Actor and get dataset1');
  apifyNode.parameters.actorId = {
    __rl: true,
    value: 'nwua9Gu5YrADL7ZDj',
    mode: 'list',
    cachedResultName: 'Google Maps Scraper (compass/crawler-google-places)',
    cachedResultUrl: 'https://console.apify.com/actors/nwua9Gu5YrADL7ZDj/input',
  };
  delete apifyNode.parameters.actorSource;
  apifyNode.parameters.operation = 'Run actor and get dataset';

  // Conexão mapear → Apify
  d.connections['mapear_tipo_loja'].main[0][0].node = 'Run an Actor and get dataset1';

  // filtrar_categoria: phone prioritization
  const filtrarNode = d.nodes.find(n => n.name === 'filtrar_categoria');
  filtrarNode.parameters.jsCode = `const items = $input.all();
const approvedCategories = $('mapear_tipo_loja').first().json.approvedCategories || [];
const deniedCategories = $('mapear_tipo_loja').first().json.deniedCategories || [];
const quantidade_bruta = items.length;

function normalizar(str) {
  return (str || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
}

function classificar(item) {
  const catText = [item.json.categoryName || '', ...(item.json.categories || [])].join(' ').toLowerCase();
  const titulo = (item.json.title || '').toLowerCase();
  const tudo = catText + ' ' + titulo;
  if (approvedCategories.some(a => catText.includes(a.toLowerCase()))) return true;
  if (deniedCategories.some(d => tudo.includes(d.toLowerCase()))) return false;
  return approvedCategories.some(a => titulo.includes(a.toLowerCase()));
}

const cidadeReq = normalizar($('mapear_tipo_loja').first().json.cidade || '');

const vistos = new Set();
const comTelCidade = [], comTelEstado = [], semTel = [];

for (const item of items) {
  if (!classificar(item)) continue;
  const phone = (item.json.phoneUnformatted || '').replace(/\\D/g, '');
  const chave = phone || (item.json.title || '').toLowerCase();
  if (chave && vistos.has(chave)) continue;
  if (chave) vistos.add(chave);

  const cidadeItem = normalizar(item.json.city || item.json.cidade || '');
  const isCidade = cidadeReq && cidadeItem.includes(cidadeReq);

  if (phone && isCidade)   comTelCidade.push(item);
  else if (phone)          comTelEstado.push(item);
  else                     semTel.push(item);
}

// Prioridade: cidade+tel → estado+tel → sem tel
const filtrados = [...comTelCidade, ...comTelEstado, ...semTel];
if (filtrados.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: quantidade_bruta, _meta_filtrada: 0 } }];
}
return filtrados.map((item, idx) => ({
  json: Object.assign({}, item.json, {
    _meta_bruta: idx === 0 ? quantidade_bruta : undefined,
    _meta_filtrada: idx === 0 ? filtrados.length : undefined,
  })
}));`;

  // finalizar_busca: buffer 1.5x
  const finalizarNode = d.nodes.find(n => n.name === 'finalizar_busca');
  finalizarNode.parameters.jsCode = `const allItems = $input.all();
const items = allItems.filter(i => !i.json._sem_resultado);
const quantidadePedida = $('mapear_tipo_loja').first().json._quantidade_pedida || $('mapear_tipo_loja').first().json.quantidade || 30;
const reservaCount = $('mapear_tipo_loja').first().json._reserva_count || 0;
const tipoLoja = $('mapear_tipo_loja').first().json.tipo_loja || '';

if (items.length === 0) {
  return [{ json: { _sem_resultado: true, _total_entregue: reservaCount, _tipo_loja: tipoLoja,
    _meta_bruta: allItems[0] ? allItems[0].json._meta_bruta || 0 : 0 } }];
}

const targetNovo = Math.max(0, quantidadePedida - reservaCount);
const targetComBuffer = Math.ceil(targetNovo * 1.5);
const quantidade_entregue = Math.min(items.length, targetNovo) + reservaCount;

return items.slice(0, targetComBuffer).map((item, idx) => {
  const json = Object.assign({}, item.json);
  delete json._meta_bruta; delete json._meta_filtrada; delete json._meta_pedida;
  json._status_final = idx < targetNovo ? 'LOCALIZADOS' : 'RESERVA';
  json._tipo_loja = tipoLoja;
  json._total_entregue = quantidade_entregue;
  return { json };
});`;

  console.log('[base] Nodes e filtros base aplicados');
  return { apifyNode };
};
