const fs = require('fs');

// v16: lê o OUTPUT do v15 e só corrige o code_in_java para aceitar fixo + celular
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v15.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v16.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v16 - aceita telefone fixo no code_in_java';
console.log('✓ Nome atualizado');

// ── Localiza e substitui code_in_java ─────────────────────────────────────────
var codeInJava = d.nodes.find(function(n) { return n.name === 'code_in_java'; });
if (!codeInJava) {
  console.error('✗ ERRO: node code_in_java nao encontrado');
  process.exit(1);
}

// Substitui o jsCode por versão que aceita fixo (10 dígitos) e celular (11 dígitos)
codeInJava.parameters.jsCode = buildCodeInJava();
console.log('✓ code_in_java atualizado (aceita fixo + celular)');

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo: ' + OUTPUT);

// ── Verificação final ─────────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
var checks = [
  ['Nome v16',             json.includes('Victor Pizza v16')],
  ['code_in_java presente',json.includes('"code_in_java"')],
  ['Aceita fixo',          json.includes('isLandline')],
  ['Aceita celular',       json.includes('isMobile')],
  ['processar_leads',      json.includes('"processar_leads"')],
  ['buscar_cnpja',         json.includes('"buscar_cnpja"')],
  ['api.cnpja.com',        json.includes('api.cnpja.com')],
  ['SEM buscar_municipios',!json.includes('"buscar_municipios_ibge"')],
];
checks.forEach(function(c) { console.log((c[1] ? '✓' : '✗') + ' ' + c[0]); });

// ── Código do node code_in_java ────────────────────────────────────────────────
function buildCodeInJava() {
  var L = [];
  L.push("// Valida e normaliza telefones para o pipeline");
  L.push("// Aceita: celular BR (11 digitos, 3o=9) e fixo BR (10 digitos 2-5)");
  L.push("var items      = $input.all();");
  L.push("var validItems = [];");
  L.push("");
  L.push("for (var i = 0; i < items.length; i++) {");
  L.push("  var item     = items[i];");
  L.push("  var rawPhone = item.json.phoneUnformatted || item.json.phone || '';");
  L.push("  var digits   = rawPhone.replace(/\\D/g, '');");
  L.push("");
  L.push("  if (!digits) continue;");
  L.push("");
  L.push("  // Remove codigo de pais 55 se presente (55 + 10 ou 11 digitos = 12 ou 13)");
  L.push("  if (digits.startsWith('55') && digits.length >= 12) {");
  L.push("    digits = digits.substring(2);");
  L.push("  }");
  L.push("");
  L.push("  var ddd = parseInt(digits.substring(0, 2));");
  L.push("  if (ddd < 11 || ddd > 99) continue;");
  L.push("");
  L.push("  // Celular: 11 digitos, 3o digito = 9");
  L.push("  var isMobile   = digits.length === 11 && digits.charAt(2) === '9';");
  L.push("  // Celular antigo sem 9: 10 digitos comecando com 6-9 → adiciona 9");
  L.push("  var isOldCell  = digits.length === 10 && '6789'.indexOf(digits.charAt(2)) >= 0;");
  L.push("  // Fixo: 10 digitos comecando com 2-5");
  L.push("  var isLandline = digits.length === 10 && '2345'.indexOf(digits.charAt(2)) >= 0;");
  L.push("");
  L.push("  if (!isMobile && !isOldCell && !isLandline) continue;");
  L.push("");
  L.push("  // Normaliza celular antigo adicionando o 9");
  L.push("  if (isOldCell) digits = digits.substring(0, 2) + '9' + digits.substring(2);");
  L.push("");
  L.push("  // Clona item e atualiza campos de telefone");
  L.push("  var newItem = JSON.parse(JSON.stringify(item.json));");
  L.push("  newItem.phone            = digits;");
  L.push("  newItem.phoneUnformatted = '55' + digits;");
  L.push("  newItem._wa_phone        = '55' + digits;");
  L.push("  newItem._tipo_fone       = isMobile ? 'celular' : (isOldCell ? 'celular' : 'fixo');");
  L.push("");
  L.push("  validItems.push({ json: newItem });");
  L.push("}");
  L.push("");
  L.push("if (validItems.length === 0) {");
  L.push("  return [{ json: { _sem_resultado: true } }];");
  L.push("}");
  L.push("");
  L.push("return validItems;");
  return L.join('\n');
}
