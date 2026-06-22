const fs = require('fs');

// v53: corrige coletar_urls_linkedin
// Bug 1: filtrava por i.json.profileUrl (campo inexistente) → deveria ser i.json.linkedinUrl
// Bug 2: código incompleto — não tinha return quando perfis eram encontrados

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v52.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v53.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v53 - fix coletar_urls_linkedin';
console.log('OK Nome atualizado');

// ── Corrige coletar_urls_linkedin ─────────────────────────────────────────────
var node = d.nodes.find(function(n) { return n.name === 'coletar_urls_linkedin'; });
if (!node) { console.error('ERRO: coletar_urls_linkedin nao encontrado'); process.exit(1); }

var codigoNovo = [
  '// Roda uma vez para TODOS os items do Actor 1',
  'var perfis = $input.all().filter(function(i) { return i.json.linkedinUrl; });',
  'var prep = $(\'preparar_busca_linkedin\').first().json;',
  '',
  'console.log(\'Actor1 retornou:\', perfis.length, \'perfis com URL\');',
  '',
  'if (perfis.length === 0) {',
  '  return [{ json: { _sem_resultado: true, _meta_bruta: 0 } }];',
  '}',
  '',
  'return perfis.map(function(i) {',
  '  return { json: {',
  '    linkedinUrl: i.json.linkedinUrl,',
  '    firstName:   i.json.firstName || \'\',',
  '    lastName:    i.json.lastName  || \'\',',
  '    _meta_bruta: perfis.length',
  '  }};',
  '});'
].join('\n');

node.parameters.jsCode = codigoNovo;
console.log('OK coletar_urls_linkedin: profileUrl → linkedinUrl + return adicionado');

// ── Valida sintaxe ────────────────────────────────────────────────────────────
try {
  new Function('return async function() { ' + node.parameters.jsCode + ' }');
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
  ['Nome v53',                       json.includes('Victor Pizza v53')],
  ['usa linkedinUrl no filter',      node.parameters.jsCode.includes('i.json.linkedinUrl')],
  ['nao usa profileUrl',            !node.parameters.jsCode.includes('profileUrl')],
  ['tem return com map',             node.parameters.jsCode.includes('perfis.map')],
  ['retorna linkedinUrl',            node.parameters.jsCode.includes('linkedinUrl: i.json.linkedinUrl')],
  ['retorna firstName',              node.parameters.jsCode.includes('firstName')],
  ['retorna lastName',               node.parameters.jsCode.includes('lastName')],
  ['mode list search mantido',       json.includes('"mode": "list"')],
  ['Gmail node mantido',             json.includes('n8n-nodes-base.gmail')],
  ['schedule_diario mantido',        json.includes('"schedule_diario"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });
