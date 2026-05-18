const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v34_maxima_performance.json', 'utf8'));

// === Atualizar mapear_tipo_loja: alinhar filtros com catálogo real da 4G ===
// Catálogo esportivo 4G: bolas (futebol/vôlei/futevôlei/beach tennis), patins,
// patinetes, skate, raquetes beach tennis, mochilas esportivas, kits de proteção.
// REMOVIDOS: pesca, bikes, roupas esportivas, corrida, natação, musculação, camping, artes marciais.

const mapa = d.nodes.find(n => n.name === 'mapear_tipo_loja');
if (!mapa) { console.error('ERRO: nó mapear_tipo_loja não encontrado'); process.exit(1); }

const code = mapa.parameters.jsCode;

// --- 1. Substituir SEARCH_STRINGS para 'Lojas de artigos esportivos' ---
const oldSearchEsportivos = `  'Lojas de artigos esportivos': [
    'loja de artigos esportivos','loja de bicicletas','loja de pesca esportiva',
    'artigos de futebol loja','loja de roupas esportivas','loja de surf skate',
    'loja de material esportivo',
    'esportes loja','sport shop','loja esportiva','equipamentos esportivos',
    'loja de corrida','loja de natação','loja de musculação equipamentos',
    'bola esportiva loja','loja de tênis raquete','loja de camping outdoor',
    'loja de patins rolimã','loja de artes marciais',
    'decathlon','centauro','loja multiesportes',
  ],`;

const newSearchEsportivos = `  'Lojas de artigos esportivos': [
    'loja de artigos esportivos','loja de material esportivo','loja esportiva',
    'equipamentos esportivos','sport shop','esportes loja','loja multiesportes',
    'artigos de futebol loja','bola esportiva loja','loja de beach tennis',
    'loja de patins rolimã','loja de surf skate',
    'decathlon','centauro',
  ],`;

if (!code.includes(oldSearchEsportivos)) {
  console.error('ERRO: SEARCH_STRINGS de artigos esportivos não encontrado — verifique o arquivo fonte');
  process.exit(1);
}
mapa.parameters.jsCode = mapa.parameters.jsCode.replace(oldSearchEsportivos, newSearchEsportivos);
console.log('✓ SEARCH_STRINGS[artigos esportivos]: pesca/bikes/roupas/corrida/natação/camping/artes marciais removidos');

// --- 2. Substituir APPROVED para 'Lojas de artigos esportivos' ---
const oldApprovedEsportivos = `  'Lojas de artigos esportivos': ['artigos esportivos','material esportivo','equipamentos esportivos','sporting goods','loja esportiva','bicicletas','ciclismo','bicycle','pesca esportiva','loja de pesca','fishing store','artigos de pesca','surf','skate','skateboard','roupas esportivas','sportswear','sports clothing','corrida','running','futebol','artigos de futebol','football store','tênis esportivo','calçados esportivos','sport','esporte','outdoor','camping'],`;

const newApprovedEsportivos = `  'Lojas de artigos esportivos': ['artigos esportivos','material esportivo','equipamentos esportivos','sporting goods','loja esportiva','skate','skateboard','futebol','artigos de futebol','football store','sport','esporte','patins','patinete','beach tennis','vôlei','bola esportiva','mochila esportiva','kit esportivo','recreação esportiva'],`;

if (!code.includes(oldApprovedEsportivos)) {
  console.error('ERRO: APPROVED[artigos esportivos] não encontrado — verifique o arquivo fonte');
  process.exit(1);
}
mapa.parameters.jsCode = mapa.parameters.jsCode.replace(oldApprovedEsportivos, newApprovedEsportivos);
console.log('✓ APPROVED[artigos esportivos]: pesca/bikes/roupas/corrida/surf/calçados removidos; patins/patinete/beach tennis/vôlei adicionados');

// --- 3. Adicionar termos à DENIED_GLOBAL para barrar o que escapou ---
const oldDeniedGlobal = `  // Academias e esporte não-loja
  'academia','gym','fitness','crossfit','pilates','yoga','clube','club',
  'arena esportiva','complexo esportivo','sports complex',`;

const newDeniedGlobal = `  // Academias e esporte não-loja
  'academia','gym','fitness','crossfit','pilates','yoga','clube','club',
  'arena esportiva','complexo esportivo','sports complex',
  // Categorias fora do catálogo 4G (pesca, bikes, roupas fitness)
  'pesca','pescaria','fishing','bike elétrica','bicicleta elétrica',
  'roupas fitness','moda fitness','vestuário esportivo','calçados esportivos',
  'suplementos esportivos','nutrição esportiva','artigos de caça',`;

if (!mapa.parameters.jsCode.includes(oldDeniedGlobal)) {
  console.error('ERRO: DENIED_GLOBAL não encontrado — verifique o arquivo fonte');
  process.exit(1);
}
mapa.parameters.jsCode = mapa.parameters.jsCode.replace(oldDeniedGlobal, newDeniedGlobal);
console.log('✓ DENIED_GLOBAL: pesca/bikes elétricas/roupas fitness/calçados esportivos adicionados');

// --- Salvar ---
d.name = 'Fluxo_4g — Dashboard v2 (v35 filtro-catalogo)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v35_filtro_catalogo.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v35_filtro_catalogo.json salvo em Downloads');

// Verificação
const mapa2 = d.nodes.find(n => n.name === 'mapear_tipo_loja');
const hasBeachTennis = mapa2.parameters.jsCode.includes('beach tennis');
const hasPescaRemoved = !mapa2.parameters.jsCode.includes("'pesca esportiva','loja de pesca'");
const hasBikesRemoved = !mapa2.parameters.jsCode.includes("'bicicletas','ciclismo','bicycle'");
console.log('\n=== VERIFICAÇÃO ===');
console.log('beach tennis adicionado ao APPROVED:', hasBeachTennis ? '✓' : '✗');
console.log('pesca removida do APPROVED:', hasPescaRemoved ? '✓' : '✗');
console.log('bikes removidas do APPROVED:', hasBikesRemoved ? '✓' : '✗');
