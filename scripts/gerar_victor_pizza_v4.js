const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v11.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v4.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

d.name = 'Fluxo Victor Pizza v4 — CNPJá (Receita Federal) substitui Apify + OpenAI';
console.log('✓ Nome atualizado');

const enriquece = d.nodes.find(function(n){ return n.name === 'enriquecer_leads'; });
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado'); process.exit(1); }

// jsCode construído como array de linhas — sem template literal externo (sem problema de escaping)
var L = [];
L.push("// v4-victor-pizza — CNPJá como fonte (Receita Federal)");
L.push("// Pipeline: CNAE + estado + cidade -> leads com email + telefone -> UazAPI");
L.push("");
L.push("const CNPJA_KEY    = 'SUA_CHAVE_CNPJA_AQUI';");
L.push("const UAZAPI_URL   = 'https://secondbrain.uazapi.com';");
L.push("const UAZAPI_TOKEN = '6781e300-9cfe-4d72-9195-aff89f807be2';");
L.push("");
L.push("const webhook = $('receber_busca_dashboard').first().json;");
L.push("const body = webhook.body || webhook;");
L.push("const estado            = body.estado      || 'SP';");
L.push("const cidade            = body.cidade      || '';");
L.push("const tipo_loja         = body.tipo_loja   || 'Supermercados';");
L.push("const quantidade_pedida = parseInt(body.quantidade || 10);");
L.push("const search_id         = body.search_id   || '';");
L.push("");
L.push("const CNAE_MAP = {");
L.push("  'Supermercados':    [4711302],");
L.push("  'Hipermercados':    [4711301],");
L.push("  'Redes de mercado': [4711302, 4711301],");
L.push("};");
L.push("const cnaes = CNAE_MAP[tipo_loja] || [4711302];");
L.push("");
L.push("const BLACKLIST_API = [");
L.push("  'mercearia','mercadinho','padaria','mini mercado',");
L.push("  'hortifruti','quitanda','frutaria',");
L.push("  'restaurante','lanchonete','pizzaria',");
L.push("  'farmacia','farmácia','acougue','açougue','petshop','pet shop',");
L.push("].join(',');");
L.push("");
L.push("function normalizarCelular(area, number) {");
L.push("  if (!area || !number) return null;");
L.push("  var d = String(area) + String(number).replace(/\\D/g, '');");
L.push("  if (d.startsWith('55') && d.length >= 12) d = d.substring(2);");
L.push("  if (d.length === 10) {");
L.push("    var t = d.charAt(2);");
L.push("    if (['6','7','8','9'].indexOf(t) >= 0) d = d.substring(0,2) + '9' + d.substring(2);");
L.push("    else return null;");
L.push("  }");
L.push("  if (d.length !== 11) return null;");
L.push("  if (d.charAt(2) !== '9') return null;");
L.push("  var ddd = parseInt(d.substring(0,2));");
L.push("  if (ddd < 11 || ddd > 99) return null;");
L.push("  return d;");
L.push("}");
L.push("");
L.push("async function existeNoWhatsApp(cel) {");
L.push("  var phone = '55' + cel;");
L.push("  try {");
L.push("    var r = await $helpers.httpRequest({");
L.push("      method: 'POST',");
L.push("      url: UAZAPI_URL + '/contact/check-whatsapp',");
L.push("      headers: { token: UAZAPI_TOKEN, 'Content-Type': 'application/json' },");
L.push("      body: JSON.stringify({ phone: phone }),");
L.push("    });");
L.push("    return r.exists === true;");
L.push("  } catch(e) { return true; }");
L.push("}");
L.push("");
L.push("async function buscarCodigoIBGE(uf, nomeCidade) {");
L.push("  if (!nomeCidade) return null;");
L.push("  try {");
L.push("    var municipios = await $helpers.httpRequest({");
L.push("      method: 'GET',");
L.push("      url: 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + uf + '/municipios',");
L.push("    });");
L.push("    var norm = function(s) { return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); };");
L.push("    var found = municipios.filter(function(m) { return norm(m.nome) === norm(nomeCidade); })[0];");
L.push("    return found ? found.id : null;");
L.push("  } catch(e) { return null; }");
L.push("}");
L.push("");
L.push("async function buscarCNPJa(uf, municipioId, cnaes, quantidade) {");
L.push("  var parts = [];");
L.push("  parts.push('mainActivity.id.in=' + encodeURIComponent(cnaes.join(',')));");
L.push("  parts.push('address.state.in=' + encodeURIComponent(uf));");
L.push("  if (municipioId) parts.push('address.municipality.in=' + encodeURIComponent(String(municipioId)));");
L.push("  parts.push('status.id.in=2');");
L.push("  parts.push('phones.ex=true');");
L.push("  parts.push('names.nin=' + encodeURIComponent(BLACKLIST_API));");
L.push("  parts.push('limit=' + String(Math.min(quantidade * 5, 100)));");
L.push("  var r = await $helpers.httpRequest({");
L.push("    method: 'GET',");
L.push("    url: 'https://api.cnpja.com/office?' + parts.join('&'),");
L.push("    headers: { Authorization: CNPJA_KEY },");
L.push("  });");
L.push("  return r.records || [];");
L.push("}");
L.push("");
L.push("var municipioId = await buscarCodigoIBGE(estado, cidade);");
L.push("var registros   = await buscarCNPJa(estado, municipioId, cnaes, quantidade_pedida);");
L.push("var validos     = [];");
L.push("");
L.push("for (var i = 0; i < registros.length; i++) {");
L.push("  var reg = registros[i];");
L.push("  var nome = reg.alias || (reg.company && reg.company.name) || '';");
L.push("  if (!nome) continue;");
L.push("  var emails   = reg.emails || [];");
L.push("  var emailObj = emails.filter(function(e){ return e.ownership === 'CORPORATE'; })[0]");
L.push("              || emails.filter(function(e){ return e.ownership === 'PERSONAL';  })[0];");
L.push("  var email    = emailObj ? emailObj.address : null;");
L.push("  var phones   = reg.phones || [];");
L.push("  var phoneObj = phones.filter(function(p){ return p.type === 'MOBILE';   })[0]");
L.push("              || phones.filter(function(p){ return p.type === 'LANDLINE'; })[0];");
L.push("  if (!phoneObj) continue;");
L.push("  var cel = normalizarCelular(phoneObj.area, phoneObj.number);");
L.push("  if (!cel) continue;");
L.push("  var temWA = await existeNoWhatsApp(cel);");
L.push("  if (!temWA) continue;");
L.push("  var addr = [");
L.push("    reg.address && reg.address.street,");
L.push("    reg.address && reg.address.number,");
L.push("    reg.address && reg.address.district");
L.push("  ].filter(Boolean).join(', ');");
L.push("  validos.push({");
L.push("    title:            nome,");
L.push("    empresa:          nome,");
L.push("    city:             (reg.address && reg.address.city)  || cidade,");
L.push("    cidade:           (reg.address && reg.address.city)  || cidade,");
L.push("    state:            (reg.address && reg.address.state) || estado,");
L.push("    address:          addr,");
L.push("    phone:            cel,");
L.push("    phoneUnformatted: '55' + cel,");
L.push("    _email:           email,");
L.push("    _cnpj:            reg.taxId,");
L.push("    _fonte_telefone:  phoneObj.type === 'MOBILE' ? 'receita_federal_mobile' : 'receita_federal_fixo',");
L.push("    _prioridade:      0,");
L.push("    quantidade_pedida: quantidade_pedida,");
L.push("  });");
L.push("  if (validos.length >= quantidade_pedida * 2) break;");
L.push("}");
L.push("");
L.push("if (validos.length === 0) {");
L.push("  return [{ json: { _sem_resultado: true, _meta_bruta: registros.length, _meta_filtrada: 0 } }];");
L.push("}");
L.push("return validos.map(function(item, idx) {");
L.push("  var out = {};");
L.push("  for (var k in item) out[k] = item[k];");
L.push("  if (idx === 0) { out._meta_bruta = registros.length; out._meta_filtrada = validos.length; }");
L.push("  return { json: out };");
L.push("});");

