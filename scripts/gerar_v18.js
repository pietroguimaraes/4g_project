const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v17_retry.json', 'utf8'));

const API_BASE = 'https://4g-project.vercel.app';
const apiKey = d.nodes.find(n => n.name === 'HTTP Request6')
  ?.parameters?.headerParameters?.parameters?.[0]?.value || '';

// === Posições de referência ===
const recv = d.nodes.find(n => n.name === 'receber_busca_dashboard');
const mapa = d.nodes.find(n => n.name === 'mapear_tipo_loja');
const filtrar = d.nodes.find(n => n.name === 'filtrar_categoria');
const finalizar = d.nodes.find(n => n.name === 'finalizar_busca');
const hr6 = d.nodes.find(n => n.name === 'HTTP Request6');
const patchNode = d.nodes.find(n => n.name === 'patch_busca_concluida');

// =============================================================
// 1. NOVO NÓ: verificar_reserva (HTTP Request GET)
// =============================================================
const verificarReservaNode = {
  parameters: {
    method: 'GET',
    url: "={{ '" + API_BASE + "/api/leads?status=RESERVA&cidade=' + encodeURIComponent($('receber_busca_dashboard').first().json.body.cidade) + '&tipo_loja=' + encodeURIComponent($('receber_busca_dashboard').first().json.body.tipo_loja) }}",
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'x-api-key', value: apiKey }]
    },
    options: {}
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [recv.position[0] + 300, recv.position[1]],
  id: 'verificar-reserva-v18',
  name: 'verificar_reserva',
  onError: 'continueRegularOutput'
};
d.nodes.push(verificarReservaNode);
console.log('✓ verificar_reserva: nó adicionado');

// =============================================================
// 2. NOVO NÓ: calcular_estrategia (Code)
// =============================================================
const calcularCode = [
  "// Reserva: array de leads em RESERVA para esta cidade+tipo_loja",
  "const reservaRaw = $input.all();",
  "// HTTP Request retorna um item com body contendo o array, ou array direto",
  "let reservaLeads = [];",
  "if (reservaRaw.length === 1 && Array.isArray(reservaRaw[0].json)) {",
  "  reservaLeads = reservaRaw[0].json;",
  "} else if (reservaRaw.length > 0 && reservaRaw[0].json && !reservaRaw[0].json.empresa) {",
  "  // Resposta é array encapsulado — tentar extrair",
  "  const first = reservaRaw[0].json;",
  "  reservaLeads = Array.isArray(first) ? first : reservaRaw.map(i => i.json);",
  "} else {",
  "  reservaLeads = reservaRaw.map(i => i.json).filter(j => j && j.telefone);",
  "}",
  "",
  "const reservaCount = reservaLeads.length;",
  "const bodyOriginal = $('receber_busca_dashboard').first().json.body || {};",
  "const quantidadePedida = parseInt(bodyOriginal.quantidade) || 30;",
  "",
  "// Quantos faltam após usar a reserva?",
  "const faltante = Math.max(0, quantidadePedida - reservaCount);",
  "// 3x de margem para compensar o filtro de categorias",
  "const qtdApify = faltante > 0 ? Math.max(Math.ceil(faltante * 3), 30) : 0;",
  "const precisaApify = reservaCount < quantidadePedida;",
  "",
  "return [{",
  "  json: {",
  "    reservaCount,",
  "    precisaApify,",
  "    // body estruturado para mapear_tipo_loja ler sem alterações",
  "    body: {",
  "      ...bodyOriginal,",
  "      quantidade: qtdApify,          // Apify buscará só o necessário",
  "      _quantidade_pedida: quantidadePedida,",
  "      _reserva_count: reservaCount,",
  "    }",
  "  }",
  "}];",
].join('\n');

const calcularNode = {
  parameters: { jsCode: calcularCode },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [recv.position[0] + 580, recv.position[1]],
  id: 'calcular-estrategia-v18',
  name: 'calcular_estrategia'
};
d.nodes.push(calcularNode);
console.log('✓ calcular_estrategia: nó adicionado');

// =============================================================
// 3. NOVO NÓ: reserva_suficiente (IF)
// =============================================================
const reservaSuficienteNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'check-reserva-suficiente',
        leftValue: '={{ $json.precisaApify }}',
        rightValue: false,
        operator: { type: 'boolean', operation: 'equals' }
      }],
      combinator: 'and'
    },
    options: {}
  },
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [recv.position[0] + 840, recv.position[1]],
  id: 'reserva-suficiente-v18',
  name: 'reserva_suficiente'
};
d.nodes.push(reservaSuficienteNode);
console.log('✓ reserva_suficiente: nó IF adicionado');

