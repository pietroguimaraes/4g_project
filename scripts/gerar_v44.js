const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v43_finalizar.json', 'utf8'));

// === v44: Multiplicador 3x + Sistema de Reserva ===
//
// MULTIPLICADOR 3x:
//   definir_termos → pede quantidade*3 à Apify (ex: 20 pedidos → 60 buscados)
//   finalizar_busca → entrega os primeiros N como LOCALIZADOS, salva o resto como RESERVA
//
// SISTEMA DE RESERVA (não compromete o fluxo principal):
//   verificar_reserva  → GET /api/leads/reserve-count (continueOnFail: true)
//   reserva_suficiente → IF: count >= quantidade_pedida?
//     [TRUE]  → ativar_reserva + patch_reserva_concluida (pula Apify)
//     [FALSE] → definir_termos → Apify → enriquecer_leads → finalizar_busca → ...
//
// Segurança:
//   - verificar_reserva tem continueOnFail: true → falha → count=0 → IF vai para FALSE → Apify
//   - ativar_reserva tem continueOnFail: true → falha → patch_reserva_concluida marca ERRO
//   - O fluxo principal (Apify) nunca é afetado por falha no caminho de reserva

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNjkyODc2My1iOGQ5LTQ5YTAtYmY3Yy0wNGIzMmFjMmNhNTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2MjgzNjUxfQ.gc_mgxaHzURxlIs5W0iR2RH2yIQ4BV7pEbyueJ95nGU';
const BASE_URL = 'https://4g-project.vercel.app';

