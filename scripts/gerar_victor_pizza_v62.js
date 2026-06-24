const fs = require('fs');

// v62: pipeline híbrido — HarvestAPI email + Apollo people/match como fallback
//
// PROBLEMA v61: coletar_urls_linkedin mostra 25 itens mas "email: [null]"
//   → HarvestAPI encontrou os perfis mas NÃO conseguiu extrair email para nenhum
//   → Duas causas possíveis:
//     (A) nome do campo errado — HarvestAPI usa workEmail/personalEmail/emails[]
//     (B) actor não encontrou email para esses compradores específicos
//
// SOLUCAO v62: híbrido (melhor dos dois mundos)
//   1. coletar_urls_linkedin: tenta TODOS os nomes de campo possíveis para email
//      e loga os campos disponíveis no primeiro item (para diagnóstico)
//   2. apify_linkedin_email (Apollo people/match): reativado como fallback
//   3. normalizar_apollo: atualizado para preferir email do HarvestAPI
//      e só usar Apollo se HarvestAPI não tiver
//   4. montar_lead_linkedin: lê do normalizar_apollo (formato v58/v59)
//
// PIPELINE v62:
//   apify_linkedin_search (profileScraperMode) → coletar_urls_linkedin
//     → apify_linkedin_email (Apollo) → normalizar_apollo → montar_lead_linkedin
//
// DIFERENÇA v61 → v62:
//   v61: skip Apollo, lê email direto → FALHOU (email null)
//   v62: tenta HarvestAPI email primeiro, Apollo como fallback

var INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v61.json';
var OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v62.json';

if (!fs.existsSync(INPUT)) {
  console.error('ERRO: Arquivo de entrada nao encontrado: ' + INPUT);
  process.exit(1);
}

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v62 - HarvestAPI email + Apollo fallback';
console.log('OK Fluxo carregado: ' + INPUT);

// ── 1. apify_linkedin_search: mantém profileScraperMode (ja estava no v61) ─────
var searchNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_search'; });
if (!searchNode) { console.error('ERRO: apify_linkedin_search nao encontrado'); process.exit(1); }

// Confirma que profileScraperMode ainda está lá
if (searchNode.parameters.customBody && searchNode.parameters.customBody.includes('profileScraperMode')) {
  console.log('OK apify_linkedin_search: profileScraperMode já presente (mantido do v61)');
} else {
  // Adiciona caso tenha sido perdido
  searchNode.parameters.customBody = [
    '={{ JSON.stringify({',
    '  searchQuery:        $json.searchQuery,',
    '  locations:          $json.locations,',
    '  maxItems:           $json.maxItems,',
    '  profileScraperMode: "Full + email search"',
    '}) }}'
  ].join('\n');
  console.log('OK apify_linkedin_search: profileScraperMode adicionado');
}

// ── 2. coletar_urls_linkedin: tenta todos os campos de email possíveis ──────────
var coletarNode = d.nodes.find(function(n) { return n.name === 'coletar_urls_linkedin'; });
if (!coletarNode) { console.error('ERRO: coletar_urls_linkedin nao encontrado'); process.exit(1); }

