const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v16_final.json', 'utf8'));

// === 1. mapear_tipo_loja: multiplicador 2.5x → 8x, mínimo 30 → 60 ===
const mapa = d.nodes.find(n => n.name === 'mapear_tipo_loja');
const oldMultiplier = "Math.max(Math.ceil(quantidade * 2.5), 30)";
const newMultiplier = "Math.max(Math.ceil(quantidade * 8), 60)";
if (!mapa.parameters.jsCode.includes(oldMultiplier)) {
  console.error('ERRO: multiplicador esperado não encontrado no mapear_tipo_loja');
  process.exit(1);
}
mapa.parameters.jsCode = mapa.parameters.jsCode.replace(oldMultiplier, newMultiplier);
console.log('✓ mapear_tipo_loja: multiplicador atualizado para 8x (mínimo 60)');

// === 2. filtrar_categoria: coleta TODOS os válidos sem break antecipado ===
const filtrar = d.nodes.find(n => n.name === 'filtrar_categoria');

// Novo código do filtrar_categoria
const novoFiltrarCode = [
  "const items = $input.all();",
  "const approvedCategories = $('mapear_tipo_loja').first().json.approvedCategories || [];",
  "const deniedCategories = $('mapear_tipo_loja').first().json.deniedCategories || [];",
  "const quantidade = $('mapear_tipo_loja').first().json.quantidade || 30;",
  "const quantidade_bruta = items.length;",
  "",
  "function classificar(item) {",
  "  const catText = [",
  "    item.json.categoryName || '',",
  "    ...(item.json.categories || []),",
  "  ].join(' ').toLowerCase();",
  "  const titulo = (item.json.title || '').toLowerCase();",
  "  const tudo = catText + ' ' + titulo;",
  "",
  "  // 1. Approved check ANTES do denied (evita rejeitar 'material escolar' por 'escola')",
  "  if (approvedCategories.some(function(a){ return catText.includes(a.toLowerCase()); })) return true;",
  "",
  "  // 2. Lista negra",
  "  if (deniedCategories.some(function(d){ return tudo.includes(d.toLowerCase()); })) return false;",
  "",
  "  // 3. Fallback por título",
  "  return approvedCategories.some(function(a){ return titulo.includes(a.toLowerCase()); });",
  "}",
  "",
  "const vistos = new Set();",
  "const filtrados = [];",
  "",
  "for (const item of items) {",
  "  if (!classificar(item)) continue;",
  "  const phone = (item.json.phoneUnformatted || '').replace(/\\D/g, '');",
  "  const chave = phone || (item.json.title || '').toLowerCase();",
  "  if (chave && vistos.has(chave)) continue;",
  "  if (chave) vistos.add(chave);",
  "  filtrados.push(item);",
  "  // SEM break antecipado: coleta todos os validos, corta em finalizar_busca",
  "}",
  "",
  "// Injeta metadados no primeiro item para finalizar_busca ler",
  "const resultado = filtrados.slice(0, quantidade);",
  "return resultado.map(function(item, idx) {",
  "  return {",
  "    json: Object.assign({}, item.json, {",
  "      _meta_bruta: idx === 0 ? quantidade_bruta : undefined,",
  "      _meta_filtrada: idx === 0 ? filtrados.length : undefined,",
  "      _meta_pedida: idx === 0 ? quantidade : undefined,",
  "    })",
  "  };",
  "});",
].join('\n');

filtrar.parameters.jsCode = novoFiltrarCode;
console.log('✓ filtrar_categoria: break antecipado removido, metadados injetados');

// === 3. Adicionar nó finalizar_busca ===
const finalizarCode = [
  "const items = $input.all();",
  "const primeiroJson = items[0] ? items[0].json : {};",
  "const quantidade_bruta = primeiroJson._meta_bruta || items.length;",
  "const quantidade_filtrada = primeiroJson._meta_filtrada || items.length;",
  "const quantidade_pedida = primeiroJson._meta_pedida || items.length;",
  "const quantidade_entregue = items.length;",
  "",
  "// Buscar search_id do webhook original",
  "const bodyOriginal = $('receber_busca_dashboard').first().json.body || {};",
  "const search_id = bodyOriginal.search_id || '';",
  "const apiKey = $env.N8N_API_KEY || '';",
  "",
  "// Notificar dashboard que a busca concluiu (async, nao bloqueia o fluxo)",
  "if (search_id) {",
  "  fetch('https://4g-project.vercel.app/api/searches/' + search_id, {",
  "    method: 'PATCH',",
  "    headers: {",
  "      'Content-Type': 'application/json',",
  "      'x-api-key': apiKey",
  "    },",
  "    body: JSON.stringify({",
  "      status: 'CONCLUÍDA',",
  "      quantidade_bruta: quantidade_bruta,",
  "      quantidade_entregue: quantidade_entregue,",
  "      num_rodadas: 1,",
  "    })",
  "  }).catch(function(e){ console.log('PATCH search falhou:', e.message); });",
  "}",
  "",
  "// Remove campos de metadado antes de passar para code_in_java",
  "return items.map(function(item) {",
  "  const json = Object.assign({}, item.json);",
  "  delete json._meta_bruta;",
  "  delete json._meta_filtrada;",
  "  delete json._meta_pedida;",
  "  return { json: json };",
  "});",
].join('\n');

const finalizarNode = {
  parameters: { jsCode: finalizarCode },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [filtrar.position[0] + 340, filtrar.position[1]],
  id: 'finalizar-busca-node-v17',
  name: 'finalizar_busca'
};
d.nodes.push(finalizarNode);
console.log('✓ finalizar_busca: nó adicionado');

// === 4. Reconectar: filtrar_categoria → finalizar_busca → code_in_java ===
d.connections['filtrar_categoria'] = {
  main: [[{ node: 'finalizar_busca', type: 'main', index: 0 }]]
};
d.connections['finalizar_busca'] = {
  main: [[{ node: 'code_in_java', type: 'main', index: 0 }]]
};
console.log('✓ conexões atualizadas: filtrar_categoria → finalizar_busca → code_in_java');

// === 5. Salvar como v17 ===
d.name = 'Fluxo_4g — Dashboard v2 (v17 retry)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v17_retry.json', JSON.stringify(d, null, 2));
console.log('✓ Fluxo_4g_v17_retry.json salvo em Downloads');

// Verificação final
console.log('\n=== VERIFICAÇÃO ===');
const mapa2 = d.nodes.find(n => n.name === 'mapear_tipo_loja');
console.log('Multiplicador atual:', mapa2.parameters.jsCode.match(/Math\.max\([^)]+\)/)?.[0]);
console.log('Nos no fluxo:', d.nodes.map(n => n.name).filter(n => ['mapear_tipo_loja','filtrar_categoria','finalizar_busca','code_in_java'].includes(n)).join(' → '));
console.log('filtrar_categoria →', JSON.stringify(d.connections['filtrar_categoria'].main[0][0].node));
console.log('finalizar_busca →', JSON.stringify(d.connections['finalizar_busca'].main[0][0].node));
