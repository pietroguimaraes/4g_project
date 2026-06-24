const fs = require('fs');

// v51: corrige location "SP, Brazil" → "São Paulo, Brazil"
// LinkedIn não reconhece abreviação de estado — precisa de nome completo da cidade/estado
// Também simplifica o customBody do Apify node (remove currentJobTitles do body, deixa só searchQuery + locations + maxItems)

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v50.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v51.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v51 - fix location LinkedIn';
console.log('OK Nome atualizado');

// ── 1. Corrige preparar_busca_linkedin: location "SP" → "São Paulo" ────────────
var prepNode = d.nodes.find(function(n) { return n.name === 'preparar_busca_linkedin'; });
if (!prepNode) { console.error('ERRO: preparar_busca_linkedin nao encontrado'); process.exit(1); }

var OLD_LOC = "var localizacao = cidade ? (cidade + ', ' + estado + ', Brazil') : (estado + ', Brazil');";
var NEW_LOC = [
  "var ESTADO_CIDADE = {",
  "  'SP': 'São Paulo', 'RJ': 'Rio de Janeiro', 'MG': 'Belo Horizonte',",
  "  'RS': 'Porto Alegre', 'PR': 'Curitiba', 'SC': 'Florianópolis',",
  "  'BA': 'Salvador', 'CE': 'Fortaleza', 'PE': 'Recife', 'GO': 'Goiânia'",
  "};",
  "var cidadeBase = cidade || ESTADO_CIDADE[estado] || estado;",
  "var localizacao = cidadeBase + ', Brazil';"
].join('\n');

if (!prepNode.parameters.jsCode.includes(OLD_LOC)) {
  console.error('ERRO: trecho de localizacao nao encontrado no jsCode');
  process.exit(1);
}
prepNode.parameters.jsCode = prepNode.parameters.jsCode.replace(OLD_LOC, NEW_LOC);
console.log('OK location: "SP, Brazil" → "São Paulo, Brazil"');

// ── 2. Corrige customBody do apify_linkedin_search ────────────────────────────
// Remove currentJobTitles do body do Actor (faz a busca mais ampla)
// LinkedIn Profile Search Scraper usa: searchQuery + locations + maxItems como campos principais
var searchNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_search'; });
if (!searchNode) { console.error('ERRO: apify_linkedin_search nao encontrado'); process.exit(1); }

searchNode.parameters.customBody = [
  '={{ JSON.stringify({',
  '  searchQuery: $json.searchQuery,',
  '  locations:   $json.locations,',
  '  maxItems:    $json.maxItems',
  '}) }}'
].join('\n');
console.log('OK customBody apify_linkedin_search simplificado (sem currentJobTitles)');

// ── 3. Valida sintaxe do jsCode corrigido ─────────────────────────────────────
try {
  new Function('return async function() { ' + prepNode.parameters.jsCode + ' }');
  console.log('OK Sintaxe jsCode valida');
} catch(e) {
  console.error('ERRO SINTAXE:', e.message);
  process.exit(1);
}

// ── 4. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 5. Verificação ────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v51',                    json.includes('Victor Pizza v51')],
  ['São Paulo no jsCode',         prepNode.parameters.jsCode.includes('São Paulo')],
  ['sem "SP, Brazil" no jsCode', !prepNode.parameters.jsCode.includes("estado + ', Brazil'")],
  ['customBody simplificado',     searchNode.parameters.customBody.includes('searchQuery')],
  ['sem currentJobTitles no body',!searchNode.parameters.customBody.includes('currentJobTitles')],
  ['Actor1 harvestapi search',    json.includes('harvestapi/linkedin-profile-search')],
  ['Actor2 harvestapi scraper',   json.includes('harvestapi/linkedin-profile-scraper')],
  ['Gmail node mantido',          json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',     json.includes('"schedule_diario"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
