const fs = require('fs');

// v49: substitui Code node duplo por nodes nativos da Apify
// Node nativo cuida de autenticação, polling e timeout automaticamente
// Fluxo:
//   extrair_params
//   → preparar_busca_linkedin (Code — monta input do Actor 1)
//   → apify_linkedin_search   (Apify node — Actor 1: busca compradores)
//   → coletar_urls_linkedin   (Code — agrega URLs para Actor 2)
//   → verificar_resultado     (IF — sem resultado vai para erro)
//   → apify_linkedin_email    (Apify node — Actor 2: busca emails)
//   → montar_lead_linkedin    (Code — normaliza para o banco)
//   → HTTP Request6 → Gmail

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v48.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v49.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v49 - LinkedIn com nodes nativos Apify';
console.log('OK Nome atualizado');

// Credencial Apify existente no n8n (reutiliza a mesma do Google Maps)
var APIFY_CREDENTIAL = { id: 'I3BWKYwZ5RnVJbUf', name: 'Apify account 2' };

// ── 1. preparar_busca_linkedin (Code — monta input do Actor 1) ────────────────
var L1 = [];
L1.push("var ep = $input.item.json;");
L1.push("var tipo_loja         = String(ep.tipo_loja         || 'SUPERMERCADO');");
L1.push("var estado            = String(ep.estado            || 'SP');");
L1.push("var cidade            = String(ep.cidade            || '');");
L1.push("var quantidade_pedida = parseInt(ep.quantidade_pedida || 10);");
L1.push("");
L1.push("var CARGO_MAP = {");
L1.push("  'SUPERMERCADO':  ['Comprador', 'Gerente de Compras', 'Diretor de Compras', 'Head de Compras'],");
L1.push("  'ATACADISTA':    ['Comprador', 'Gerente de Compras', 'Diretor Comercial'],");
L1.push("  'DISTRIBUIDORA': ['Comprador', 'Diretor de Compras', 'Gerente Comercial']");
L1.push("};");
L1.push("var cargos      = CARGO_MAP[tipo_loja] || CARGO_MAP['SUPERMERCADO'];");
L1.push("var localizacao = cidade ? (cidade + ', ' + estado + ', Brazil') : (estado + ', Brazil');");
L1.push("");
L1.push("return [{ json: {");
L1.push("  searchQuery:       cargos[0] + ' OR \"' + cargos[1] + '\"',");
L1.push("  currentJobTitles:  cargos,");
L1.push("  locations:         [localizacao],");
L1.push("  maxItems:          quantidade_pedida * 3,");
L1.push("  // metadata para usar em nodes posteriores");
L1.push("  _tipo_loja:         tipo_loja,");
L1.push("  _estado:            estado,");
L1.push("  _cidade:            cidade,");
L1.push("  _quantidade_pedida: quantidade_pedida,");
L1.push("  _search_id:         String(ep.search_id || ''),");
L1.push("  _user_id:           String(ep.user_id   || '')");
L1.push("} }];");
var jsCode1 = L1.join('\n');

// ── 2. coletar_urls_linkedin (Code — agrega resultados do Actor 1) ────────────
var L2 = [];
L2.push("// Roda uma vez para TODOS os items do Actor 1");
L2.push("var perfis = $input.all().filter(function(i) { return i.json.profileUrl; });");
L2.push("var prep   = $('preparar_busca_linkedin').first().json;");
L2.push("");
L2.push("console.log('Actor1 retornou:', perfis.length, 'perfis com URL');");
L2.push("");
L2.push("if (perfis.length === 0) {");
L2.push("  return [{ json: { _sem_resultado: true, _meta_bruta: 0 } }];");
L2.push("}");
L2.push("");
L2.push("var urls = perfis");
L2.push("  .slice(0, prep._quantidade_pedida * 2)");
L2.push("  .map(function(i) { return i.json.profileUrl; });");
L2.push("");
L2.push("return [{ json: {");
L2.push("  // Input para o Actor 2");
L2.push("  profileScraperMode: 'Profile details + email search ($10 per 1k)',");
L2.push("  queries: urls,");
L2.push("  // Metadata");
L2.push("  _meta_bruta:        perfis.length,");
L2.push("  _tipo_loja:         prep._tipo_loja,");
L2.push("  _estado:            prep._estado,");
L2.push("  _cidade:            prep._cidade,");
L2.push("  _quantidade_pedida: prep._quantidade_pedida,");
L2.push("  _search_id:         prep._search_id,");
L2.push("  _user_id:           prep._user_id");
L2.push("} }];");
var jsCode2 = L2.join('\n');

