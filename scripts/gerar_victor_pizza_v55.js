const fs = require('fs');

// v55: resolve travamento de 1h+ no apify_linkedin_email
//
// PROBLEMA: coletar_urls_linkedin retornava 24 itens separados
// → apify_linkedin_email rodava 24x em sequência = horas de espera
//
// SOLUÇÃO: coletar_urls_linkedin agora retorna 1 item com TODOS os URLs
// → apify_linkedin_email faz UMA chamada com startUrls=[...24 URLs...]
// → Apify processa em paralelo = minutos
//
// Actor: anchor/linkedin-to-email
// Input: { startUrls: [{ url: "..." }, { url: "..." }, ...] }
// Output: array de { url, email, id }

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v54.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v55.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v55 - batch LinkedIn (1 chamada para todos)';
console.log('OK Nome atualizado');

// ── 1. Corrige coletar_urls_linkedin: retorna 1 item com todos os URLs ─────────
var coletarNode = d.nodes.find(function(n) { return n.name === 'coletar_urls_linkedin'; });
if (!coletarNode) { console.error('ERRO: coletar_urls_linkedin nao encontrado'); process.exit(1); }

coletarNode.parameters.jsCode = [
  '// Coleta TODOS os linkedinUrl em um unico item (batch)',
  '// Evita rodar o Actor Apify 24x em sequencia',
  'var perfis = $input.all().filter(function(i) { return i.json.linkedinUrl; });',
  'var prep = $(\'preparar_busca_linkedin\').first().json;',
  '',
  'console.log(\'Perfis com linkedinUrl:\', perfis.length);',
  '',
  'if (perfis.length === 0) {',
  '  return [{ json: { _sem_resultado: true, _meta_bruta: 0 } }];',
  '}',
  '',
  '// Monta array startUrls para o anchor/linkedin-to-email',
  'var startUrls = perfis.map(function(i) {',
  '  return { url: i.json.linkedinUrl };',
  '});',
  '',
  '// Retorna UM unico item com todos os URLs + dados de referencia',
  'return [{ json: {',
  '  startUrls:   startUrls,',
  '  _meta_bruta: perfis.length,',
  '  _nomes: perfis.map(function(i) {',
  '    return {',
  '      url:       i.json.linkedinUrl,',
  '      firstName: i.json.firstName || \'\',',
  '      lastName:  i.json.lastName  || \'\'',
  '    };',
  '  })',
  '}}];'
].join('\n');
console.log('OK coletar_urls_linkedin: 24 itens → 1 item com array startUrls');

// ── 2. Corrige apify_linkedin_email: usa startUrls do item anterior ────────────
var emailNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_email'; });
if (!emailNode) { console.error('ERRO: apify_linkedin_email nao encontrado'); process.exit(1); }

emailNode.parameters.actorId = {
  __rl: true,
  value: 'anchor~linkedin-to-email',
  mode: 'id',
  cachedResultName: 'LinkedIn To Email (anchor/linkedin-to-email)',
  cachedResultUrl: 'https://console.apify.com/actors/anchor~linkedin-to-email/input'
};

// startUrls já vem montado pelo coletar_urls_linkedin
emailNode.parameters.customBody = '={{ JSON.stringify({ startUrls: $json.startUrls }) }}';
console.log('OK apify_linkedin_email: recebe startUrls prontos (1 chamada batch)');

// ── Valida sintaxe do jsCode ───────────────────────────────────────────────────
try {
  new Function('return async function() { ' + coletarNode.parameters.jsCode + ' }');
  console.log('OK Sintaxe jsCode valida');
} catch(e) {
  console.error('ERRO SINTAXE:', e.message);
  process.exit(1);
}

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao ───────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v55',                            json.includes('Victor Pizza v55')],
  ['coletar: retorna 1 item com array',   coletarNode.parameters.jsCode.includes('startUrls')],
  ['coletar: nao usa perfis.map de v53', !coletarNode.parameters.jsCode.includes('linkedinUrl: i.json.linkedinUrl')],
  ['email: actor anchor correto',         emailNode.parameters.actorId.value === 'anchor~linkedin-to-email'],
  ['email: customBody usa startUrls',     emailNode.parameters.customBody.includes('startUrls')],
  ['Gmail node mantido',                  json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',             json.includes('"schedule_diario"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== O QUE MUDA ===');
console.log('ANTES: 24 chamadas Apify em sequencia = 1h+');
console.log('AGORA: 1 chamada Apify com 24 URLs = ~5-10 min');
