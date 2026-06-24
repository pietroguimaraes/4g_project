const fs = require('fs');

// v59: corrige busca LinkedIn com zero resultados (problema do v57)
//
// PROBLEMA v57: searchQuery com filtro de setor ficou longa e ambigua
//   "Comprador OR \"Gerente de Compras\" supermercado OR atacado OR varejo..."
//   → LinkedIn retornou 0 resultados
//
// SOLUCAO: 2 mudancas
//   1. preparar_busca_linkedin: reverte searchQuery para so cargos (como v56)
//      - Busca volta a encontrar pessoas (qualquer setor)
//   2. normalizar_apollo: filtra setor usando dados reais do Apollo.io
//      - Apollo retorna organization.industry da empresa atual da pessoa
//      - Se nao for setor alimenticio/varejo/atacado: descarta
//      - Solucao melhor que filtrar na busca (usa dado verificado, nao keyword)

var INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v58.json';
var OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v59.json';

if (!fs.existsSync(INPUT)) {
  console.error('ERRO: Arquivo de entrada nao encontrado: ' + INPUT);
  console.error('Certifique-se de que o v58 foi gerado e esta em Downloads.');
  process.exit(1);
}

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v59 - fix busca LinkedIn + filtro setor via Apollo';
console.log('OK Fluxo carregado: ' + INPUT);

// ── 1. Reverte searchQuery em preparar_busca_linkedin ─────────────────────────
// Remove o SETOR_MAP e o setor da searchQuery (voltando ao formato v56)
// O filtro de setor sera feito depois via Apollo.io

var prepNode = d.nodes.find(function(n) { return n.name === 'preparar_busca_linkedin'; });
if (!prepNode) {
  console.error('ERRO: node "preparar_busca_linkedin" nao encontrado');
  process.exit(1);
}

// Verifica se o v57 esta aplicado (tem SETOR_MAP)
if (!prepNode.parameters.jsCode.includes('SETOR_MAP')) {
  console.log('AVISO: SETOR_MAP nao encontrado no jsCode — searchQuery pode ja estar correta');
} else {
  // Remove o bloco SETOR_MAP inteiro (injetado pelo v57)
  var OLD_SETOR_BLOCO = [
    "var SETOR_MAP = {",
    "  'SUPERMERCADO':  'supermercado OR atacado OR varejo OR hipermercado OR \"distribuidor alimentos\"',",
    "  'ATACADISTA':    'atacadista OR atacado OR distribuidor',",
    "  'DISTRIBUIDORA': 'distribuidora OR distribuidor OR atacado'",
    "};",
    "var setor = SETOR_MAP[tipo_loja] || SETOR_MAP['SUPERMERCADO'];"
  ].join('\n');

  if (!prepNode.parameters.jsCode.includes(OLD_SETOR_BLOCO)) {
    console.error('ERRO: bloco SETOR_MAP nao encontrado no jsCode com formato esperado');
    console.error('Verifique se o v58 foi gerado corretamente a partir do v57');
    process.exit(1);
  }

  prepNode.parameters.jsCode = prepNode.parameters.jsCode.replace(OLD_SETOR_BLOCO, '');
  console.log('OK SETOR_MAP removido do preparar_busca_linkedin');
}

// Reverte searchQuery para so os cargos (sem " + setor" no final)
var OLD_QUERY = "searchQuery:       cargos[0] + ' OR \"' + cargos[1] + '\" ' + setor,";
var NEW_QUERY = "searchQuery:       cargos[0] + ' OR \"' + cargos[1] + '\"',";

if (prepNode.parameters.jsCode.includes(OLD_QUERY)) {
  prepNode.parameters.jsCode = prepNode.parameters.jsCode.replace(OLD_QUERY, NEW_QUERY);
  console.log('OK searchQuery: removido filtro de setor (so cargos agora)');
} else if (prepNode.parameters.jsCode.includes(NEW_QUERY)) {
  console.log('OK searchQuery: ja estava sem filtro de setor');
} else {
  console.error('ERRO: searchQuery nao encontrada no jsCode');
  process.exit(1);
}

// Valida sintaxe
try {
  new Function('return async function() { ' + prepNode.parameters.jsCode + ' }');
  console.log('OK Sintaxe preparar_busca_linkedin valida');
} catch(e) {
  console.error('ERRO SINTAXE preparar_busca_linkedin:', e.message);
  process.exit(1);
}

// ── 2. Atualiza normalizar_apollo: adiciona filtro de setor via Apollo.io ──────
// Apollo.io retorna organization.industry da empresa atual da pessoa
// Setores validos para Victor (supermercados/atacado/varejo/alimenticio)
// Se industry nao bater: _setor_ok = false (downstream pode filtrar)

var normNode = d.nodes.find(function(n) { return n.name === 'normalizar_apollo'; });
if (!normNode) {
  console.error('ERRO: node "normalizar_apollo" nao encontrado — rode v58 primeiro');
  process.exit(1);
}