// ── 3. montar_lead_linkedin (Code — normaliza um perfil para o banco) ─────────
var L3 = [];
L3.push("var p    = $input.item.json;");
L3.push("var meta = $('coletar_urls_linkedin').first().json;");
L3.push("");
L3.push("// Ignora perfis sem email");
L3.push("if (!p.email) return [];");
L3.push("");
L3.push("// LinkedIn publicIdentifier como chave unica (substitui telefone)");
L3.push("var id_slug  = p.publicIdentifier || p.id || '';");
L3.push("if (!id_slug && p.profileUrl) {");
L3.push("  id_slug = String(p.profileUrl).replace('https://www.linkedin.com/in/','').replace(/\\/$/,'');");
L3.push("}");
L3.push("var id_unico = 'li:' + id_slug;");
L3.push("");
L3.push("return [{ json: {");
L3.push("  Empresa:           p.companyName || p.currentCompany || 'LinkedIn Lead',");
L3.push("  empresa:           p.companyName || p.currentCompany || 'LinkedIn Lead',");
L3.push("  Telefone:          id_unico,");
L3.push("  telefone:          id_unico,");
L3.push("  email:             p.email,");
L3.push("  _email:            p.email,");
L3.push("  Cidade:            meta._cidade || '',");
L3.push("  cidade:            meta._cidade || '',");
L3.push("  Estado:            meta._estado || 'SP',");
L3.push("  estado:            meta._estado || 'SP',");
L3.push("  _comprador_nome:   ((p.firstName||'') + ' ' + (p.lastName||'')).trim(),");
L3.push("  _comprador_cargo:  p.headline || p.jobTitle || '',");
L3.push("  _linkedin_url:     p.profileUrl || '',");
L3.push("  _fonte_email:      'linkedin_comprador',");
L3.push("  _status_final:     'PROSPECTADOS',");
L3.push("  search_id:         meta._search_id,");
L3.push("  user_id:           meta._user_id,");
L3.push("  tipo_loja:         meta._tipo_loja,");
L3.push("  quantidade_pedida: meta._quantidade_pedida");
L3.push("} }];");
var jsCode3 = L3.join('\n');

// Valida sintaxe
[['jsCode1', jsCode1], ['jsCode2', jsCode2], ['jsCode3', jsCode3]].forEach(function(pair) {
  try {
    new Function('return async function() { ' + pair[1] + ' }');
    console.log('OK Sintaxe:', pair[0]);
  } catch(e) {
    console.error('ERRO SINTAXE', pair[0], ':', e.message);
    process.exit(1);
  }
});

// ── 4. Remove nodes do v48 que serão substituídos ────────────────────────────
var REMOVER = ['buscar_compradores_linkedin', 'enriquecer_comprador_linkedin'];
var antes = d.nodes.length;
d.nodes = d.nodes.filter(function(n) { return !REMOVER.includes(n.name); });
console.log('OK Nodes removidos:', antes - d.nodes.length, '→', REMOVER.join(', '));

// ── 5. Atualiza montar_lead_linkedin existente ────────────────────────────────
var mlNode = d.nodes.find(function(n) { return n.name === 'montar_lead_linkedin'; });
if (mlNode) {
  mlNode.parameters.jsCode = jsCode3;
  mlNode.parameters.mode = 'runOnceForEachItem';
  mlNode.position = [13000, 10480];
  console.log('OK montar_lead_linkedin jsCode atualizado');
} else {
  // Cria do zero
  d.nodes.push({
    id: 'montar-lead-linkedin-v49',
    name: 'montar_lead_linkedin',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [13000, 10480],
    parameters: { mode: 'runOnceForEachItem', jsCode: jsCode3 }
  });
  console.log('OK montar_lead_linkedin criado do zero');
}

// ── 6. Adiciona os 3 novos nodes ─────────────────────────────────────────────
d.nodes.push({
  id: 'preparar-busca-linkedin-v49',
  name: 'preparar_busca_linkedin',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [12000, 10480],
  parameters: { mode: 'runOnceForEachItem', jsCode: jsCode1 }
});

d.nodes.push({
  id: 'apify-linkedin-search-v49',
  name: 'apify_linkedin_search',
  type: '@apify/n8n-nodes-apify.apify',
  typeVersion: 1,
  position: [12200, 10480],
  continueOnFail: true,
  credentials: { apifyApi: APIFY_CREDENTIAL },
  parameters: {
    operation: 'Run actor and get dataset',
    actorId: {
      __rl: true,
      value: 'harvestapi/linkedin-profile-search',
      mode: 'id'
    },
    customBody: "={{ JSON.stringify({\n  searchQuery:      $json.searchQuery,\n  currentJobTitles: $json.currentJobTitles,\n  locations:        $json.locations,\n  maxItems:         $json.maxItems\n}) }}",
    options: { timeout: 300000 }
  }
});

d.nodes.push({
  id: 'coletar-urls-linkedin-v49',
  name: 'coletar_urls_linkedin',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [12400, 10480],
  parameters: { mode: 'runOnceForAllItems', jsCode: jsCode2 }
});

d.nodes.push({
  id: 'apify-linkedin-email-v49',
  name: 'apify_linkedin_email',
  type: '@apify/n8n-nodes-apify.apify',
  typeVersion: 1,
  position: [12700, 10480],
  continueOnFail: true,
  credentials: { apifyApi: APIFY_CREDENTIAL },
  parameters: {
    operation: 'Run actor and get dataset',
    actorId: {
      __rl: true,
      value: 'harvestapi/linkedin-profile-scraper',
      mode: 'id'
    },
    customBody: "={{ JSON.stringify({\n  profileScraperMode: $json.profileScraperMode,\n  queries:            $json.queries\n}) }}",
    options: { timeout: 300000 }
  }
});