var coletarCode = [
  '// v62: tenta todos os nomes de campo de email do HarvestAPI',
  '// Campo pode ser: email, workEmail, personalEmail, emails[] etc.',
  'var perfis = $input.all();',
  'var prep   = $("preparar_busca_linkedin").first().json;',
  '',
  '// Recupera user_id/search_id do source original',
  'var fromWebhook = $("receber_busca_dashboard").isExecuted;',
  'var rawSrc  = fromWebhook',
  '  ? $("receber_busca_dashboard").first().json',
  '  : $("parametros_schedule").first().json;',
  'var rawBody   = rawSrc.body || rawSrc;',
  'var user_id   = rawBody.user_id  || "";',
  'var search_id = prep.search_id || rawBody.search_id || "";',
  '',
  'console.log("Total perfis recebidos:", perfis.length);',
  '',
  '// DEBUG: mostra campos disponíveis no primeiro item (para diagnóstico)',
  'if (perfis.length > 0) {',
  '  var primeiroItem = perfis[0].json;',
  '  console.log("=== CAMPOS DISPONÍVEIS NO 1o ITEM ===");',
  '  console.log(JSON.stringify(Object.keys(primeiroItem)));',
  '  // Campos de email específicos',
  '  console.log("email:", primeiroItem.email);',
  '  console.log("workEmail:", primeiroItem.workEmail);',
  '  console.log("personalEmail:", primeiroItem.personalEmail);',
  '  console.log("emails:", JSON.stringify(primeiroItem.emails));',
  '  console.log("====================================");',
  '}',
  '',
  '// Filtra perfis COM linkedinUrl (requisito mínimo para o Apollo)',
  'var comUrl = perfis.filter(function(i) { return i.json.linkedinUrl; });',
  'console.log("Perfis com linkedinUrl:", comUrl.length);',
  '',
  'if (comUrl.length === 0) {',
  '  return [{ json: { _sem_resultado: true, _meta_bruta: perfis.length } }];',
  '}',
  '',
  'return comUrl.map(function(i) {',
  '  var j = i.json;',
  '',
  '  // Tenta todos os nomes de campo de email do HarvestAPI',
  '  var harvestEmail =',
  '    j.email ||',
  '    j.workEmail ||',
  '    j.personalEmail ||',
  '    (Array.isArray(j.emails) && j.emails.length > 0 ? j.emails[0] : null) ||',
  '    null;',
  '',
  '  if (harvestEmail) {',
  '    console.log("HarvestAPI email encontrado:", harvestEmail, "para", j.linkedinUrl);',
  '  }',
  '',
  '  return { json: {',
  '    linkedinUrl:  j.linkedinUrl,',
  '    firstName:    j.firstName || "",',
  '    lastName:     j.lastName  || "",',
  '    companyName:  j.companyName || j.currentCompany || "",',
  '    headline:     j.headline || j.jobTitle || "",',
  '    publicIdentifier: j.publicIdentifier || "",',
  '    // Email do HarvestAPI (null se nao encontrou — Apollo vai tentar depois)',
  '    _harvest_email: harvestEmail,',
  '    // Metadata para downstream',
  '    _cidade:       prep._cidade || prep.cidade || "",',
  '    _estado:       prep._estado || prep.estado || "SP",',
  '    _search_id:    search_id,',
  '    _user_id:      user_id,',
  '    _tipo_loja:    prep._tipo_loja || prep.tipo_loja || "SUPERMERCADO",',
  '    _quantidade_pedida: prep._quantidade_pedida || prep.quantidade_pedida || 10,',
  '    _meta_bruta:   perfis.length',
  '  }};',
  '});'
].join('\n');

coletarNode.parameters.jsCode = coletarCode;
coletarNode.parameters.mode   = 'runOnceForAllItems';
console.log('OK coletar_urls_linkedin: tenta todos os campos de email + debug logging');

// ── 3. apify_linkedin_email: reativa (Apollo people/match como fallback) ────────
var emailNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_email'; });
if (!emailNode) { console.error('ERRO: apify_linkedin_email nao encontrado'); process.exit(1); }

emailNode.disabled = false;

