const fs = require('fs');

// v58: substitui anchor/linkedin-to-email (Apify) por Apollo.io API (HTTP Request)
//
// PROBLEMA: anchor/linkedin-to-email
//   - Free tier: 1 perfil por run (incompativel com batch)
//   - Taxa de sucesso baixa (LinkedIn oculta emails)
//   - Erros: "Person not found", "No email found", "Limit has been reached"
//
// SOLUCAO: Apollo.io people/match API
//   - 10.000 creditos GRATIS por mes (Victor usa ~220/mes)
//   - Base de 275M+ contatos B2B verificados
//   - Retorna email profissional quando disponivel
//   - HTTP Request no n8n: sem dependencia de Apify para este passo
//
// MUDANCAS:
//   1. coletar_urls_linkedin: batch (v55) → itens individuais (HTTP Request processa 1 por vez)
//   2. apify_linkedin_email: Apify actor → HTTP Request Apollo.io
//   3. normalizar_apollo: novo Code node que normaliza resposta Apollo
//   4. Conexoes atualizadas: apify_linkedin_email → normalizar_apollo → downstream
//
// ANTES DE RODAR ESTE SCRIPT:
//   1. Crie conta gratis em https://app.apollo.io/
//   2. Va em Settings → Integrations → API Keys → Create API Key
//   3. Substitua COLE_SUA_CHAVE_APOLLO_AQUI abaixo pela chave real
//   4. Rode: node scripts/gerar_victor_pizza_v58.js

var APOLLO_API_KEY = 'osbIKBwqiIxlaknIF1i7aw';

var INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v57.json';
var OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v58.json';

// ── Carrega o fluxo ───────────────────────────────────────────────────────────
if (!fs.existsSync(INPUT)) {
  console.error('ERRO: Arquivo de entrada nao encontrado: ' + INPUT);
  console.error('Certifique-se de que o v57 foi gerado e esta em Downloads.');
  process.exit(1);
}
var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v58 - Apollo.io email finder';
console.log('OK Fluxo carregado: ' + INPUT);

// ── 1. Reverte coletar_urls_linkedin: batch → itens individuais ───────────────
// HTTP Request no n8n processa cada item separadamente (nao precisa de batch)
// Reverte ao formato v53: 1 item por perfil
var coletarNode = d.nodes.find(function(n) { return n.name === 'coletar_urls_linkedin'; });
if (!coletarNode) {
  console.error('ERRO: node "coletar_urls_linkedin" nao encontrado');
  process.exit(1);
}

coletarNode.parameters.jsCode = [
  '// Retorna 1 item por perfil — HTTP Request processara individualmente',
  '// (Diferente do v55 que retornava 1 item com batch para o Apify actor)',
  'var perfis = $input.all().filter(function(i) { return i.json.linkedinUrl; });',
  '',
  'console.log("Perfis com linkedinUrl:", perfis.length);',
  '',
  'if (perfis.length === 0) {',
  '  return [{ json: { _sem_resultado: true, _meta_bruta: 0 } }];',
  '}',
  '',
  'return perfis.map(function(i) {',
  '  return { json: {',
  '    linkedinUrl:  i.json.linkedinUrl,',
  '    firstName:    i.json.firstName || "",',
  '    lastName:     i.json.lastName  || "",',
  '    _meta_bruta:  perfis.length',
  '  }};',
  '});'
].join('\n');
console.log('OK coletar_urls_linkedin: batch (v55) -> itens individuais (v53)');

// ── 2. Substitui apify_linkedin_email por HTTP Request Apollo.io ──────────────
var emailNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_email'; });
if (!emailNode) {
  console.error('ERRO: node "apify_linkedin_email" nao encontrado');
  process.exit(1);
}

var emailPos = Array.isArray(emailNode.position) ? emailNode.position : [600, 300];

