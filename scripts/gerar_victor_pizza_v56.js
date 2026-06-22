const fs = require('fs');

// v56: corrige apify_linkedin_email para mode:'list' com ID interno
// Mesmo padrão usado no apify_linkedin_search (v52)
// ID interno anchor/linkedin-to-email = v2BduQ96tuQA3R41k

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v55.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v56.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v56 - email finder mode list';
console.log('OK Nome atualizado');

var emailNode = d.nodes.find(function(n) { return n.name === 'apify_linkedin_email'; });
if (!emailNode) { console.error('ERRO: apify_linkedin_email nao encontrado'); process.exit(1); }

emailNode.parameters.actorId = {
  __rl: true,
  value: 'v2BduQ96tuQA3R41k',
  mode: 'list',
  cachedResultName: 'LinkedIn To Email (anchor/linkedin-to-email)',
  cachedResultUrl: 'https://console.apify.com/actors/v2BduQ96tuQA3R41k/input'
};
console.log('OK actorId: mode list, ID v2BduQ96tuQA3R41k (anchor/linkedin-to-email)');

fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v56',                    json.includes('Victor Pizza v56')],
  ['mode list',                   emailNode.parameters.actorId.mode === 'list'],
  ['ID interno correto',          emailNode.parameters.actorId.value === 'v2BduQ96tuQA3R41k'],
  ['customBody com startUrls',    emailNode.parameters.customBody.includes('startUrls')],
  ['coletar batch (v55)',         json.includes('perfis.length === 0')],
  ['Gmail mantido',               json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',     json.includes('"schedule_diario"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