// Garante que está configurado como HTTP Request para Apollo (v58)
if (emailNode.type !== 'n8n-nodes-base.httpRequest') {
  console.log('AVISO: apify_linkedin_email nao e HTTP Request — revertendo para Apollo');
  emailNode.type        = 'n8n-nodes-base.httpRequest';
  emailNode.typeVersion = 4.2;
  emailNode.continueOnFail = true;
  emailNode.parameters = {
    method: 'POST',
    url: 'https://api.apollo.io/api/v1/people/match',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'X-Api-Key',     value: 'osbIKBwqiIxlaknIF1i7aw' },
        { name: 'Content-Type',  value: 'application/json' },
        { name: 'Cache-Control', value: 'no-cache' }
      ]
    },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: '={{ JSON.stringify({ linkedin_url: $json.linkedinUrl, reveal_personal_emails: true, reveal_phone_number: false }) }}',
    options: {}
  };
} else {
  emailNode.continueOnFail = true;
  console.log('OK apify_linkedin_email: já e HTTP Request Apollo — reativado');
}
console.log('OK apify_linkedin_email: reativado (Apollo people/match fallback)');

// ── 4. normalizar_apollo: prefere HarvestAPI email, Apollo como fallback ─────────
var normNode = d.nodes.find(function(n) { return n.name === 'normalizar_apollo'; });
if (!normNode) { console.error('ERRO: normalizar_apollo nao encontrado'); process.exit(1); }

normNode.disabled = false;

var normCode = [
  '// v62: HarvestAPI email como fonte primária, Apollo como fallback',
  '// Apollo retorna: { person: { email, first_name, last_name, linkedin_url } }',
  '',
  'var resposta  = $input.first().json;',
  'var linkedin  = $("coletar_urls_linkedin").item.json;',
  '',
  '// Email do HarvestAPI (já tentamos todos os nomes de campo)',
  'var harvestEmail = linkedin._harvest_email || null;',
  '',
  '// Email do Apollo (fallback)',
  'var pessoa = resposta.person || null;',
  'var apolloEmail = pessoa && pessoa.email ? pessoa.email : null;',
  '',
  '// Usa HarvestAPI primeiro, Apollo como fallback',
  'var email = harvestEmail || apolloEmail || null;',
  'var fonte = harvestEmail ? "harvestapi" : (apolloEmail ? "apollo" : null);',
  '',
  'if (email) {',
  '  console.log("Email encontrado (" + fonte + "):", email);',
  '} else {',
  '  console.log("Sem email para:", linkedin.linkedinUrl || "?");',
  '}',
  '',
  '// Verifica setor via Apollo (industry da empresa)',
  'var org      = pessoa && pessoa.organization ? pessoa.organization : null;',
  'var industry = org && org.industry ? org.industry.toLowerCase() : "";',
  '',
  'var SETOR_VALIDO = [',
  '  "food", "beverage", "grocery", "supermarket", "retail",',
  '  "wholesale", "atacado", "aliment", "varejo", "distribu", "consumer goods"',
  '];',
  'var setorOk = industry',
  '  ? SETOR_VALIDO.some(function(s) { return industry.includes(s); })',
  '  : true;  // sem dado de industry: deixa passar',
  '',
  'return [{ json: {',
  '  url:        linkedin.linkedinUrl || (pessoa && pessoa.linkedin_url) || "",',
  '  email:      email,',
  '  firstName:  pessoa ? (pessoa.first_name || linkedin.firstName || "") : (linkedin.firstName || ""),',
  '  lastName:   pessoa ? (pessoa.last_name  || linkedin.lastName  || "") : (linkedin.lastName  || ""),',
  '  companyName: linkedin.companyName || (org && org.name) || "",',
  '  headline:   linkedin.headline || (pessoa && pessoa.title) || "",',
  '  publicIdentifier: linkedin.publicIdentifier || "",',
  '  // Metadados',
  '  _fonte_email:  fonte || "nenhuma",',
  '  _apollo_ok:    !!apolloEmail,',
  '  _harvest_ok:   !!harvestEmail,',
  '  _setor_ok:     setorOk,',
  '  _industry:     industry || "",',
  '  _cidade:       linkedin._cidade || "",',
  '  _estado:       linkedin._estado || "SP",',
  '  _search_id:    linkedin._search_id || "",',
  '  _user_id:      linkedin._user_id   || "",',
  '  _tipo_loja:    linkedin._tipo_loja  || "SUPERMERCADO",',
  '  _quantidade_pedida: linkedin._quantidade_pedida || 10,',
  '  _meta_bruta:   linkedin._meta_bruta || 0',
  '}}];'
].join('\n');

