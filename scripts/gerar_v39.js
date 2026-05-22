const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v38_memoria_persistente.json', 'utf8'));

// === v39: Simplificação do fluxo de busca ===
// REMOVE: mapear_tipo_loja (listas APPROVED/DENIED complexas)
// REMOVE: filtrar_categoria (filtro por categoria de negócio)
// ADICIONA: definir_termos (apenas mapeia tipo_loja → termos de busca)
// ADICIONA: filtrar_whatsapp (apenas garante que o lead tem telefone)

// -------------------------------------------------------
// 1. Substituir nó mapear_tipo_loja → definir_termos
// -------------------------------------------------------
const codigoDefinirTermos = `const body = $input.first().json.body;
const tipoLoja = body.tipo_loja || '';
const cidade = body.cidade || '';
const estado = body.estado || '';
const quantidade = parseInt(body.quantidade) || 30;

const TERMOS = {
  'Lojas de artigos esportivos': [
    'loja de artigos esportivos','loja de material esportivo','loja esportiva',
    'equipamentos esportivos','sport shop','loja multiesportes',
    'artigos de futebol loja','bola esportiva loja','loja de beach tennis',
    'loja de patins','loja de surf skate',
  ],
  'Lojas de brinquedos': [
    'loja de brinquedos','brinquedos infantis','loja de jogos e brinquedos',
    'toy store','artigos infantis loja',
  ],
  'Eletroportáteis/eletrônicos': [
    'loja de eletrônicos','loja de eletrodomésticos','loja de celulares',
    'loja de informática','loja de games','eletrodomésticos loja',
  ],
  'Lojas de Variedades/1,99/miudezas/bazares': [
    'loja de variedades','loja 1,99','miudezas','bazar',
    'utilidades domésticas loja','loja de utilidades','loja de presentes','armarinho',
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

const nodeMTL = d.nodes.find(n => n.name === 'mapear_tipo_loja');
nodeMTL.name = 'definir_termos';
nodeMTL.parameters.jsCode = codigoDefinirTermos;
console.log('✓ mapear_tipo_loja renomeado para definir_termos + código simplificado');

// -------------------------------------------------------
// 2. Substituir nó filtrar_categoria → filtrar_whatsapp
// -------------------------------------------------------
const codigoFiltrarWhatsapp = `const allItems = $input.all();
const quantidade_bruta = allItems.length;

const comTelefone = allItems.filter(item => {
  const tel = (item.json.phone || item.json.phoneUnformatted || '').replace(/\\D/g, '');
  return tel.length >= 10;
});

if (comTelefone.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: quantidade_bruta, _meta_filtrada: 0 } }];
}

