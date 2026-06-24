const fs = require('fs');

// v60: pipeline simplificado — Apollo.io direto, sem LinkedIn, sem Google Maps
//
// ANTES (v59): extrair_params → preparar_busca_linkedin → apify_linkedin_search
//              → coletar_urls_linkedin → apify_linkedin_email → normalizar_apollo
//              → montar_lead_linkedin → HTTP Request6 → email
//
// AGORA (v60): extrair_params → buscar_compradores_apollo → processar_apollo_leads
//              → HTTP Request6 → email
//
// Apollo.io /mixed_people/search: busca direto por cargo + localizacao + email disponivel
// - Sem Apify, sem LinkedIn scraping
// - Retorna: nome, email, empresa, cargo — pronto para salvar
// - 10.000 creditos gratis/mes (Victor usa ~220/mes)

var APOLLO_API_KEY = 'osbIKBwqiIxlaknIF1i7aw';

var INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v59.json';
var OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v60.json';

if (!fs.existsSync(INPUT)) {
  console.error('ERRO: Arquivo de entrada nao encontrado: ' + INPUT);
  process.exit(1);
}

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v60 - Apollo.io direto (sem LinkedIn/Apify)';
console.log('OK Fluxo carregado: ' + INPUT);

// ── Referencia de posicoes dos nodes antigos (para posicionar os novos) ────────
var prepLinkedinNode = d.nodes.find(function(n) { return n.name === 'preparar_busca_linkedin'; });
var montarLeadNode   = d.nodes.find(function(n) { return n.name === 'montar_lead_linkedin'; });
var prepPos  = prepLinkedinNode  ? prepLinkedinNode.position  : [800, 300];
var montarPos = montarLeadNode   ? montarLeadNode.position    : [1800, 300];

// ── 1. Desativa nodes do pipeline antigo ──────────────────────────────────────
var nodesDesativar = [
  'preparar_busca_linkedin',
  'apify_linkedin_search',
  'coletar_urls_linkedin',
  'apify_linkedin_email',
  'normalizar_apollo',
  'montar_lead_linkedin'
];
var desativados = 0;
nodesDesativar.forEach(function(nome) {
  var n = d.nodes.find(function(x) { return x.name === nome; });
  if (n) { n.disabled = true; desativados++; console.log('OK desativado: ' + nome); }
  else    { console.log('AVISO: nao encontrado para desativar: ' + nome); }
});
console.log('OK ' + desativados + ' nodes do pipeline antigo desativados');

// ── 2. Adiciona buscar_compradores_apollo (HTTP Request) ──────────────────────
// POST https://api.apollo.io/api/v1/mixed_people/search
// Busca compradores/gerentes de compras no setor alimenticio em SP (ou cidade do params)
// contact_email_status: so retorna pessoas que Apollo tem email disponivel

var apolloSearchBody = [
  '={{ JSON.stringify({',
  '  person_titles: (',
  '    $json.tipo_loja === "ATACADISTA"    ? ["Comprador","Gerente de Compras","Diretor Comercial"] :',
  '    $json.tipo_loja === "DISTRIBUIDORA" ? ["Comprador","Diretor de Compras","Gerente Comercial"] :',
  '    ["Comprador","Gerente de Compras","Diretor de Compras","Head de Compras"]',
  '  ),',
  '  person_locations: [($json.cidade || "Sao Paulo") + ", Brazil"],',
  '  contact_email_status: ["verified", "guessed"],',
  '  per_page: Math.min(($json.quantidade_pedida || 10) * 3, 50),',
  '  page: 1',
  '}) }}'
].join('\n');

var apolloSearchNode = {
  id: 'buscar-compradores-apollo-node',
  name: 'buscar_compradores_apollo',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: prepPos,
  continueOnFail: true,
  parameters: {
    method: 'POST',
    url: 'https://api.apollo.io/api/v1/mixed_people/search',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'X-Api-Key',    value: APOLLO_API_KEY },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Cache-Control', value: 'no-cache' }
      ]
    },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: apolloSearchBody,
    options: {}
  }
};

