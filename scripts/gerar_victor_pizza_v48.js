const fs = require('fs');

// v48: remove CNPJa completamente — LinkedIn e o unico pipeline de busca
// Actor 1 (harvestapi~linkedin-profile-search): busca compradores por cargo + cidade
// Actor 2 (harvestapi~linkedin-profile-scraper): pega email de cada perfil
// "telefone" no banco vira o LinkedIn publicIdentifier (li:joao-silva-123) — chave unica
// Todos os leads chegam direto como PROSPECTADOS com email do comprador

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v47.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v48.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v48 - LinkedIn puro (sem CNPJa)';
console.log('OK Nome atualizado');

// ── 1. buscar_compradores_linkedin (substitui todo o bloco CNPJa) ─────────────
var L1 = [];
L1.push("var helpers = this.helpers;");
L1.push("var APIFY_TOKEN = 'APIFY_TOKEN_AQUI';");
L1.push("");
L1.push("var ep                = $input.first().json;");
L1.push("var tipo_loja         = String(ep.tipo_loja         || 'SUPERMERCADO');");
L1.push("var estado            = String(ep.estado            || 'SP');");
L1.push("var cidade            = String(ep.cidade            || '');");
L1.push("var quantidade_pedida = parseInt(ep.quantidade_pedida || 10);");
L1.push("var search_id         = String(ep.search_id         || '');");
L1.push("var user_id           = String(ep.user_id           || '');");
L1.push("");
L1.push("var CARGO_MAP = {");
L1.push("  'SUPERMERCADO':  ['Comprador', 'Gerente de Compras', 'Diretor de Compras', 'Head de Compras'],");
L1.push("  'ATACADISTA':    ['Comprador', 'Gerente de Compras', 'Diretor Comercial'],");
L1.push("  'DISTRIBUIDORA': ['Comprador', 'Diretor de Compras', 'Gerente Comercial']");
L1.push("};");
L1.push("var cargos    = CARGO_MAP[tipo_loja] || CARGO_MAP['SUPERMERCADO'];");
L1.push("var localizacao = cidade ? (cidade + ', ' + estado + ', Brazil') : (estado + ', Brazil');");
L1.push("");
L1.push("try {");
L1.push("  // ── Actor 1: encontra compradores no LinkedIn ────────────────────");
L1.push("  var resp1 = await helpers.httpRequest({");
L1.push("    method: 'POST',");
L1.push("    url: 'https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/run-sync-get-dataset-items?token=' + APIFY_TOKEN + '&timeout=120',");
L1.push("    headers: { 'Content-Type': 'application/json' },");
L1.push("    body: JSON.stringify({");
L1.push("      searchQuery:      cargos[0] + ' OR \"' + cargos[1] + '\"',");
L1.push("      currentJobTitles: cargos,");
L1.push("      locations:        [localizacao],");
L1.push("      maxItems:         quantidade_pedida * 3");
L1.push("    })");
L1.push("  });");
L1.push("");
L1.push("  var perfis = Array.isArray(resp1) ? resp1.filter(function(p) { return p.profileUrl; }) : [];");
L1.push("  console.log('Actor1 LinkedIn:', perfis.length, 'perfis | cargo:', cargos[0], '| local:', localizacao);");
L1.push("");
L1.push("  if (perfis.length === 0) {");
L1.push("    return [{ json: { _sem_resultado: true, _meta_bruta: 0, tipo_loja: tipo_loja } }];");
L1.push("  }");
L1.push("");
L1.push("  // ── Actor 2: busca email de todos os perfis (1 unico call) ───────");
L1.push("  var urls = perfis.slice(0, quantidade_pedida * 2).map(function(p) { return p.profileUrl; });");
L1.push("");
L1.push("  var resp2 = await helpers.httpRequest({");
L1.push("    method: 'POST',");
L1.push("    url: 'https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=' + APIFY_TOKEN + '&timeout=120',");
L1.push("    headers: { 'Content-Type': 'application/json' },");
L1.push("    body: JSON.stringify({");
L1.push("      profileScraperMode: 'Profile details + email search ($10 per 1k)',");
L1.push("      queries: urls");
L1.push("    })");
L1.push("  });");
L1.push("");
L1.push("  var perfisEmail = Array.isArray(resp2) ? resp2 : [];");
L1.push("  var comEmail    = perfisEmail.filter(function(p) { return p.email; });");
L1.push("  console.log('Actor2 LinkedIn:', comEmail.length, 'com email de', perfisEmail.length, 'perfis');");
L1.push("");
L1.push("  if (comEmail.length === 0) {");
L1.push("    return [{ json: { _sem_resultado: true, _meta_bruta: perfis.length, tipo_loja: tipo_loja } }];");
L1.push("  }");
L1.push("");
L1.push("  return comEmail.slice(0, quantidade_pedida).map(function(p) {");
L1.push("    return { json: {");
L1.push("      _comprador_nome:   ((p.firstName || '') + ' ' + (p.lastName || '')).trim(),");
L1.push("      _comprador_cargo:  p.headline || p.jobTitle || '',");
L1.push("      _comprador_email:  p.email,");
L1.push("      _linkedin_url:     p.profileUrl || '',");
L1.push("      _linkedin_id:      p.publicIdentifier || p.id || '',");
L1.push("      _empresa_linkedin: p.companyName || p.currentCompany || '',");
L1.push("      _meta_bruta:       perfis.length,");
L1.push("      _meta_email:       comEmail.length,");
L1.push("      tipo_loja:         tipo_loja,");
L1.push("      estado:            estado,");
L1.push("      cidade:            cidade,");
L1.push("      search_id:         search_id,");
L1.push("      user_id:           user_id,");
L1.push("      quantidade_pedida: quantidade_pedida");
L1.push("    }};");
L1.push("  });");
L1.push("");
L1.push("} catch(e) {");
L1.push("  console.log('ERRO LinkedIn:', e.message);");
L1.push("  return [{ json: { _sem_resultado: true, _meta_bruta: 0, _erro: e.message, tipo_loja: tipo_loja } }];");
L1.push("}");