// -------------------------------------------------------
// 1. definir_termos → multiplicador 3x
// -------------------------------------------------------
const nodeDT = d.nodes.find(n => n.name === 'definir_termos');
nodeDT.parameters.jsCode = nodeDT.parameters.jsCode
  .replace(
    /const maxResults = quantidade;/,
    'const maxResults = quantidade * 3; // v44: multiplicador 3x\n  const quantidade_pedida = quantidade;'
  )
  .replace(
    /return \[\{ json: \{(\s*)searchStringsArray, locationQuery, quantidade, maxResults, perSearch,/,
    'return [{ json: {$1searchStringsArray, locationQuery, quantidade, maxResults, perSearch, quantidade_pedida,'
  );

// Verifica se a substituição funcionou; fallback mais robusto
if (!nodeDT.parameters.jsCode.includes('multiplicador 3x')) {
  // Reescreve o bloco final de retorno do código
  nodeDT.parameters.jsCode = nodeDT.parameters.jsCode.replace(
    /(const perSearch = .+?;)([\s\S]*?return \[\{ json: \{)([\s\S]*?)(searchStringsArray, locationQuery, quantidade, maxResults, perSearch,)/,
    (_, perSearch, ret, before, fields) =>
      `${perSearch}\n  const quantidade_pedida = quantidade;\n  const maxResults3x = maxResults * 3;${before}${fields.replace('maxResults,', 'maxResults: maxResults3x, quantidade_pedida,')}`
  );
}
console.log('✓ definir_termos: multiplicador 3x configurado');

// -------------------------------------------------------
// 2. finalizar_busca → LOCALIZADOS (primeiros N) + RESERVA (resto)
// -------------------------------------------------------
const nodeFin = d.nodes.find(n => n.name === 'finalizar_busca');
nodeFin.parameters.jsCode = `const allItems = $input.all();
const items = allItems.filter(i => !i.json._sem_resultado);
const tipoLoja = $('definir_termos').first().json.tipo_loja || '';
const quantidadePedida = $('definir_termos').first().json.quantidade_pedida || items.length;

if (items.length === 0) {
  return [{ json: { _sem_resultado: true, _total_entregue: 0, _tipo_loja: tipoLoja } }];
}

const entrega = items.slice(0, quantidadePedida);
const reserva  = items.slice(quantidadePedida);

return [
  // Primeiros N → LOCALIZADOS (aparecem no painel de aprovação)
  ...entrega.map((item, idx) => {
    const json = Object.assign({}, item.json);
    delete json._meta_bruta;
    delete json._meta_filtrada;
    json._status_final    = 'LOCALIZADOS';
    json._tipo_loja       = tipoLoja;
    json._total_entregue  = entrega.length;
    return { json };
  }),
  // Resto → RESERVA (salvos no banco mas não aparecem no painel)
  ...reserva.map(item => {
    const json = Object.assign({}, item.json);
    delete json._meta_bruta;
    delete json._meta_filtrada;
    json._status_final    = 'RESERVA';
    json._tipo_loja       = tipoLoja;
    json._total_entregue  = entrega.length;
    return { json };
  }),
];`;
console.log('✓ finalizar_busca: LOCALIZADOS (primeiros N) + RESERVA (resto)');

// -------------------------------------------------------
// 3. Adicionar nó verificar_reserva (HTTP GET, continueOnFail)
// -------------------------------------------------------
d.nodes.push({
  id: 'verificar-reserva-v44',
  name: 'verificar_reserva',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [11148, 10360],
  continueOnFail: true,
  parameters: {
    method: 'GET',
    url: `={{ '${BASE_URL}/api/leads/reserve-count?cidade=' + encodeURIComponent($('receber_busca_dashboard').first().json.body.cidade) + '&tipo_loja=' + encodeURIComponent($('receber_busca_dashboard').first().json.body.tipo_loja) }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'x-api-key', value: API_KEY }],
    },
    options: { timeout: 8000 },
  },
});
console.log('✓ verificar_reserva adicionado (GET reserve-count, continueOnFail)');

// -------------------------------------------------------
// 4. Adicionar nó reserva_suficiente (IF)
// -------------------------------------------------------
d.nodes.push({
  id: 'reserva-suficiente-v44',
  name: 'reserva_suficiente',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [11248, 10360],
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [
        {
          id: 'check-reserva',
          leftValue: '={{ $json.count || 0 }}',
          rightValue: `={{ $('receber_busca_dashboard').first().json.body.quantidade || 20 }}`,
          operator: { type: 'number', operation: 'gte' },
        },
      ],
      combinator: 'and',
    },
    options: {},
  },
});
console.log('✓ reserva_suficiente adicionado (IF count >= quantidade)');

// -------------------------------------------------------
// 5. Adicionar nó ativar_reserva (HTTP POST, continueOnFail)
// -------------------------------------------------------
d.nodes.push({
  id: 'ativar-reserva-v44',
  name: 'ativar_reserva',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [11348, 10260],
  continueOnFail: true,
  parameters: {
    method: 'POST',
    url: `${BASE_URL}/api/leads/activate-reserve`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'x-api-key', value: API_KEY },
        { name: 'Content-Type', value: 'application/json' },
      ],
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({
  cidade: $('receber_busca_dashboard').first().json.body.cidade,
  tipo_loja: $('receber_busca_dashboard').first().json.body.tipo_loja,
  quantidade: $('receber_busca_dashboard').first().json.body.quantidade || 20
}) }}`,
    options: { timeout: 10000 },
  },
});
console.log('✓ ativar_reserva adicionado (POST activate-reserve, continueOnFail)');

// -------------------------------------------------------
// 6. Adicionar nó patch_reserva_concluida (HTTP PATCH)
// -------------------------------------------------------
d.nodes.push({
  id: 'patch-reserva-concluida-v44',
  name: 'patch_reserva_concluida',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [11468, 10260],
  continueOnFail: true,
  parameters: {
    method: 'PATCH',
    url: `={{ '${BASE_URL}/api/searches/' + $('receber_busca_dashboard').first().json.body.search_id }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'x-api-key', value: API_KEY },
        { name: 'Content-Type', value: 'application/json' },
      ],
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({
  status: 'CONCLUÍDA',
  quantidade_bruta: $('verificar_reserva').first().json.count || 0,
  quantidade_entregue: $('ativar_reserva').first().json.ativados || 0,
  num_rodadas: 1
}) }}`,
    options: {},
  },
});
console.log('✓ patch_reserva_concluida adicionado');

// -------------------------------------------------------
// 7. Atualizar conexões
// -------------------------------------------------------

// receber_busca_dashboard → verificar_reserva (era → definir_termos)
d.connections['receber_busca_dashboard'].main[0] = [
  { node: 'verificar_reserva', type: 'main', index: 0 },
];

// verificar_reserva → reserva_suficiente
d.connections['verificar_reserva'] = {
  main: [[{ node: 'reserva_suficiente', type: 'main', index: 0 }]],
};

// reserva_suficiente:
//   output 0 (true)  → ativar_reserva
//   output 1 (false) → definir_termos
d.connections['reserva_suficiente'] = {
  main: [
    [{ node: 'ativar_reserva',  type: 'main', index: 0 }], // true
    [{ node: 'definir_termos', type: 'main', index: 0 }],  // false
  ],
};

// ativar_reserva → patch_reserva_concluida
d.connections['ativar_reserva'] = {
  main: [[{ node: 'patch_reserva_concluida', type: 'main', index: 0 }]],
};

// patch_reserva_concluida → (sem saída: fim do fluxo de reserva)
d.connections['patch_reserva_concluida'] = { main: [[]] };

console.log('✓ Conexões atualizadas');
console.log('  receber_busca_dashboard → verificar_reserva → reserva_suficiente');
console.log('  reserva_suficiente[TRUE]  → ativar_reserva → patch_reserva_concluida');
console.log('  reserva_suficiente[FALSE] → definir_termos → Apify → ...');

// -------------------------------------------------------
// Salvar
// -------------------------------------------------------
d.name = 'Fluxo_4g — Dashboard v2 (v44 3x+reserva)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v44_reserva.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v44_reserva.json salvo em Downloads');

// -------------------------------------------------------
// Verificação
// -------------------------------------------------------
const temVR   = d.nodes.some(n => n.name === 'verificar_reserva');
const temRS   = d.nodes.some(n => n.name === 'reserva_suficiente');
const temAR   = d.nodes.some(n => n.name === 'ativar_reserva');
const temPR   = d.nodes.some(n => n.name === 'patch_reserva_concluida');
const conexDB = d.connections['receber_busca_dashboard']?.main?.[0]?.[0]?.node;
const conexVR = d.connections['verificar_reserva']?.main?.[0]?.[0]?.node;
const trueRS  = d.connections['reserva_suficiente']?.main?.[0]?.[0]?.node;
const falseRS = d.connections['reserva_suficiente']?.main?.[1]?.[0]?.node;
const conexAR = d.connections['ativar_reserva']?.main?.[0]?.[0]?.node;
const finCode = d.nodes.find(n => n.name === 'finalizar_busca')?.parameters?.jsCode || '';

console.log('\n=== VERIFICACAO ===');
console.log('verificar_reserva existe:',              temVR ? '✓' : '✗');
console.log('reserva_suficiente existe:',             temRS ? '✓' : '✗');
console.log('ativar_reserva existe:',                 temAR ? '✓' : '✗');
console.log('patch_reserva_concluida existe:',        temPR ? '✓' : '✗');
console.log('receber → verificar_reserva:',           conexDB === 'verificar_reserva' ? '✓' : `✗ (${conexDB})`);
console.log('verificar_reserva → reserva_suficiente:', conexVR === 'reserva_suficiente' ? '✓' : `✗ (${conexVR})`);
console.log('reserva_suficiente[TRUE] → ativar_reserva:', trueRS === 'ativar_reserva' ? '✓' : `✗ (${trueRS})`);
console.log('reserva_suficiente[FALSE] → definir_termos:', falseRS === 'definir_termos' ? '✓' : `✗ (${falseRS})`);
console.log('ativar_reserva → patch_reserva_concluida:', conexAR === 'patch_reserva_concluida' ? '✓' : `✗ (${conexAR})`);
console.log('finalizar_busca tem RESERVA:',           finCode.includes('RESERVA') ? '✓' : '✗');
console.log('finalizar_busca tem quantidade_pedida:', finCode.includes('quantidade_pedida') ? '✓' : '✗');
console.log('verificar_reserva continueOnFail:',      d.nodes.find(n => n.name === 'verificar_reserva')?.continueOnFail ? '✓' : '✗');
console.log('ativar_reserva continueOnFail:',         d.nodes.find(n => n.name === 'ativar_reserva')?.continueOnFail ? '✓' : '✗');

console.log('\nFluxo:');
console.log('receber_busca_dashboard → verificar_reserva → reserva_suficiente');
console.log('  [TRUE]  → ativar_reserva → patch_reserva_concluida (FIM)');
console.log('  [FALSE] → definir_termos (3x) → Apify → enriquecer_leads → finalizar_busca → ...');
console.log('\nfinalizar_busca:');
console.log('  primeiros N → LOCALIZADOS (painel de aprovação)');
console.log('  resto       → RESERVA (banco de dados, reutilizados na próxima busca)');