console.log('OK 4 nodes adicionados/atualizados');

// ── 7. Reconstrói conexões do pipeline de busca ───────────────────────────────

// extrair_params → preparar_busca_linkedin
d.connections['extrair_params'] = {
  main: [[{ node: 'preparar_busca_linkedin', type: 'main', index: 0 }]]
};

// preparar_busca_linkedin → apify_linkedin_search
d.connections['preparar_busca_linkedin'] = {
  main: [[{ node: 'apify_linkedin_search', type: 'main', index: 0 }]]
};

// apify_linkedin_search → coletar_urls_linkedin
d.connections['apify_linkedin_search'] = {
  main: [[{ node: 'coletar_urls_linkedin', type: 'main', index: 0 }]]
};

// coletar_urls_linkedin → verificar_resultado
d.connections['coletar_urls_linkedin'] = {
  main: [[{ node: 'verificar_resultado', type: 'main', index: 0 }]]
};

// verificar_resultado[0] → marcar_busca_erro (mantém)
// verificar_resultado[1] → apify_linkedin_email (novo)
d.connections['verificar_resultado'] = {
  main: [
    [{ node: 'marcar_busca_erro',   type: 'main', index: 0 }],
    [{ node: 'apify_linkedin_email', type: 'main', index: 0 }]
  ]
};

// apify_linkedin_email → montar_lead_linkedin
d.connections['apify_linkedin_email'] = {
  main: [[{ node: 'montar_lead_linkedin', type: 'main', index: 0 }]]
};

// montar_lead_linkedin → HTTP Request6
d.connections['montar_lead_linkedin'] = {
  main: [[{ node: 'HTTP Request6', type: 'main', index: 0 }]]
};

// Remove conexoes de nodes descontinuados
['buscar_compradores_linkedin', 'enriquecer_comprador_linkedin',
 'buscar_fones_existentes', 'preparar_busca', 'garantir_campos'].forEach(function(name) {
  if (d.connections[name]) {
    delete d.connections[name];
    console.log('OK conexao removida:', name);
  }
});

console.log('OK Conexoes reconstruidas');

// ── 8. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 9. Verificacao ────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var nodeNames = d.nodes.map(function(n){ return n.name; });

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v49',                         json.includes('Victor Pizza v49')],
  ['preparar_busca_linkedin existe',   nodeNames.includes('preparar_busca_linkedin')],
  ['apify_linkedin_search existe',     nodeNames.includes('apify_linkedin_search')],
  ['coletar_urls_linkedin existe',     nodeNames.includes('coletar_urls_linkedin')],
  ['apify_linkedin_email existe',      nodeNames.includes('apify_linkedin_email')],
  ['montar_lead_linkedin existe',      nodeNames.includes('montar_lead_linkedin')],
  ['extrair_params → preparar',        d.connections['extrair_params'].main[0][0].node === 'preparar_busca_linkedin'],
  ['preparar → apify_search',          d.connections['preparar_busca_linkedin'].main[0][0].node === 'apify_linkedin_search'],
  ['apify_search → coletar',           d.connections['apify_linkedin_search'].main[0][0].node === 'coletar_urls_linkedin'],
  ['coletar → verificar',              d.connections['coletar_urls_linkedin'].main[0][0].node === 'verificar_resultado'],
  ['verificar[0] → erro',              d.connections['verificar_resultado'].main[0][0].node === 'marcar_busca_erro'],
  ['verificar[1] → apify_email',       d.connections['verificar_resultado'].main[1][0].node === 'apify_linkedin_email'],
  ['apify_email → montar_lead',        d.connections['apify_linkedin_email'].main[0][0].node === 'montar_lead_linkedin'],
  ['montar_lead → HR6',                d.connections['montar_lead_linkedin'].main[0][0].node === 'HTTP Request6'],
  ['Actor1 harvestapi search',         json.includes('harvestapi/linkedin-profile-search')],
  ['Actor2 harvestapi scraper',        json.includes('harvestapi/linkedin-profile-scraper')],
  ['Credencial Apify reutilizada',     json.includes('I3BWKYwZ5RnVJbUf')],
  ['sem backtick jsCode1',             !jsCode1.includes('`')],
  ['sem backtick jsCode2',             !jsCode2.includes('`')],
  ['sem backtick jsCode3',             !jsCode3.includes('`')],
  ['x-api-key mantido',               json.includes('x-api-key')],
  ['schedule_diario mantido',          json.includes('"schedule_diario"')],
  ['Gmail node mantido',               json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== INSTRUCOES ===');
console.log('1. Importar Fluxo_victor_pizza_v49.json no n8n');
console.log('2. Os nodes Apify ja usam a credencial "Apify account 2" existente');
console.log('3. Nao precisa inserir token manualmente — esta no credential do n8n');
