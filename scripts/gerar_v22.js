const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v21_pequenos.json', 'utf8'));

// =============================================================
// 1. calcular_estrategia — remove multiplicador 3x
//    qtdApify = faltante (exato, sem buffer)
// =============================================================
const calcNode = d.nodes.find(n => n.name === 'calcular_estrategia');
calcNode.parameters.jsCode = [
  "const resposta = $input.first().json;",
  "const reservaCount = resposta.count || 0;",
  "const bodyOriginal = $('receber_busca_dashboard').first().json.body || {};",
  "const quantidadePedida = parseInt(bodyOriginal.quantidade) || 30;",
  "",
  "const faltante = Math.max(0, quantidadePedida - reservaCount);",
  "const qtdApify = faltante; // sem multiplicador — busca exatamente o necessário",
  "const precisaApify = reservaCount < quantidadePedida;",
  "",
  "return [{",
  "  json: {",
  "    reservaCount,",
  "    precisaApify,",
  "    body: {",
  "      ...bodyOriginal,",
  "      quantidade: qtdApify,",
  "      _quantidade_pedida: quantidadePedida,",
  "      _reserva_count: reservaCount,",
  "    }",
  "  }",
  "}];",
].join('\n');
console.log('✓ calcular_estrategia: multiplicador 3x removido');

// =============================================================
// 2. mapear_tipo_loja — remove multiplicador 8x
//    busca exatamente a quantidade pedida distribuída pelas search strings
// =============================================================
const mapaNode = d.nodes.find(n => n.name === 'mapear_tipo_loja');
const oldCode = mapaNode.parameters.jsCode;

// Substitui só as linhas do multiplicador
mapaNode.parameters.jsCode = oldCode.replace(
  /\/\/ 2\.5x.*?\nconst buscarQtd.*?;\nconst perSearch.*?;\nconst maxResults.*?;/s,
  `const buscarQtd = quantidade; // sem multiplicador
const perSearch = Math.max(Math.ceil(buscarQtd / searchStringsArray.length), 2);
const maxResults = quantidade; // hard cap no total`
).replace(
  /const buscarQtd = Math\.max\(Math\.ceil\(quantidade \* 8\), 60\);/,
  `const buscarQtd = quantidade; // sem multiplicador`
).replace(
  /const perSearch = Math\.ceil\(buscarQtd \/ searchStringsArray\.length\);/,
  `const perSearch = Math.max(Math.ceil(buscarQtd / searchStringsArray.length), 2);`
).replace(
  /\/\/ maxResults = perSearch \* numSearches para nao cortar a ultima busca\n(\s*)const maxResults = perSearch \* searchStringsArray\.length;/,
  `$1const maxResults = quantidade; // hard cap no total`
).replace(
  /const maxResults = perSearch \* searchStringsArray\.length;/,
  `const maxResults = quantidade; // hard cap no total`
);

console.log('✓ mapear_tipo_loja: multiplicador 8x removido');

// Verificar se substituição funcionou
if (mapaNode.parameters.jsCode.includes('* 8')) {
  console.warn('⚠️  Substituição pode não ter funcionado — verificar manualmente');
} else {
  console.log('✓ multiplicador 8x confirmado removido');
}

// =============================================================
// 3. SALVAR v22
// =============================================================
d.name = 'Fluxo_4g — Dashboard v2 (v22 sem-multiplicador)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v22_sem_multiplicador.json', JSON.stringify(d, null, 2));
console.log('✓ Fluxo_4g_v22_sem_multiplicador.json salvo em Downloads');

// Verificação das quantidades
console.log('\n=== VERIFICAÇÃO ===');
console.log('Exemplo: pedido 10 leads, sem reserva:');
console.log('  calcular_estrategia → qtdApify = 10');
console.log('  mapear_tipo_loja → maxResults = 10, perSearch ≈ 2 (por search string)');
console.log('  filtrar_categoria → filtra categorias irrelevantes');
console.log('  finalizar_busca → entrega até 10 como LOCALIZADOS');
