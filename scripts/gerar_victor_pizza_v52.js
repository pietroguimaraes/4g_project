const fs = require('fs');

// v52: troca mode:'id' por mode:'list' nos dois nodes Apify LinkedIn
// Usa IDs internos do Apify (igual ao Google Maps que já funciona)
// IDs: linkedin-profile-search = M2FMdjRVeF1HPGFcc
//       linkedin-profile-scraper = LpVuK3Zozwuipa5bp

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v51.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v52.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v52 - Apify nodes com mode list';
console.log('OK Nome atualizado');

// ── apify_linkedin_search ─────────────────────────────────────────────────────
var searchNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_search'; });
if (!searchNode) { console.error('ERRO: apify_linkedin_search nao encontrado'); process.exit(1); }

searchNode.parameters.actorId = {
  __rl: true,
  value: 'M2FMdjRVeF1HPGFcc',
  mode: 'list',
  cachedResultName: 'LinkedIn Profile Search Scraper No Cookies (harvestapi/linkedin-profile-search)',
  cachedResultUrl: 'https://console.apify.com/actors/M2FMdjRVeF1HPGFcc/input'
};
console.log('OK apify_linkedin_search: mode id → list (M2FMdjRVeF1HPGFcc)');

// ── apify_linkedin_email ──────────────────────────────────────────────────────
var emailNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_email'; });
if (!emailNode) { console.error('ERRO: apify_linkedin_email nao encontrado'); process.exit(1); }

emailNode.parameters.actorId = {
  __rl: true,
  value: 'LpVuK3Zozwuipa5bp',
  mode: 'list',
  cachedResultName: 'LinkedIn Profile Scraper (harvestapi/linkedin-profile-scraper)',
  cachedResultUrl: 'https://console.apify.com/actors/LpVuK3Zozwuipa5bp/input'
};
console.log('OK apify_linkedin_email: mode id → list (LpVuK3Zozwuipa5bp)');

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificação ───────────────────────────────────────────────────────────────
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v52',                       JSON.stringify(d).includes('Victor Pizza v52')],
  ['search: mode list',              searchNode.parameters.actorId.mode === 'list'],
  ['search: ID interno correto',     searchNode.parameters.actorId.value === 'M2FMdjRVeF1HPGFcc'],
  ['email: mode list',               emailNode.parameters.actorId.mode === 'list'],
  ['email: ID interno correto',      emailNode.parameters.actorId.value === 'LpVuK3Zozwuipa5bp'],
  ['São Paulo no jsCode',            JSON.stringify(d).includes('São Paulo')],
  ['Gmail node mantido',             JSON.stringify(d).includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',        JSON.stringify(d).includes('"schedule_diario"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
