const fs = require('fs');

// v61: HarvestAPI retorna email direto na busca LinkedIn
//
// MUDANCA PRINCIPAL: adiciona profileScraperMode: "Full + email search" no apify_linkedin_search
// Isso elimina o passo separado de buscar email (apify_linkedin_email + normalizar_apollo)
//
// PIPELINE v61:
//   apify_linkedin_search (com profileScraperMode) → coletar_urls_linkedin → montar_lead_linkedin → HTTP Request6
//
// CUSTO: $0.10/pagina + $0.01/perfil com email (~R$0,05/lead)
// Confirmado pelo Claude AI: campo "profileScraperMode", valor "Full + email search"

var INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v59.json';
var OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v61.json';

if (!fs.existsSync(INPUT)) {
  console.error('ERRO: Arquivo de entrada nao encontrado: ' + INPUT);
  process.exit(1);
}

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v61 - email direto no LinkedIn Search';
console.log('OK Fluxo carregado: ' + INPUT);

// ── 1. apify_linkedin_search: adiciona profileScraperMode ────────────────────
var searchNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_search'; });
if (!searchNode) { console.error('ERRO: apify_linkedin_search nao encontrado'); process.exit(1); }

searchNode.parameters.customBody = [
  '={{ JSON.stringify({',
  '  searchQuery:        $json.searchQuery,',
  '  locations:          $json.locations,',
  '  maxItems:           $json.maxItems,',
  '  profileScraperMode: "Full + email search"',
  '}) }}'
].join('\n');
console.log('OK apify_linkedin_search: profileScraperMode "Full + email search" adicionado');

// ── 2. coletar_urls_linkedin: captura email do resultado da busca ─────────────
var coletarNode = d.nodes.find(function(n) { return n.name === 'coletar_urls_linkedin'; });
if (!coletarNode) { console.error('ERRO: coletar_urls_linkedin nao encontrado'); process.exit(1); }