// Evita duplicar se script rodado mais de uma vez
var jaTemApolloSearch = d.nodes.find(function(n) { return n.name === 'buscar_compradores_apollo'; });
if (!jaTemApolloSearch) {
  d.nodes.push(apolloSearchNode);
  console.log('OK buscar_compradores_apollo: adicionado');
} else {
  jaTemApolloSearch.parameters = apolloSearchNode.parameters;
  jaTemApolloSearch.disabled   = false;
  console.log('OK buscar_compradores_apollo: atualizado');
}

// ── 3. Adiciona processar_apollo_leads (Code node) ────────────────────────────
// Converte a resposta Apollo em itens individuais no formato esperado por HTTP Request6
// (mesmo formato de montar_lead_linkedin)

var processarCode = [
  '// Converte resposta Apollo.io em leads individuais',
  '// Formato compativel com HTTP Request6 (igual ao montar_lead_linkedin)',
  '',
  'var resposta = $input.first().json;',
  '',
  '// Recupera params da busca',
  'var params = $("extrair_params").first().json;',
  '',
  '// Recupera user_id do source original (webhook ou schedule)',
  'var fromWebhook = $("receber_busca_dashboard").isExecuted;',
  'var rawSrc = fromWebhook',
  '  ? $("receber_busca_dashboard").first().json',
  '  : $("parametros_schedule").first().json;',
  'var rawBody  = rawSrc.body || rawSrc;',
  'var user_id  = rawBody.user_id  || "";',
  'var search_id = params.search_id || rawBody.search_id || "";',
  '',
  'var pessoas = resposta.people || [];',
  'console.log("Apollo retornou:", pessoas.length, "pessoas");',
  '',
  '// Filtra so quem tem email',
  'var comEmail = pessoas.filter(function(p) { return p.email; });',
  'console.log("Com email:", comEmail.length);',
  '',
  'if (comEmail.length === 0) {',
  '  return [{ json: { _sem_resultado: true, _meta_bruta: pessoas.length } }];',
  '}',
  '',
  '// Limita a quantidade pedida',
  'var quantidade = parseInt(params.quantidade_pedida) || 10;',
  'var selecionados = comEmail.slice(0, quantidade);',
  '',
  'return selecionados.map(function(p) {',
  '  var org      = p.organization || {};',
  '  var id_unico = "apollo:" + (p.id || p.email);',
  '  var nome     = p.name || ((p.first_name||"") + " " + (p.last_name||"")).trim();',
  '',
  '  return { json: {',
  '    // Campos esperados pelo HTTP Request6',
  '    Empresa:           org.name || "Apollo Lead",',
  '    empresa:           org.name || "Apollo Lead",',
  '    Telefone:          id_unico,',
  '    telefone:          id_unico,',
  '    email:             p.email,',
  '    _email:            p.email,',
  '    Cidade:            params.cidade || "São Paulo",',
  '    cidade:            params.cidade || "São Paulo",',
  '    Estado:            params.estado || "SP",',
  '    estado:            params.estado || "SP",',
  '    _comprador_nome:   nome,',
  '    _comprador_cargo:  p.title || "",',
  '    _linkedin_url:     p.linkedin_url || "",',
  '    _fonte_email:      "apollo_direto",',
  '    _status_final:     "PROSPECTADOS",',
  '    search_id:         search_id,',
  '    user_id:           user_id,',
  '    tipo_loja:         params.tipo_loja || "SUPERMERCADO",',
  '    quantidade_pedida: quantidade',
  '  }};',
  '});'
].join('\n');

var processarPos = [montarPos[0], montarPos[1]];

var processarNode = {
  id: 'processar-apollo-leads-node',
  name: 'processar_apollo_leads',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: processarPos,
  continueOnFail: false,
  parameters: {
    mode: 'runOnceForAllItems',
    jsCode: processarCode
  }
};

var jaTemProcessar = d.nodes.find(function(n) { return n.name === 'processar_apollo_leads'; });
if (!jaTemProcessar) {
  d.nodes.push(processarNode);
  console.log('OK processar_apollo_leads: adicionado');
} else {
  jaTemProcessar.parameters = processarNode.parameters;
  jaTemProcessar.disabled   = false;
  console.log('OK processar_apollo_leads: atualizado');
}