// Substitui tipo e parametros mantendo nome, id e posicao
emailNode.type        = 'n8n-nodes-base.httpRequest';
emailNode.typeVersion = 4.2;
emailNode.continueOnFail = true;
emailNode.parameters = {
  method: 'POST',
  url: 'https://api.apollo.io/api/v1/people/match',
  sendHeaders: true,
  headerParameters: {
    parameters: [
      { name: 'X-Api-Key',     value: APOLLO_API_KEY },
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
console.log('OK apify_linkedin_email: Apify actor -> HTTP Request Apollo.io');
console.log('   URL: https://api.apollo.io/api/v1/people/match');

// ── 3. Adiciona Code node normalizar_apollo ───────────────────────────────────
// Apollo.io retorna: { person: { email, first_name, last_name, linkedin_url, ... }, status }
// Normaliza para formato compativel com downstream (mesmo do anchor/linkedin-to-email)
var normCode = [
  '// Normaliza resposta Apollo.io para formato compativel com downstream',
  '// Apollo retorna: { person: { email, first_name, last_name, linkedin_url } }',
  '// Ou: { person: null } quando nao encontra',
  '// Ou: { error: "..." } quando da erro HTTP (continueOnFail = true)',
  '',
  'var resposta  = $input.first().json;',
  'var linkedin  = $("coletar_urls_linkedin").item.json;',
  '',
  'var pessoa = resposta.person || null;',
  'var email  = pessoa && pessoa.email ? pessoa.email : null;',
  '',
  'if (email) {',
  '  console.log("Apollo encontrou email:", email);',
  '} else {',
  '  console.log("Apollo nao encontrou email para:", linkedin.linkedinUrl || "?");',
  '}',
  '',
  'return [{ json: {',
  '  // Campos compatíveis com o formato antigo do anchor/linkedin-to-email',
  '  url:       linkedin.linkedinUrl || (pessoa && pessoa.linkedin_url) || "",',
  '  email:     email,',
  '  firstName: pessoa ? (pessoa.first_name || linkedin.firstName || "") : (linkedin.firstName || ""),',
  '  lastName:  pessoa ? (pessoa.last_name  || linkedin.lastName  || "") : (linkedin.lastName  || ""),',
  '  // Metadados Apollo',
  '  _apollo_ok:     !!email,',
  '  _apollo_status: resposta.status || (resposta.error ? "error" : "not_found"),',
  '  _meta_bruta:    linkedin._meta_bruta || 0',
  '}}];'
].join('\n');

// Posicao: 240px a direita do emailNode
var normPos = [emailPos[0] + 240, emailPos[1]];

var normNode = {
  id: 'normalizar-apollo-node',
  name: 'normalizar_apollo',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: normPos,
  continueOnFail: true,
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: normCode
  }
};

// Evita duplicar se script rodado mais de uma vez
var jaExiste = d.nodes.find(function(n) { return n.name === 'normalizar_apollo'; });
if (!jaExiste) {
  d.nodes.push(normNode);
  console.log('OK normalizar_apollo: Code node adicionado na posicao [' + normPos + ']');
} else {
  jaExiste.parameters.jsCode = normCode;
  console.log('OK normalizar_apollo: ja existia, jsCode atualizado');
}

// ── 4. Atualiza conexoes ──────────────────────────────────────────────────────
// Antes:  coletar_urls_linkedin → apify_linkedin_email → [downstream]
// Depois: coletar_urls_linkedin → apify_linkedin_email → normalizar_apollo → [downstream]

var conexoesEmail = d.connections['apify_linkedin_email'];
var downstreamTargets = [];

if (conexoesEmail && conexoesEmail.main && conexoesEmail.main[0] && conexoesEmail.main[0].length > 0) {
  // Captura o downstream atual (antes de sobrescrever)
  var downstreamNome = conexoesEmail.main[0][0].node;
  if (downstreamNome !== 'normalizar_apollo') {
    // Ainda nao foi atualizado — captura o downstream real
    downstreamTargets = conexoesEmail.main[0];
    console.log('OK downstream de apify_linkedin_email: ' + downstreamTargets.map(function(t) { return t.node; }).join(', '));
  } else {
    // Ja foi atualizado numa execucao anterior — recupera o downstream do normalizar_apollo
    var conexNorm = d.connections['normalizar_apollo'];
    if (conexNorm && conexNorm.main && conexNorm.main[0]) {
      downstreamTargets = conexNorm.main[0];
      console.log('OK conexoes ja atualizadas — downstream recuperado: ' + downstreamTargets.map(function(t) { return t.node; }).join(', '));
    }
  }
} else {
  console.log('AVISO: apify_linkedin_email nao tinha conexao downstream — adicionar manualmente no n8n');
}

// apify_linkedin_email → normalizar_apollo
d.connections['apify_linkedin_email'] = {
  main: [[{ node: 'normalizar_apollo', type: 'main', index: 0 }]]
};

// normalizar_apollo → downstream original
d.connections['normalizar_apollo'] = {
  main: [downstreamTargets.length > 0 ? downstreamTargets : []]
};

console.log('OK conexoes: apify_linkedin_email → normalizar_apollo → downstream');

// ── Valida sintaxe dos Code nodes ─────────────────────────────────────────────
try {
  new Function('return async function() { ' + coletarNode.parameters.jsCode + ' }');
  console.log('OK Sintaxe coletar_urls_linkedin valida');
} catch(e) {
  console.error('ERRO SINTAXE coletar_urls_linkedin:', e.message);
  process.exit(1);
}

try {
  new Function('return async function() { ' + normCode + ' }');
  console.log('OK Sintaxe normalizar_apollo valida');
} catch(e) {
  console.error('ERRO SINTAXE normalizar_apollo:', e.message);
  process.exit(1);
}

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao final ─────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var normNodeFinal = d.nodes.find(function(n) { return n.name === 'normalizar_apollo'; });
var emailNodeFinal = d.nodes.find(function(n) { return n.name === 'apify_linkedin_email'; });

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v58',                          json.includes('Victor Pizza v58')],
  ['apify_linkedin_email = httpRequest', emailNodeFinal && emailNodeFinal.type === 'n8n-nodes-base.httpRequest'],
  ['URL Apollo correta',                json.includes('api.apollo.io/api/v1/people/match')],
  ['reveal_personal_emails no body',    json.includes('reveal_personal_emails')],
  ['Header X-Api-Key presente',         json.includes('X-Api-Key')],
  ['continueOnFail ativo',             emailNodeFinal && emailNodeFinal.continueOnFail === true],
  ['normalizar_apollo adicionado',      !!normNodeFinal],
  ['conexao email → normalizar',        d.connections['apify_linkedin_email'].main[0][0].node === 'normalizar_apollo'],
  ['coletar: itens individuais',        coletarNode.parameters.jsCode.includes('perfis.map')],
  ['coletar: sem startUrls batch',     !coletarNode.parameters.jsCode.includes('startUrls')],
  ['Gmail mantido',                     json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',           json.includes('"schedule_diario"')],
].forEach(function(c) {
  console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]);
});