// Le metadata de preparar_busca_linkedin para passar adiante
// (antes era passado via normalizar_apollo/Apollo, agora vai direto pro montar_lead_linkedin)
var coletarCode = [
  '// Captura perfis COM email do resultado do HarvestAPI "Full + email search"',
  'var perfis = $input.all();',
  'var prep   = $("preparar_busca_linkedin").first().json;',
  '',
  '// Recupera user_id do source original',
  'var fromWebhook = $("receber_busca_dashboard").isExecuted;',
  'var rawSrc  = fromWebhook',
  '  ? $("receber_busca_dashboard").first().json',
  '  : $("parametros_schedule").first().json;',
  'var rawBody  = rawSrc.body || rawSrc;',
  'var user_id  = rawBody.user_id  || "";',
  'var search_id = prep.search_id || rawBody.search_id || "";',
  '',
  'console.log("Total perfis recebidos:", perfis.length);',
  '',
  'var comEmail = perfis.filter(function(i) { return i.json.email; });',
  'console.log("Perfis com email:", comEmail.length);',
  '',
  'if (comEmail.length === 0) {',
  '  // Sem email: retorna itens sem email para nao travar o fluxo',
  '  var semEmail = perfis.filter(function(i) { return i.json.linkedinUrl; });',
  '  if (semEmail.length === 0) {',
  '    return [{ json: { _sem_resultado: true, _meta_bruta: perfis.length } }];',
  '  }',
  '  return semEmail.map(function(i) {',
  '    return { json: {',
  '      linkedinUrl:  i.json.linkedinUrl,',
  '      firstName:    i.json.firstName || "",',
  '      lastName:     i.json.lastName  || "",',
  '      email:        null,',
  '      _cidade:      prep._cidade || prep.cidade || "",',
  '      _estado:      prep._estado || prep.estado || "SP",',
  '      _search_id:   search_id,',
  '      _user_id:     user_id,',
  '      _tipo_loja:   prep._tipo_loja || prep.tipo_loja || "SUPERMERCADO",',
  '      _quantidade_pedida: prep._quantidade_pedida || prep.quantidade_pedida || 10,',
  '      _meta_bruta:  perfis.length',
  '    }};',
  '  });',
  '}',
  '',
  'return comEmail.map(function(i) {',
  '  return { json: {',
  '    linkedinUrl:   i.json.linkedinUrl   || "",',
  '    firstName:     i.json.firstName     || "",',
  '    lastName:      i.json.lastName      || "",',
  '    email:         i.json.email,',
  '    companyName:   i.json.companyName   || i.json.currentCompany || "",',
  '    headline:      i.json.headline      || i.json.jobTitle || "",',
  '    publicIdentifier: i.json.publicIdentifier || "",',
  '    profileUrl:    i.json.linkedinUrl   || "",',
  '    // Metadata para montar_lead_linkedin',
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
console.log('OK coletar_urls_linkedin: captura email do HarvestAPI + metadata');

// ── 3. montar_lead_linkedin: le email do item direto (nao do Apollo) ──────────
var montarNode = d.nodes.find(function(n) { return n.name === 'montar_lead_linkedin'; });
if (!montarNode) { console.error('ERRO: montar_lead_linkedin nao encontrado'); process.exit(1); }

// Atualiza para ler do item direto (que agora contem tudo, vindo de coletar_urls_linkedin)
var montarCode = [
  'var p = $input.item.json;',
  '',
  '// Ignora perfis sem email',
  'if (!p.email) return [];',
  '',
  '// LinkedIn publicIdentifier como chave unica (substitui telefone)',
  'var id_slug  = p.publicIdentifier || "";',
  'if (!id_slug && p.linkedinUrl) {',
  '  id_slug = String(p.linkedinUrl).replace("https://www.linkedin.com/in/","").replace(/\\/$/,"");',
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
  '  _linkedin_url:     p.linkedinUrl || "",',
  '  _fonte_email:      "linkedin_harvestapi",',
  '  _status_final:     "PROSPECTADOS",',
  '  search_id:         p._search_id || "",',
  '  user_id:           p._user_id   || "",',
  '  tipo_loja:         p._tipo_loja || "SUPERMERCADO",',
  '  quantidade_pedida: p._quantidade_pedida || 10',
  '} }];'
].join('\n');

montarNode.parameters.jsCode = montarCode;
console.log('OK montar_lead_linkedin: le email direto do item (sem referencia ao Apollo)');

// ── 4. Desativa nodes que nao sao mais necessarios ────────────────────────────
['apify_linkedin_email', 'normalizar_apollo'].forEach(function(nome) {
  var n = d.nodes.find(function(x) { return x.name === nome; });
  if (n) { n.disabled = true; console.log('OK desativado: ' + nome); }
});

// ── 5. Atualiza conexoes ──────────────────────────────────────────────────────
// coletar_urls_linkedin → montar_lead_linkedin (pula apify_linkedin_email e normalizar_apollo)
d.connections['coletar_urls_linkedin'] = {
  main: [[{ node: 'montar_lead_linkedin', type: 'main', index: 0 }]]
};
console.log('OK conexao: coletar_urls_linkedin → montar_lead_linkedin (direto)');

// ── Valida sintaxes ───────────────────────────────────────────────────────────
[['coletar_urls_linkedin', coletarCode], ['montar_lead_linkedin', montarCode]].forEach(function(pair) {
  try {
    new Function('return async function() { ' + pair[1] + ' }');
    console.log('OK Sintaxe ' + pair[0] + ' valida');
  } catch(e) {
    console.error('ERRO SINTAXE ' + pair[0] + ': ' + e.message);
    process.exit(1);
  }
});

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao final ─────────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v61',                              json.includes('Victor Pizza v61')],
  ['profileScraperMode no customBody',      searchNode.parameters.customBody.includes('profileScraperMode')],
  ['valor "Full + email search"',           searchNode.parameters.customBody.includes('Full + email search')],
  ['coletar: captura email',                coletarCode.includes('i.json.email')],
  ['coletar: passa metadata _user_id',      coletarCode.includes('_user_id')],
  ['montar: le email do item direto',       montarCode.includes('p.email')],
  ['montar: sem referencia ao Apollo',     !montarCode.includes('coletar_urls_linkedin')],
  ['apify_linkedin_email desativado',       d.nodes.find(function(n){return n.name==='apify_linkedin_email';}).disabled === true],
  ['normalizar_apollo desativado',          d.nodes.find(function(n){return n.name==='normalizar_apollo';}).disabled === true],
  ['conexao coletar → montar direto',       d.connections['coletar_urls_linkedin'].main[0][0].node === 'montar_lead_linkedin'],
  ['Gmail mantido',                         json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',               json.includes('"schedule_diario"')],
].forEach(function(c) {
  console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]);
});

console.log('\n=== PIPELINE v61 ===');
console.log('Schedule / Dashboard');
console.log('  ↓');
console.log('extrair_params → preparar_busca_linkedin');
console.log('  ↓');
console.log('apify_linkedin_search (profileScraperMode: "Full + email search")');
console.log('  ↓  retorna: firstName, lastName, email, companyName, linkedinUrl');
console.log('coletar_urls_linkedin (filtra perfis com email + adiciona metadata)');
console.log('  ↓');
console.log('montar_lead_linkedin (formata para Supabase)');
console.log('  ↓');
console.log('HTTP Request6 → tem_email → montar_email → Gmail → patch_busca_concluida');

console.log('\n=== PROXIMOS PASSOS ===');
console.log('1. Importe Fluxo_victor_pizza_v61.json no n8n');
console.log('2. Execute o fluxo completo ou step-by-step');
console.log('3. No output de apify_linkedin_search: verifique se campo "email" aparece');
console.log('4. No output de coletar_urls_linkedin: so perfis com email devem aparecer');
console.log('5. No output de montar_lead_linkedin: { Empresa, email, _comprador_nome }');