var normCodeNovo = [
  '// Normaliza resposta Apollo.io + filtra setor pela industry da empresa',
  '// Apollo retorna: { person: { email, first_name, last_name, organization: { industry } } }',
  '',
  'var resposta  = $input.first().json;',
  'var linkedin  = $("coletar_urls_linkedin").item.json;',
  '',
  'var pessoa = resposta.person || null;',
  'var email  = pessoa && pessoa.email ? pessoa.email : null;',
  '',
  '// Verifica industry da empresa atual (via Apollo)',
  'var org      = pessoa && pessoa.organization ? pessoa.organization : null;',
  'var industry = org && org.industry ? org.industry.toLowerCase() : "";',
  '',
  '// Palavras-chave de setor valido para Victor (supermercado/varejo/atacado/alimentos)',
  'var SETOR_VALIDO = [',
  '  "food", "beverage", "grocery", "supermarket", "retail",',
  '  "wholesale", "atacado", "aliment", "varejo", "distribu", "consumer goods"',
  '];',
  '',
  'var setorOk = SETOR_VALIDO.some(function(s) { return industry.includes(s); });',
  '',
  '// Se industry vier vazia (nao encontrou na base Apollo), deixa passar',
  '// Melhor receber um lead incerto do que perder um valido',
  'if (!industry) { setorOk = true; }',
  '',
  'if (email) {',
  '  console.log("Apollo email:", email, "| industry:", industry || "(sem dado)", "| setor ok:", setorOk);',
  '} else {',
  '  console.log("Apollo sem email para:", linkedin.linkedinUrl || "?", "| industry:", industry || "(sem dado)");',
  '}',
  '',
  'return [{ json: {',
  '  // Campos compatíveis com o formato downstream',
  '  url:        linkedin.linkedinUrl || (pessoa && pessoa.linkedin_url) || "",',
  '  email:      email,',
  '  firstName:  pessoa ? (pessoa.first_name || linkedin.firstName || "") : (linkedin.firstName || ""),',
  '  lastName:   pessoa ? (pessoa.last_name  || linkedin.lastName  || "") : (linkedin.lastName  || ""),',
  '  // Metadados Apollo',
  '  _apollo_ok:    !!email,',
  '  _setor_ok:     setorOk,',
  '  _industry:     industry || "",',
  '  _meta_bruta:   linkedin._meta_bruta || 0',
  '}}];'
].join('\n');

normNode.parameters.jsCode = normCodeNovo;

// Valida sintaxe
try {
  new Function('return async function() { ' + normCodeNovo + ' }');
  console.log('OK Sintaxe normalizar_apollo valida (com filtro de setor via Apollo)');
} catch(e) {
  console.error('ERRO SINTAXE normalizar_apollo:', e.message);
  process.exit(1);
}

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao final ─────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var emailNodeFinal = d.nodes.find(function(n) { return n.name === 'apify_linkedin_email'; });

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v59',                            json.includes('Victor Pizza v59')],
  ['sem SETOR_MAP no preparar_busca',    !prepNode.parameters.jsCode.includes('SETOR_MAP')],
  ['searchQuery so com cargos',           prepNode.parameters.jsCode.includes("cargos[0] + ' OR \"' + cargos[1] + '\"',")],
  ['Apollo.io HTTP Request mantido',      emailNodeFinal && emailNodeFinal.type === 'n8n-nodes-base.httpRequest'],
  ['normalizar_apollo com _setor_ok',     normCodeNovo.includes('_setor_ok')],
  ['normalizar_apollo com industry',      normCodeNovo.includes('SETOR_VALIDO')],
  ['industry vazia deixa passar',         normCodeNovo.includes('setorOk = true')],
  ['normalizar_apollo conectado',         !!d.connections['normalizar_apollo']],
  ['Gmail mantido',                       json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',             json.includes('"schedule_diario"')],
].forEach(function(c) {
  console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]);
});

console.log('\n=== O QUE MUDOU (v58 → v59) ===');
console.log('PROBLEMA v57: searchQuery com setor → 0 resultados no LinkedIn');
console.log('');
console.log('FIX 1: preparar_busca_linkedin');
console.log('  ANTES: searchQuery = "Comprador OR \\"Gerente de Compras\\" supermercado OR atacado..."');
console.log('  AGORA: searchQuery = "Comprador OR \\"Gerente de Compras\\""  (so cargos)');
console.log('  RESULTADO: LinkedIn volta a encontrar pessoas');
console.log('');
console.log('FIX 2: normalizar_apollo (novo campo _setor_ok)');
console.log('  ANTES: nao filtrava setor');
console.log('  AGORA: verifica organization.industry retornado pelo Apollo.io');
console.log('  _setor_ok = true  → empresa e do setor alimenticio/varejo/atacado');
console.log('  _setor_ok = false → empresa de outro setor (banco, hospital, etc.)');
console.log('  industry vazio    → deixa passar (melhor que perder lead valido)');

console.log('\n=== PROXIMOS PASSOS ===');
console.log('1. Importe Fluxo_victor_pizza_v59.json no n8n');
console.log('2. Execute "apify_linkedin_search" — deve retornar perfis agora');
console.log('3. Execute ate "normalizar_apollo" — observe:');
console.log('   _apollo_ok: true  → Apollo encontrou email');
console.log('   _setor_ok:  true  → empresa do setor correto');
console.log('   _industry:  "food and beverages" (ou similar)');
console.log('4. Se _setor_ok aparecer nos dados: posso adicionar filtro downstream');
console.log('   para so salvar leads com _setor_ok = true');