const jsCode = L.join('\n');

// ── Validação sintática ────────────────────────────────────────────────────────
try {
  new Function('return async function() { ' + jsCode + ' }');
  console.log('✓ Sintaxe JavaScript válida');
} catch(e) {
  console.error('✗ ERRO DE SINTAXE:', e.message);
  process.exit(1);
}

// ── Checklist ─────────────────────────────────────────────────────────────────
const checks = [
  ['Sem backtick',       !jsCode.includes('`')],
  ['Sem ${',            !jsCode.includes('${')],
  ['$helpers presente', jsCode.includes('$helpers.httpRequest')],
  ['CNPJá endpoint',    jsCode.includes('api.cnpja.com')],
  ['IBGE endpoint',     jsCode.includes('servicodados.ibge')],
  ['WhatsApp check',    jsCode.includes('check-whatsapp')],
  ['Email extraction',  jsCode.includes('CORPORATE')],
  ['encodeURIComponent',jsCode.includes('encodeURIComponent')],
];
checks.forEach(function(c) { console.log((c[1] ? '✓' : '✗') + ' ' + c[0]); });

// ── Aplica no JSON ────────────────────────────────────────────────────────────
enriquece.parameters.jsCode = jsCode;

// Reconecta verificar_reserva → enriquecer_leads (bypassa Apify)
var nomes = ['verificar_reserva', 'reserva_suficiente', 'Switch', 'IF'];
var reconectado = false;
for (var ni = 0; ni < nomes.length; ni++) {
  var conn = d.connections[nomes[ni]];
  if (!conn || !conn.main) continue;
  for (var oi = 0; oi < conn.main.length; oi++) {
    var outputs = conn.main[oi];
    if (!outputs) continue;
    var temApify = outputs.some(function(c){ return c.node && (c.node.toLowerCase().includes('definir') || c.node.toLowerCase().includes('apify') || c.node.toLowerCase().includes('busca')); });
    if (temApify) {
      d.connections[nomes[ni]].main[oi] = [{ node: 'enriquecer_leads', type: 'main', index: 0 }];
      console.log('✓ Reconectado: ' + nomes[ni] + '[' + oi + '] → enriquecer_leads');
      reconectado = true;
      break;
    }
  }
  if (reconectado) break;
}
if (!reconectado) console.warn('⚠ Reconexão automática não encontrou o caminho');

