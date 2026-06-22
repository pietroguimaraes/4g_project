const fs = require('fs');

// v54: substitui apify_linkedin_email por actor dedicado de email finder
// Actor antigo: harvestapi/linkedin-profile-scraper (scraper geral - nao retorna email)
// Actor novo:   anchor/linkedin-to-email (email finder dedicado)
//
// Input do anchor/linkedin-to-email:
//   { startUrls: [{ url: "https://www.linkedin.com/in/username" }] }
// Output:
//   { url, email, id } — apenas 3 campos, sem JSON gigante

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v53.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v54.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v54 - email finder correto (anchor/linkedin-to-email)';
console.log('OK Nome atualizado');

// ── Troca o actor do apify_linkedin_email ─────────────────────────────────────
var emailNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_email'; });
if (!emailNode) { console.error('ERRO: apify_linkedin_email nao encontrado'); process.exit(1); }

// Troca o actorId
emailNode.parameters.actorId = {
  __rl: true,
  value: 'anchor~linkedin-to-email',
  mode: 'id',
  cachedResultName: 'LinkedIn To Email (anchor/linkedin-to-email)',
  cachedResultUrl: 'https://console.apify.com/actors/anchor~linkedin-to-email/input'
};
console.log('OK actorId: harvestapi/linkedin-profile-scraper → anchor/linkedin-to-email');

// Atualiza o Input JSON para o formato correto do novo actor
// O actor recebe startUrls: [{ url: "linkedin.com/in/..." }]
emailNode.parameters.customBody = '={{ JSON.stringify({ startUrls: [{ url: $json.linkedinUrl }] }) }}';
console.log('OK customBody: startUrls: [{ url: $json.linkedinUrl }]');

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao ───────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v54',                           json.includes('Victor Pizza v54')],
  ['actor novo anchor~linkedin-to-email', emailNode.parameters.actorId.value === 'anchor~linkedin-to-email'],
  ['nao usa harvestapi scraper',         !json.includes('LpVuK3Zozwuipa5bp')],
  ['customBody com startUrls',           emailNode.parameters.customBody.includes('startUrls')],
  ['customBody com linkedinUrl',         emailNode.parameters.customBody.includes('linkedinUrl')],
  ['coletar_urls_linkedin com fix v53',  json.includes('perfis.map')],
  ['Gmail node mantido',                 json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',            json.includes('"schedule_diario"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== PROXIMOS PASSOS ===');
console.log('1. Importe Fluxo_victor_pizza_v54.json no n8n');
console.log('2. Execute o fluxo e verifique o output de apify_linkedin_email');
console.log('3. Output esperado: { url, email, id } por perfil');
console.log('4. Se email vier preenchido: pipeline funcionando!');
console.log('5. Se email vier null/vazio: hit rate baixo (LinkedIn nao expoe emails)');