return comTelefone.map((item, idx) => ({
  json: Object.assign({}, item.json, {
    _meta_bruta: idx === 0 ? quantidade_bruta : undefined,
    _meta_filtrada: idx === 0 ? comTelefone.length : undefined,
  })
}));`;

const nodeFC = d.nodes.find(n => n.name === 'filtrar_categoria');
nodeFC.name = 'filtrar_whatsapp';
nodeFC.parameters.jsCode = codigoFiltrarWhatsapp;
console.log('✓ filtrar_categoria renomeado para filtrar_whatsapp + código simplificado');

// -------------------------------------------------------
// 3. Atualizar parâmetros do nó Apify (referencia mapear_tipo_loja)
// -------------------------------------------------------
const apify = d.nodes.find(n => n.name === 'Run an Actor and get dataset1');
apify.parameters.customBody = apify.parameters.customBody.replaceAll('mapear_tipo_loja', 'definir_termos');
console.log('✓ Apify node atualizado para referenciar definir_termos');

// -------------------------------------------------------
// 4. Atualizar finalizar_busca (referencia mapear_tipo_loja)
// -------------------------------------------------------
const nodeFin = d.nodes.find(n => n.name === 'finalizar_busca');
nodeFin.parameters.jsCode = nodeFin.parameters.jsCode.replaceAll('mapear_tipo_loja', 'definir_termos');
console.log('✓ finalizar_busca atualizado para referenciar definir_termos');

// -------------------------------------------------------
// 5. Atualizar patch_busca_concluida (referencia filtrar_categoria)
// -------------------------------------------------------
const nodePatch = d.nodes.find(n => n.name === 'patch_busca_concluida');
nodePatch.parameters.jsonBody = nodePatch.parameters.jsonBody.replaceAll('filtrar_categoria', 'filtrar_whatsapp');
console.log('✓ patch_busca_concluida atualizado para referenciar filtrar_whatsapp');

// -------------------------------------------------------
// 6. Atualizar chaves das conexões (nomes dos nós como chave)
// -------------------------------------------------------
d.connections['definir_termos'] = d.connections['mapear_tipo_loja'];
delete d.connections['mapear_tipo_loja'];

d.connections['filtrar_whatsapp'] = d.connections['filtrar_categoria'];
delete d.connections['filtrar_categoria'];

console.log('✓ Chaves de conexão renomeadas');

// -------------------------------------------------------
// 7. Atualizar targets de conexão em todos os nós
// -------------------------------------------------------
for (const conn of Object.values(d.connections)) {
  for (const outputs of (conn.main || [])) {
    for (const dest of (outputs || [])) {
      if (dest.node === 'mapear_tipo_loja') dest.node = 'definir_termos';
      if (dest.node === 'filtrar_categoria') dest.node = 'filtrar_whatsapp';
    }
  }
}
console.log('✓ Targets de conexão atualizados');

// -------------------------------------------------------
// Salvar
// -------------------------------------------------------
d.name = 'Fluxo_4g — Dashboard v2 (v39 simplificado)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v39_simplificado.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v39_simplificado.json salvo em Downloads');

// -------------------------------------------------------
// Verificação
// -------------------------------------------------------
const temDefinirTermos    = d.nodes.some(n => n.name === 'definir_termos');
const temFiltrarWhatsapp  = d.nodes.some(n => n.name === 'filtrar_whatsapp');
const temMapearTipoLoja   = d.nodes.some(n => n.name === 'mapear_tipo_loja');
const temFiltrarCategoria = d.nodes.some(n => n.name === 'filtrar_categoria');

const conexReserva = d.connections['reserva_suficiente']?.main?.[1]?.[0]?.node;
const conexApify   = d.connections['definir_termos']?.main?.[0]?.[0]?.node;
const conexFiltra  = d.connections['Run an Actor and get dataset1']?.main?.[0]?.[0]?.node;
const conexFinal   = d.connections['filtrar_whatsapp']?.main?.[0]?.[0]?.node;

const apifyRef     = d.nodes.find(n => n.name === 'Run an Actor and get dataset1')?.parameters?.customBody || '';
const patchRef     = d.nodes.find(n => n.name === 'patch_busca_concluida')?.parameters?.jsonBody || '';
const finalRef     = d.nodes.find(n => n.name === 'finalizar_busca')?.parameters?.jsCode || '';

console.log('\n=== VERIFICACAO ===');
console.log('definir_termos existe:',    temDefinirTermos    ? '✓' : '✗');
console.log('filtrar_whatsapp existe:',  temFiltrarWhatsapp  ? '✓' : '✗');
console.log('mapear_tipo_loja removido:', !temMapearTipoLoja  ? '✓' : '✗ (ainda existe!)');
console.log('filtrar_categoria removido:', !temFiltrarCategoria ? '✓' : '✗ (ainda existe!)');
console.log('reserva_suficiente[1] → definir_termos:', conexReserva === 'definir_termos' ? '✓' : `✗ (${conexReserva})`);
console.log('definir_termos → Run an Actor:', conexApify === 'Run an Actor and get dataset1' ? '✓' : `✗ (${conexApify})`);
console.log('Run an Actor → filtrar_whatsapp:', conexFiltra === 'filtrar_whatsapp' ? '✓' : `✗ (${conexFiltra})`);
console.log('filtrar_whatsapp → finalizar_busca:', conexFinal === 'finalizar_busca' ? '✓' : `✗ (${conexFinal})`);
console.log('Apify sem ref mapear_tipo_loja:', !apifyRef.includes('mapear_tipo_loja') ? '✓' : '✗');
console.log('patch sem ref filtrar_categoria:', !patchRef.includes('filtrar_categoria') ? '✓' : '✗');
console.log('finalizar_busca sem ref mapear_tipo_loja:', !finalRef.includes('mapear_tipo_loja') ? '✓' : '✗');