normNode.parameters.jsCode = normCode;
normNode.parameters.mode   = 'runOnceForEachItem';
console.log('OK normalizar_apollo: reativado — HarvestAPI primeiro, Apollo fallback');

// ── 5. montar_lead_linkedin: lê do normalizar_apollo (formato v58/v59) ──────────
var montarNode = d.nodes.find(function(n) { return n.name === 'montar_lead_linkedin'; });
if (!montarNode) { console.error('ERRO: montar_lead_linkedin nao encontrado'); process.exit(1); }

var montarCode = [
  'var p = $input.item.json;',
  '',
  '// Ignora perfis sem email',
  'if (!p.email) return [];',
  '',
  '// LinkedIn publicIdentifier como chave única',
  'var id_slug  = p.publicIdentifier || "";',
  'if (!id_slug && p.url) {',
  '  id_slug = String(p.url).replace("https://www.linkedin.com/in/","").replace(/\\/$/,"");',
  '}',
  'var id_unico = "li:" + id_slug;',
  '',
  'return [{ json: {',
  '  Empresa:           p.companyName || "LinkedIn Lead",',
  '  empresa:           p.companyName || "LinkedIn Lead",',
  '  Telefone:          id_unico,',
  '  telefone:          id_unico,',
  '  email:             p.email,',
  '  _email:            p.email,',
  '  Cidade:            p._cidade || "",',
  '  cidade:            p._cidade || "",',
  '  Estado:            p._estado || "SP",',
  '  estado:            p._estado || "SP",',
  '  _comprador_nome:   ((p.firstName||"") + " " + (p.lastName||"")).trim(),',
  '  _comprador_cargo:  p.headline || "",',
  '  _linkedin_url:     p.url || "",',
  '  _fonte_email:      p._fonte_email || "desconhecida",',
  '  _status_final:     "PROSPECTADOS",',
  '  search_id:         p._search_id || "",',
  '  user_id:           p._user_id   || "",',
  '  tipo_loja:         p._tipo_loja  || "SUPERMERCADO",',
  '  quantidade_pedida: p._quantidade_pedida || 10',
  '} }];'
].join('\n');

montarNode.parameters.jsCode = montarCode;
console.log('OK montar_lead_linkedin: lê de normalizar_apollo com _fonte_email');

// ── 6. Restaura conexões: coletar → Apollo → normalizar → montar ─────────────────
d.connections['coletar_urls_linkedin'] = {
  main: [[{ node: 'apify_linkedin_email', type: 'main', index: 0 }]]
};
d.connections['apify_linkedin_email'] = {
  main: [[{ node: 'normalizar_apollo', type: 'main', index: 0 }]]
};
d.connections['normalizar_apollo'] = {
  main: [[{ node: 'montar_lead_linkedin', type: 'main', index: 0 }]]
};
console.log('OK conexoes: coletar → apify_linkedin_email (Apollo) → normalizar_apollo → montar');

// ── Valida sintaxe ────────────────────────────────────────────────────────────────
[['coletar_urls_linkedin', coletarCode], ['normalizar_apollo', normCode], ['montar_lead_linkedin', montarCode]].forEach(function(pair) {
  try {
    new Function('return async function() { ' + pair[1] + ' }');
    console.log('OK Sintaxe ' + pair[0] + ' valida');
  } catch(e) {
    console.error('ERRO SINTAXE ' + pair[0] + ': ' + e.message);
    process.exit(1);
  }
});