// =============================================================
// 4. NOVO NÓ: ativar_reserva (HTTP Request POST)
// =============================================================
const ativarReservaNode = {
  parameters: {
    method: 'POST',
    url: API_BASE + '/api/leads/activate-reserve',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'x-api-key', value: apiKey },
        { name: 'Content-Type', value: 'application/json' }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ cidade: $('receber_busca_dashboard').first().json.body.cidade, tipo_loja: $('receber_busca_dashboard').first().json.body.tipo_loja, quantidade: $('receber_busca_dashboard').first().json.body.quantidade }) }}",
    options: {}
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [recv.position[0] + 1100, recv.position[1] - 120],
  id: 'ativar-reserva-v18',
  name: 'ativar_reserva',
  onError: 'continueRegularOutput'
};
d.nodes.push(ativarReservaNode);
console.log('✓ ativar_reserva: nó adicionado');

// =============================================================
// 5. NOVO NÓ: patch_reserva_concluida (PATCH search status - para path da reserva)
// =============================================================
const patchReservaNode = {
  parameters: {
    method: 'PATCH',
    url: "={{ '" + API_BASE + "/api/searches/' + $('receber_busca_dashboard').first().json.body.search_id }}",
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'x-api-key', value: apiKey },
        { name: 'Content-Type', value: 'application/json' }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ status: 'CONCLUÍDA', quantidade_bruta: 0, quantidade_entregue: $json.ativados || 0, num_rodadas: 0 }) }}",
    options: {}
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [recv.position[0] + 1380, recv.position[1] - 120],
  id: 'patch-reserva-concluida-v18',
  name: 'patch_reserva_concluida',
  executeOnce: true,
  onError: 'continueRegularOutput'
};
d.nodes.push(patchReservaNode);
console.log('✓ patch_reserva_concluida: nó adicionado');

// =============================================================
// 6. ATUALIZAR filtrar_categoria: remover slice (deixar todos os válidos passarem)
// =============================================================
const filtrarNode = d.nodes.find(n => n.name === 'filtrar_categoria');
filtrarNode.parameters.jsCode = [
  "const items = $input.all();",
  "const approvedCategories = $('mapear_tipo_loja').first().json.approvedCategories || [];",
  "const deniedCategories = $('mapear_tipo_loja').first().json.deniedCategories || [];",
  "const quantidade_bruta = items.length;",
  "",
  "function classificar(item) {",
  "  const catText = [",
  "    item.json.categoryName || '',",
  "    ...(item.json.categories || []),",
  "  ].join(' ').toLowerCase();",
  "  const titulo = (item.json.title || '').toLowerCase();",
  "  const tudo = catText + ' ' + titulo;",
  "  if (approvedCategories.some(function(a){ return catText.includes(a.toLowerCase()); })) return true;",
  "  if (deniedCategories.some(function(d){ return tudo.includes(d.toLowerCase()); })) return false;",
  "  return approvedCategories.some(function(a){ return titulo.includes(a.toLowerCase()); });",
  "}",
  "",
  "const vistos = new Set();",
  "const filtrados = [];",
  "for (const item of items) {",
  "  if (!classificar(item)) continue;",
  "  const phone = (item.json.phoneUnformatted || '').replace(/\\D/g, '');",
  "  const chave = phone || (item.json.title || '').toLowerCase();",
  "  if (chave && vistos.has(chave)) continue;",
  "  if (chave) vistos.add(chave);",
  "  filtrados.push(item);",
  "  // SEM corte — todos os válidos passam para finalizar_busca decidir",
  "}",
  "",
  "// Injeta metadados apenas no primeiro item",
  "return filtrados.map(function(item, idx) {",
  "  return {",
  "    json: Object.assign({}, item.json, {",
  "      _meta_bruta: idx === 0 ? quantidade_bruta : undefined,",
  "      _meta_filtrada: idx === 0 ? filtrados.length : undefined,",
  "    })",
  "  };",
  "});",
].join('\n');
console.log('✓ filtrar_categoria: slice removido, todos os válidos passam');

// =============================================================
// 7. ATUALIZAR finalizar_busca: LOCALIZADOS vs RESERVA + tipo_loja
// =============================================================
const finalizarNode = d.nodes.find(n => n.name === 'finalizar_busca');
finalizarNode.parameters.jsCode = [
  "const items = $input.all();",
  "const quantidadePedida = $('mapear_tipo_loja').first().json._quantidade_pedida || 30;",
  "const reservaCount = $('mapear_tipo_loja').first().json._reserva_count || 0;",
  "const tipoLoja = $('mapear_tipo_loja').first().json.tipo_loja || '';",
  "const search_id = $('receber_busca_dashboard').first().json.body.search_id || '';",
  "",
  "// Quantos do Apify vão para LOCALIZADOS (completando o que a reserva não cobre)",
  "const targetApify = Math.max(0, quantidadePedida - reservaCount);",
  "const quantidade_entregue = Math.min(items.length, targetApify) + reservaCount;",
  "",
  "// Injeta _status_final e _tipo_loja em cada item",
  "return items.map(function(item, idx) {",
  "  const json = Object.assign({}, item.json);",
  "  delete json._meta_bruta;",
  "  delete json._meta_filtrada;",
  "  delete json._meta_pedida;",
  "  json._status_final = idx < targetApify ? 'LOCALIZADOS' : 'RESERVA';",
  "  json._tipo_loja = tipoLoja;",
  "  json._total_entregue = quantidade_entregue; // para patch_busca_concluida",
  "  return { json };",
  "});",
].join('\n');
console.log('✓ finalizar_busca: tagging LOCALIZADOS/RESERVA implementado');