var jsCode1 = L1.join('\n');

// ── 2. montar_lead_linkedin (prepara dados para HTTP Request6) ────────────────
var L2 = [];
L2.push("var p = $input.first().json;");
L2.push("");
L2.push("// LinkedIn publicIdentifier como chave unica no banco");
L2.push("// Formato: li:joao-silva-123abc — unico por pessoa");
L2.push("var id_slug = p._linkedin_id");
L2.push("  ? String(p._linkedin_id)");
L2.push("  : String(p._linkedin_url || '').replace('https://www.linkedin.com/in/', '').replace(/\\/$/,'');");
L2.push("var id_unico = 'li:' + id_slug;");
L2.push("");
L2.push("return [{ json: {");
L2.push("  Empresa:           p._empresa_linkedin || 'LinkedIn Lead',");
L2.push("  empresa:           p._empresa_linkedin || 'LinkedIn Lead',");
L2.push("  Telefone:          id_unico,");
L2.push("  telefone:          id_unico,");
L2.push("  email:             p._comprador_email,");
L2.push("  _email:            p._comprador_email,");
L2.push("  Cidade:            p.cidade || '',");
L2.push("  cidade:            p.cidade || '',");
L2.push("  Estado:            p.estado || 'SP',");
L2.push("  estado:            p.estado || 'SP',");
L2.push("  _comprador_nome:   p._comprador_nome,");
L2.push("  _comprador_cargo:  p._comprador_cargo,");
L2.push("  _linkedin_url:     p._linkedin_url,");
L2.push("  _fonte_email:      'linkedin_comprador',");
L2.push("  _status_final:     'PROSPECTADOS',");
L2.push("  search_id:         p.search_id,");
L2.push("  user_id:           p.user_id,");
L2.push("  tipo_loja:         p.tipo_loja,");
L2.push("  quantidade_pedida: p.quantidade_pedida");
L2.push("} }];");

var jsCode2 = L2.join('\n');

// Valida sintaxe
['jsCode1', 'jsCode2'].forEach(function(name) {
  var code = name === 'jsCode1' ? jsCode1 : jsCode2;
  try {
    new Function('return async function() { ' + code + ' }');
    console.log('OK Sintaxe valida:', name);
  } catch(e) {
    console.error('ERRO SINTAXE', name, ':', e.message);
    process.exit(1);
  }
});

// ── 3. Adiciona os dois novos nodes ──────────────────────────────────────────
var nodeBuscar = {
  id: 'buscar-compradores-linkedin-v48',
  name: 'buscar_compradores_linkedin',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [12100, 10480],
  parameters: { mode: 'runOnceForEachItem', jsCode: jsCode1 }
};

var nodeMontar = {
  id: 'montar-lead-linkedin-v48',
  name: 'montar_lead_linkedin',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [12580, 10640],
  parameters: { mode: 'runOnceForEachItem', jsCode: jsCode2 }
};

d.nodes.push(nodeBuscar);
d.nodes.push(nodeMontar);
console.log('OK 2 novos nodes adicionados');

// ── 4. Atualiza conexoes ──────────────────────────────────────────────────────