// ── 4. Atualiza conexoes ──────────────────────────────────────────────────────
// extrair_params → buscar_compradores_apollo
d.connections['extrair_params'] = {
  main: [[{ node: 'buscar_compradores_apollo', type: 'main', index: 0 }]]
};
console.log('OK extrair_params → buscar_compradores_apollo');

// buscar_compradores_apollo → processar_apollo_leads
d.connections['buscar_compradores_apollo'] = {
  main: [[{ node: 'processar_apollo_leads', type: 'main', index: 0 }]]
};
console.log('OK buscar_compradores_apollo → processar_apollo_leads');

// processar_apollo_leads → HTTP Request6 (mesmo destino que montar_lead_linkedin tinha)
d.connections['processar_apollo_leads'] = {
  main: [[{ node: 'HTTP Request6', type: 'main', index: 0 }]]
};
console.log('OK processar_apollo_leads → HTTP Request6');

// ── Valida sintaxe dos Code nodes ─────────────────────────────────────────────
try {
  new Function('return async function() { ' + processarCode + ' }');
  console.log('OK Sintaxe processar_apollo_leads valida');
} catch(e) {
  console.error('ERRO SINTAXE processar_apollo_leads:', e.message);
  process.exit(1);
}

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao final ─────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var apolloNode    = d.nodes.find(function(n) { return n.name === 'buscar_compradores_apollo'; });
var processarFinal = d.nodes.find(function(n) { return n.name === 'processar_apollo_leads'; });

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v60',                              json.includes('Victor Pizza v60')],
  ['buscar_compradores_apollo adicionado',   !!apolloNode],
  ['Apollo: URL mixed_people/search',        apolloNode && JSON.stringify(apolloNode.parameters).includes('mixed_people/search')],
  ['Apollo: contact_email_status',           apolloNode && JSON.stringify(apolloNode.parameters).includes('contact_email_status')],
  ['Apollo: API key configurada',            apolloNode && JSON.stringify(apolloNode.parameters).includes(APOLLO_API_KEY)],
  ['processar_apollo_leads adicionado',      !!processarFinal],
  ['processar: modo runOnceForAllItems',     processarFinal && processarFinal.parameters.mode === 'runOnceForAllItems'],
  ['processar: le user_id do source',        processarCode.includes('rawBody.user_id')],
  ['processar: limita por quantidade',       processarCode.includes('slice(0, quantidade)')],
  ['extrair_params → Apollo',               d.connections['extrair_params'].main[0][0].node === 'buscar_compradores_apollo'],
  ['Apollo → processar',                    d.connections['buscar_compradores_apollo'].main[0][0].node === 'processar_apollo_leads'],
  ['processar → HTTP Request6',             d.connections['processar_apollo_leads'].main[0][0].node === 'HTTP Request6'],
  ['nodes antigos desativados',             desativados >= 4],
  ['Gmail mantido',                         json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',               json.includes('"schedule_diario"')],
].forEach(function(c) {
  console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]);
});

console.log('\n=== PIPELINE v60 ===');
console.log('Dashboard/Schedule');
console.log('  ↓');
console.log('extrair_params (le tipo_loja, cidade, quantidade, search_id)');
console.log('  ↓');
console.log('buscar_compradores_apollo (POST api.apollo.io/mixed_people/search)');
console.log('  corpo: { person_titles, person_locations, contact_email_status, per_page }');
console.log('  ↓');
console.log('processar_apollo_leads (mapeia people[] → leads individuais com email)');
console.log('  ↓');
console.log('HTTP Request6 (salva no Supabase como PROSPECTADOS)');
console.log('  ↓');
console.log('tem_email → montar_email → enviar_email_gmail → patch_busca_concluida');

console.log('\n=== PROXIMOS PASSOS ===');
console.log('1. Importe Fluxo_victor_pizza_v60.json no n8n');
console.log('2. Execute o node "buscar_compradores_apollo" com Execute step');
console.log('   Output esperado: { people: [ { name, email, title, organization } ] }');
console.log('3. Execute "processar_apollo_leads"');
console.log('   Output esperado: N itens com { Empresa, email, _comprador_nome, ... }');
console.log('4. Se people[] vier vazio: Apollo nao tem compradores em SP no setor');
console.log('   → Tentar remover contact_email_status para ver o volume total');