// edit_fields: garante campo email
var editFields = d.nodes.find(function(n){ return n.name === 'edit_fields' || n.name === 'Edit Fields'; });
if (editFields) {
  var assignments = (editFields.parameters && editFields.parameters.assignments && editFields.parameters.assignments.assignments)
    || (editFields.parameters && editFields.parameters.values && editFields.parameters.values.values) || [];
  var temEmail = assignments.some(function(a){ return a.name === 'email' || a.key === 'email'; });
  if (!temEmail) {
    assignments.push({ id: 'email-field', name: 'email', value: '={{ $json._email }}', type: 'string' });
    console.log('✓ edit_fields: campo email adicionado');
  } else {
    console.log('✓ edit_fields: email já presente');
  }
}

fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ── Verificação final ──────────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICAÇÃO FINAL ===');
console.log('Nome v4:           ', json.includes('Victor Pizza v4') ? '✓' : '✗');
console.log('CNPJá endpoint:    ', json.includes('api.cnpja.com') ? '✓' : '✗');
console.log('$helpers:          ', json.includes('$helpers') ? '✓' : '✗');
console.log('IBGE lookup:       ', json.includes('servicodados.ibge') ? '✓' : '✗');
console.log('WhatsApp check:    ', json.includes('check-whatsapp') ? '✓' : '✗');
console.log('Sem OpenAI:        ', !json.includes('openai.com') ? '✓' : '✗');
console.log('Campo email:       ', json.includes('_email') ? '✓' : '✗');