console.log('\n=== O QUE MUDOU (v57 → v58) ===');
console.log('ANTES: apify_linkedin_email usava Apify actor anchor/linkedin-to-email');
console.log('       - Free tier: 1 perfil/run (bloqueava batch)');
console.log('       - Taxa de sucesso baixa');
console.log('AGORA: apify_linkedin_email e um HTTP Request para Apollo.io');
console.log('       - 10.000 creditos gratis/mes (~220 usados/mes pelo Victor)');
console.log('       - Base 275M+ contatos B2B verificados');
console.log('       - normalizar_apollo adapta resposta para formato downstream');

console.log('\n=== PROXIMOS PASSOS ===');
if (APOLLO_API_KEY === 'COLE_SUA_CHAVE_APOLLO_AQUI') {
  console.log('');
  console.log('  !! ATENCAO: Chave Apollo.io nao configurada !!');
  console.log('');
  console.log('  1. Crie conta gratis em https://app.apollo.io/');
  console.log('  2. Va em Settings → Integrations → API Keys → Create API Key');
  console.log('  3. Edite este script: substitua COLE_SUA_CHAVE_APOLLO_AQUI pela chave');
  console.log('  4. Rode novamente: node scripts/gerar_victor_pizza_v58.js');
  console.log('  5. Importe Fluxo_victor_pizza_v58.json no n8n');
} else {
  console.log('  1. Importe Fluxo_victor_pizza_v58.json no n8n');
  console.log('  2. Execute o fluxo e verifique o node "apify_linkedin_email"');
  console.log('     Output esperado: { person: { email: "...", first_name: "..." } }');
  console.log('  3. Verifique o node "normalizar_apollo"');
  console.log('     Output esperado: { url: "linkedin.com/in/...", email: "...", _apollo_ok: true }');
  console.log('  4. Se _apollo_ok = false: perfil nao encontrado na base Apollo (normal para alguns)');
}