// =============================================================
// 8. ATUALIZAR HTTP Request6: envia status e tipo_loja
// =============================================================
hr6.parameters.jsonBody = [
  "={",
  "  \"empresa\": \"{{ $('edit_fields').item.json.Empresa }}\",",
  "  \"telefone\": \"{{ $('edit_fields').item.json.Telefone }}\",",
  "  \"website\": \"{{ $('edit_fields').item.json.Site }}\",",
  "  \"cidade\": \"{{ $('edit_fields').item.json['Localização'] }}\",",
  "  \"status\": \"{{ $('finalizar_busca').item.json._status_final }}\",",
  "  \"tipo_loja\": \"{{ $('finalizar_busca').item.json._tipo_loja }}\"",
  "}",
].join('\n');
console.log('✓ HTTP Request6: envia status e tipo_loja');

// =============================================================
// 9. ATUALIZAR patch_busca_concluida: usa _total_entregue
// =============================================================
patchNode.parameters.jsonBody = "={{ JSON.stringify({ status: 'CONCLUÍDA', quantidade_bruta: $('filtrar_categoria').first().json._meta_bruta || 0, quantidade_entregue: $('finalizar_busca').first().json._total_entregue || 0, num_rodadas: 1 }) }}";
console.log('✓ patch_busca_concluida: usa _total_entregue');

// =============================================================
// 10. RECONECTAR NÓS
// =============================================================
// receber_busca_dashboard → verificar_reserva (era → mapear_tipo_loja)
d.connections['receber_busca_dashboard'] = {
  main: [[{ node: 'verificar_reserva', type: 'main', index: 0 }]]
};
// verificar_reserva → calcular_estrategia
d.connections['verificar_reserva'] = {
  main: [[{ node: 'calcular_estrategia', type: 'main', index: 0 }]]
};
// calcular_estrategia → reserva_suficiente
d.connections['calcular_estrategia'] = {
  main: [[{ node: 'reserva_suficiente', type: 'main', index: 0 }]]
};
// reserva_suficiente:
//   TRUE (output[0]) → ativar_reserva
//   FALSE (output[1]) → mapear_tipo_loja
d.connections['reserva_suficiente'] = {
  main: [
    [{ node: 'ativar_reserva', type: 'main', index: 0 }],   // TRUE: reserva suficiente
    [{ node: 'mapear_tipo_loja', type: 'main', index: 0 }]  // FALSE: precisa Apify
  ]
};
// ativar_reserva → patch_reserva_concluida
d.connections['ativar_reserva'] = {
  main: [[{ node: 'patch_reserva_concluida', type: 'main', index: 0 }]]
};
console.log('✓ conexões atualizadas');

// =============================================================
// 11. SALVAR v18
// =============================================================
d.name = 'Fluxo_4g — Dashboard v2 (v18 reserva)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v18_reserva.json', JSON.stringify(d, null, 2));
console.log('✓ Fluxo_4g_v18_reserva.json salvo em Downloads');

// Verificação
console.log('\n=== VERIFICAÇÃO ===');
console.log('receber_busca_dashboard →', d.connections['receber_busca_dashboard'].main[0][0].node);
console.log('verificar_reserva →', d.connections['verificar_reserva'].main[0][0].node);
console.log('calcular_estrategia →', d.connections['calcular_estrategia'].main[0][0].node);
console.log('reserva_suficiente TRUE →', d.connections['reserva_suficiente'].main[0][0].node);
console.log('reserva_suficiente FALSE →', d.connections['reserva_suficiente'].main[1][0].node);
console.log('filtrar_categoria →', d.connections['filtrar_categoria'].main[0][0].node);
console.log('finalizar_busca →', d.connections['finalizar_busca'].main[0][0].node);
console.log('HTTP Request6 →', d.connections['HTTP Request6'].main[0][0].node);
console.log('ativar_reserva →', d.connections['ativar_reserva'].main[0][0].node);
console.log('Nós totais:', d.nodes.length);
