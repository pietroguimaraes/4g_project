const fs = require('fs');

// v47: integra LinkedIn (Apify harvestapi) para encontrar email do comprador
// Actor 1: harvestapi~linkedin-profile-search  → acha o comprador na empresa
// Actor 2: harvestapi~linkedin-profile-scraper → pega o email do perfil encontrado
// Email LinkedIn tem prioridade sobre email CNPJa (email do sócio)
// Se LinkedIn não achar ninguém → cai de volta para email CNPJa (sem quebrar o fluxo)

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v46.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v47.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v47 - LinkedIn comprador via Apify';
console.log('OK Nome atualizado');

// ── 1. Cria o node enriquecer_comprador_linkedin ──────────────────────────────
var L = [];
L.push("var helpers = this.helpers;");
L.push("var APIFY_TOKEN = 'APIFY_TOKEN_AQUI'; // substitua pelo seu token Apify");
L.push("");
L.push("// Dados da empresa que vem do garantir_campos");
L.push("var g       = $input.first().json;");
L.push("var empresa = String(g.Empresa || g.empresa || '');");
L.push("var cidade  = String(g.Cidade  || g.cidade  || '');");
L.push("");
L.push("var linkedin_email = null;");
L.push("var comprador_nome = null;");
L.push("var comprador_cargo = null;");
L.push("var linkedin_url   = null;");
L.push("");
L.push("try {");
L.push("  // ── Actor 1: busca comprador na empresa no LinkedIn ────────────────");
L.push("  var resp1 = await helpers.httpRequest({");
L.push("    method: 'POST',");
L.push("    url: 'https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/run-sync-get-dataset-items?token=' + APIFY_TOKEN + '&timeout=90',");
L.push("    headers: { 'Content-Type': 'application/json' },");
L.push("    body: JSON.stringify({");
L.push("      searchQuery:       'Comprador OR \"Gerente de Compras\" OR \"Diretor de Compras\"',");
L.push("      currentCompanies:  [empresa],");
L.push("      currentJobTitles:  ['Comprador', 'Gerente de Compras', 'Diretor de Compras', 'Head de Compras'],");
L.push("      locations:         [cidade + ', Brazil'],");
L.push("      maxItems:          3");
L.push("    })");
L.push("  });");
L.push("");
L.push("  var perfis = Array.isArray(resp1) ? resp1 : [];");
L.push("  console.log('LinkedIn Actor1 perfis encontrados:', perfis.length, '| empresa:', empresa);");
L.push("");
L.push("  if (perfis.length > 0 && perfis[0].profileUrl) {");
L.push("    linkedin_url    = perfis[0].profileUrl;");
L.push("    comprador_nome  = (perfis[0].firstName || '') + ' ' + (perfis[0].lastName || '');");
L.push("    comprador_cargo = perfis[0].headline || perfis[0].currentTitle || '';");
L.push("");
L.push("    // ── Actor 2: busca email do perfil encontrado ───────────────────");
L.push("    var resp2 = await helpers.httpRequest({");
L.push("      method: 'POST',");
L.push("      url: 'https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=' + APIFY_TOKEN + '&timeout=90',");
L.push("      headers: { 'Content-Type': 'application/json' },");
L.push("      body: JSON.stringify({");
L.push("        profileScraperMode: 'Profile details + email search ($10 per 1k)',");
L.push("        queries: [linkedin_url]");
L.push("      })");
L.push("    });");
L.push("");
L.push("    var perfisEmail = Array.isArray(resp2) ? resp2 : [];");
L.push("    console.log('LinkedIn Actor2 com email:', perfisEmail.length);");
L.push("");
L.push("    if (perfisEmail.length > 0 && perfisEmail[0].email) {");
L.push("      linkedin_email = perfisEmail[0].email;");
L.push("      console.log('Email comprador encontrado via LinkedIn');");
L.push("    }");
L.push("  }");
L.push("} catch(e) {");
L.push("  console.log('LinkedIn enriquecimento falhou (fallback CNPJa):', e.message);");
L.push("}");
L.push("");
L.push("// Monta output: mantém todos os campos existentes + enriquece com LinkedIn");
L.push("var out = {};");
L.push("for (var k in g) out[k] = g[k];");
L.push("");
L.push("// LinkedIn email tem prioridade — é o email do COMPRADOR, não do sócio");
L.push("if (linkedin_email)   out._email          = linkedin_email;");
L.push("if (comprador_nome)   out._comprador_nome  = comprador_nome.trim();");
L.push("if (comprador_cargo)  out._comprador_cargo = comprador_cargo;");
L.push("if (linkedin_url)     out._linkedin_url    = linkedin_url;");
L.push("");
L.push("out._fonte_email = linkedin_email ? 'linkedin_comprador' : 'receita_federal';");
L.push("");
L.push("return [{ json: out }];");