// 4a. extrair_params: remove conexao para buscar_fones_existentes, aponta para buscar_compradores_linkedin
if (d.connections['extrair_params'] && d.connections['extrair_params'].main) {
  d.connections['extrair_params'].main[0] = [
    { node: 'buscar_compradores_linkedin', type: 'main', index: 0 }
  ];
  console.log('OK extrair_params → buscar_compradores_linkedin');
}

// 4b. buscar_compradores_linkedin → verificar_resultado
d.connections['buscar_compradores_linkedin'] = {
  main: [[{ node: 'verificar_resultado', type: 'main', index: 0 }]]
};
console.log('OK buscar_compradores_linkedin → verificar_resultado');

// 4c. verificar_resultado[1] era code_in_java, agora aponta para montar_lead_linkedin
if (d.connections['verificar_resultado'] && d.connections['verificar_resultado'].main) {
  d.connections['verificar_resultado'].main[1] = [
    { node: 'montar_lead_linkedin', type: 'main', index: 0 }
  ];
  console.log('OK verificar_resultado[1] → montar_lead_linkedin');
}

// 4d. montar_lead_linkedin → HTTP Request6
d.connections['montar_lead_linkedin'] = {
  main: [[{ node: 'HTTP Request6', type: 'main', index: 0 }]]
};
console.log('OK montar_lead_linkedin → HTTP Request6');

// ── 5. Atualiza atualizar_prospectado: garantir_campos → montar_lead_linkedin ─
var ap = d.nodes.find(function(n) { return n.name === 'atualizar_prospectado'; });
if (ap && ap.parameters.url) {
  ap.parameters.url = ap.parameters.url
    .split("$('garantir_campos')").join("$('montar_lead_linkedin')");
  console.log('OK atualizar_prospectado URL atualizada:', ap.parameters.url);
}

// ── 6. Atualiza montar_email: garantir_campos → montar_lead_linkedin ──────────
var me = d.nodes.find(function(n) { return n.name === 'montar_email'; });
if (me && me.parameters.jsCode) {
  me.parameters.jsCode = me.parameters.jsCode
    .split("$('garantir_campos')").join("$('montar_lead_linkedin')");
  console.log('OK montar_email atualizado para ler de montar_lead_linkedin');
}

// ── 7. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 8. Verificacao ────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var connEP  = d.connections['extrair_params'].main[0];
var connBCL = d.connections['buscar_compradores_linkedin'].main[0];
var connVR1 = d.connections['verificar_resultado'].main[1];
var connML  = d.connections['montar_lead_linkedin'].main[0];

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v48',                              json.includes('Victor Pizza v48')],
  ['Node buscar_compradores_linkedin',       !!d.nodes.find(function(n){ return n.name==='buscar_compradores_linkedin'; })],
  ['Node montar_lead_linkedin',             !!d.nodes.find(function(n){ return n.name==='montar_lead_linkedin'; })],
  ['extrair_params → buscar_compradores',   connEP.some(function(c){ return c.node==='buscar_compradores_linkedin'; })],
  ['extrair_params NAO → buscar_fones',     !connEP.some(function(c){ return c.node==='buscar_fones_existentes'; })],
  ['buscar_compradores → verificar_result', connBCL.some(function(c){ return c.node==='verificar_resultado'; })],
  ['verificar_result[1] → montar_lead',     connVR1.some(function(c){ return c.node==='montar_lead_linkedin'; })],
  ['montar_lead → HTTP Request6',           connML.some(function(c){ return c.node==='HTTP Request6'; })],
  ['sem backtick jsCode1',                  !jsCode1.includes('`')],
  ['sem backtick jsCode2',                  !jsCode2.includes('`')],
  ['Actor1 harvestapi search',              jsCode1.includes('harvestapi~linkedin-profile-search')],
  ['Actor2 harvestapi scraper',             jsCode1.includes('harvestapi~linkedin-profile-scraper')],
  ['id unico li:',                          jsCode2.includes("'li:' + id_slug")],
  ['atualizar_prospectado usa montar_lead', ap.parameters.url.includes('montar_lead_linkedin')],
  ['montar_email usa montar_lead',          me.parameters.jsCode.includes('montar_lead_linkedin')],
  ['x-api-key mantido',                     json.includes('x-api-key')],
  ['schedule_diario mantido',               json.includes('"schedule_diario"')],
  ['Gmail node mantido',                    json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== INSTRUCOES ===');
console.log('1. Importar Fluxo_victor_pizza_v48.json no n8n');
console.log('2. Abrir node buscar_compradores_linkedin');
console.log('3. Substituir APIFY_TOKEN_AQUI pelo token da Apify');
console.log('   → console.apify.com → Settings → Integrations → API tokens');
console.log('4. ATENCAO: telefone no banco passa a ser "li:slug-linkedin"');
console.log('   → migration necessaria se nao aceitar esse formato');