// ── Salva ─────────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificação final ─────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var emailNodeFinal = d.nodes.find(function(n) { return n.name === 'apify_linkedin_email'; });
var normFinal      = d.nodes.find(function(n) { return n.name === 'normalizar_apollo'; });

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v62',                                    json.includes('Victor Pizza v62')],
  ['profileScraperMode mantido',                  searchNode.parameters.customBody.includes('profileScraperMode')],
  ['coletar: tenta workEmail/personalEmail/emails', coletarCode.includes('workEmail')],
  ['coletar: debug logging de campos',            coletarCode.includes('Object.keys')],
  ['apify_linkedin_email: ativo',                 !emailNodeFinal.disabled],
  ['apify_linkedin_email: e HTTP Request Apollo', emailNodeFinal.type === 'n8n-nodes-base.httpRequest'],
  ['normalizar_apollo: ativo',                    !normFinal.disabled],
  ['normalizar: usa _harvest_email primeiro',     normCode.includes('_harvest_email')],
  ['normalizar: Apollo como fallback',            normCode.includes('apolloEmail')],
  ['normalizar: campo _fonte_email',              normCode.includes('_fonte_email')],
  ['conexao coletar → Apollo',                   d.connections['coletar_urls_linkedin'].main[0][0].node === 'apify_linkedin_email'],
  ['conexao Apollo → normalizar',                d.connections['apify_linkedin_email'].main[0][0].node === 'normalizar_apollo'],
  ['conexao normalizar → montar',                d.connections['normalizar_apollo'].main[0][0].node === 'montar_lead_linkedin'],
  ['Gmail mantido',                               json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',                     json.includes('"schedule_diario"')],
].forEach(function(c) {
  console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]);
});

console.log('\n=== PIPELINE v62 ===');
console.log('Schedule / Dashboard');
console.log('  ↓');
console.log('extrair_params → preparar_busca_linkedin');
console.log('  ↓');
console.log('apify_linkedin_search (profileScraperMode: "Full + email search")');
console.log('  ↓  retorna: firstName, lastName, companyName, linkedinUrl + email (se disponível)');
console.log('coletar_urls_linkedin');
console.log('  → tenta: email | workEmail | personalEmail | emails[0]');
console.log('  → loga campos disponíveis no 1o item (diagnóstico)');
console.log('  → passa _harvest_email para downstream');
console.log('  ↓');
console.log('apify_linkedin_email (Apollo people/match — FALLBACK)');
console.log('  → só é útil se _harvest_email = null');
console.log('  ↓');
console.log('normalizar_apollo');
console.log('  → usa _harvest_email se disponível');
console.log('  → usa email do Apollo se HarvestAPI não encontrou');
console.log('  → adiciona _fonte_email ("harvestapi" | "apollo" | "nenhuma")');
console.log('  ↓');
console.log('montar_lead_linkedin → HTTP Request6 → tem_email → montar_email → Gmail');

console.log('\n=== DIAGNÓSTICO APÓS IMPORTAR ===');
console.log('1. Execute apify_linkedin_search (normal — não muda)');
console.log('2. Execute coletar_urls_linkedin e observe o console:');
console.log('   "=== CAMPOS DISPONÍVEIS NO 1o ITEM ===" — mostra os campos reais');
console.log('   "email: null | workEmail: null | ..." — se tudo null: HarvestAPI nao achou email');
console.log('   "HarvestAPI email encontrado: x@y.com para linkedin.com/in/..." — se achou!');
console.log('3. Execute apify_linkedin_email:');
console.log('   Se Apollo retornar { person: { email: "..." } } = fallback funcionando');
console.log('4. Execute normalizar_apollo — observe _fonte_email:');
console.log('   "harvestapi" = email veio do HarvestAPI');
console.log('   "apollo"     = email veio do Apollo (fallback ativado)');
console.log('   "nenhuma"    = nenhuma fonte encontrou email');
console.log('5. Se _fonte_email = "nenhuma" para todos: compradores nao estão em nenhuma base');
console.log('   → próximo passo: tentar outro setor ou cidade maior');