var jsCode = L.join('\n');

// Valida sintaxe
try {
  new Function('return async function() { ' + jsCode + ' }');
  console.log('OK Sintaxe JavaScript valida');
} catch(e) {
  console.error('ERRO DE SINTAXE:', e.message);
  process.exit(1);
}

// Cria o node
var nodeLinkedin = {
  id: 'enriquecer-comprador-linkedin-v47',
  name: 'enriquecer_comprador_linkedin',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [12486, 10480], // entre garantir_campos[12252] e HTTP Request6[12720]
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: jsCode
  }
};

d.nodes.push(nodeLinkedin);
console.log('OK Node enriquecer_comprador_linkedin adicionado');

// ── 2. Atualiza conexoes ──────────────────────────────────────────────────────
// Antes: garantir_campos[0] → HTTP Request6
// Depois: garantir_campos[0] → enriquecer_comprador_linkedin → HTTP Request6

// Remove ligacao garantir_campos → HTTP Request6
if (d.connections['garantir_campos'] && d.connections['garantir_campos'].main) {
  d.connections['garantir_campos'].main[0] = d.connections['garantir_campos'].main[0].filter(function(c) {
    return c.node !== 'HTTP Request6';
  });
}
console.log('OK Conexao garantir_campos → HTTP Request6 removida');

// garantir_campos → enriquecer_comprador_linkedin
if (!d.connections['garantir_campos']) d.connections['garantir_campos'] = { main: [[]] };
d.connections['garantir_campos'].main[0].push({ node: 'enriquecer_comprador_linkedin', type: 'main', index: 0 });
console.log('OK garantir_campos → enriquecer_comprador_linkedin');

// enriquecer_comprador_linkedin → HTTP Request6
d.connections['enriquecer_comprador_linkedin'] = {
  main: [[{ node: 'HTTP Request6', type: 'main', index: 0 }]]
};
console.log('OK enriquecer_comprador_linkedin → HTTP Request6');

// ── 3. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 4. Verificacao ────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var conn_gc = d.connections['garantir_campos'].main[0];
var conn_el = d.connections['enriquecer_comprador_linkedin'].main[0];

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v47',                              json.includes('Victor Pizza v47')],
  ['Node LinkedIn adicionado',              !!d.nodes.find(function(n){ return n.name === 'enriquecer_comprador_linkedin'; })],
  ['garantir_campos → LinkedIn',            conn_gc.some(function(c){ return c.node === 'enriquecer_comprador_linkedin'; })],
  ['LinkedIn → HTTP Request6',              conn_el.some(function(c){ return c.node === 'HTTP Request6'; })],
  ['garantir_campos não → HR6 diretamente', !conn_gc.some(function(c){ return c.node === 'HTTP Request6'; })],
  ['Actor1 harvestapi search',              jsCode.includes('harvestapi~linkedin-profile-search')],
  ['Actor2 harvestapi scraper',             jsCode.includes('harvestapi~linkedin-profile-scraper')],
  ['fallback fonte_email',                  jsCode.includes('_fonte_email')],
  ['sem backtick',                          !jsCode.includes('`')],
  ['x-api-key atualizar_prospectado',       json.includes('x-api-key')],
  ['chave CNPJa nova',                      json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
  ['schedule_diario',                       json.includes('"schedule_diario"')],
  ['Gmail node',                            json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== INSTRUCOES DE USO ===');
console.log('1. Abrir node enriquecer_comprador_linkedin no n8n');
console.log('2. Substituir APIFY_TOKEN_AQUI pelo seu token Apify');
console.log('3. Token Apify: https://console.apify.com → Settings → Integrations → API tokens');
