const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v11.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v6.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v6 - CNPJa substitui Apify + OpenAI';
console.log('Nome atualizado');

const enriquece = d.nodes.find(function(n){ return n.name === 'enriquecer_leads'; });
if (!enriquece) { console.error('ERRO: no enriquecer_leads nao encontrado'); process.exit(1); }

// jsCode como array de linhas — sem template literal externo, sem problema de escaping
var L = [];

L.push("var CNPJA_KEY    = 'SUA_CHAVE_CNPJA_AQUI';");
L.push("var UAZAPI_URL   = 'https://secondbrain.uazapi.com';");
L.push("var UAZAPI_TOKEN = '6781e300-9cfe-4d72-9195-aff89f807be2';");
L.push("var helpers      = this.helpers;");
L.push("");
L.push("var webhook           = $('receber_busca_dashboard').first().json;");
L.push("var body              = webhook.body || webhook;");
L.push("var estado            = String(body.estado      || 'SP');");
L.push("var cidade            = String(body.cidade      || '');");
L.push("var tipo_loja         = String(body.tipo_loja   || 'Supermercados');");
L.push("var quantidade_pedida = parseInt(body.quantidade || 10);");
L.push("var search_id         = String(body.search_id   || '');");
L.push("");
L.push("var CNAE_MAP = {");
L.push("  'Supermercados':    [4711302],");
L.push("  'Hipermercados':    [4711301],");
L.push("  'Redes de mercado': [4711302, 4711301]");
L.push("};");
L.push("var cnaes = CNAE_MAP[tipo_loja] || [4711302];");
L.push("");
L.push("var BLACKLIST = [");
L.push("  'mercearia', 'mercadinho', 'padaria', 'mini mercado',");
L.push("  'hortifruti', 'quitanda', 'frutaria',");
L.push("  'restaurante', 'lanchonete', 'pizzaria',");
L.push("  'farmacia', 'acougue', 'petshop', 'pet shop'");
L.push("];");
L.push("");
L.push("function nomeBloqueado(nome) {");
L.push("  var n = nome.toLowerCase();");
L.push("  for (var i = 0; i < BLACKLIST.length; i++) {");
L.push("    if (n.indexOf(BLACKLIST[i]) >= 0) return true;");
L.push("  }");
L.push("  return false;");
L.push("}");
L.push("");
L.push("function normalizarCelular(area, number) {");
L.push("  if (!area || !number) return null;");
L.push("  var digits = String(area) + String(number).replace(/\\D/g, '');");
L.push("  if (digits.length === 10) {");
L.push("    var t = digits.charAt(2);");
L.push("    if ('6789'.indexOf(t) >= 0) digits = digits.substring(0, 2) + '9' + digits.substring(2);");
L.push("    else return null;");
L.push("  }");
L.push("  if (digits.length !== 11) return null;");
L.push("  if (digits.charAt(2) !== '9') return null;");
L.push("  var ddd = parseInt(digits.substring(0, 2));");
L.push("  if (ddd < 11 || ddd > 99) return null;");
L.push("  return digits;");
L.push("}");
L.push("");
L.push("async function verificarWhatsApp(cel) {");
L.push("  var phone = '55' + cel;");
L.push("  try {");
L.push("    var resp = await helpers.httpRequest({");
L.push("      method: 'POST',");
L.push("      url: UAZAPI_URL + '/contact/check-whatsapp',");
L.push("      headers: { token: UAZAPI_TOKEN, 'Content-Type': 'application/json' },");
L.push("      body: JSON.stringify({ phone: phone })");
L.push("    });");
L.push("    return resp.exists === true;");
L.push("  } catch (e) {");
L.push("    return true;");
L.push("  }");
L.push("}");
L.push("");
L.push("async function buscarMunicipio(uf, nomeCidade) {");
L.push("  if (!nomeCidade) return null;");
L.push("  try {");
L.push("    var lista = await helpers.httpRequest({");
L.push("      method: 'GET',");
L.push("      url: 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + uf + '/municipios'");
L.push("    });");
L.push("    var norm = function(s) {");
L.push("      return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');");
L.push("    };");
L.push("    for (var i = 0; i < lista.length; i++) {");
L.push("      if (norm(lista[i].nome) === norm(nomeCidade)) return lista[i].id;");
L.push("    }");
L.push("    return null;");
L.push("  } catch (e) {");
L.push("    return null;");
L.push("  }");
L.push("}");
L.push("");
L.push("async function buscarEmpresas(uf, municipioId, cnaes, qtd) {");
L.push("  var params = [];");
L.push("  params.push('mainActivity.id.in=' + encodeURIComponent(cnaes.join(',')));");
L.push("  params.push('address.state.in=' + encodeURIComponent(uf));");
L.push("  if (municipioId) params.push('address.municipality.in=' + encodeURIComponent(String(municipioId)));");
L.push("  params.push('status.id.in=2');");
L.push("  params.push('phones.ex=true');");
L.push("  params.push('limit=' + String(Math.min(qtd * 5, 100)));");
L.push("  var resp = await helpers.httpRequest({");
L.push("    method: 'GET',");
L.push("    url: 'https://api.cnpja.com/office?' + params.join('&'),");
L.push("    headers: { Authorization: CNPJA_KEY }");
L.push("  });");
L.push("  return resp.records || [];");
L.push("}");
L.push("");
L.push("var municipioId = await buscarMunicipio(estado, cidade);");
L.push("var registros   = await buscarEmpresas(estado, municipioId, cnaes, quantidade_pedida);");
L.push("var validos     = [];");
L.push("");
L.push("for (var i = 0; i < registros.length; i++) {");
L.push("  if (validos.length >= quantidade_pedida * 2) break;");
L.push("  var reg  = registros[i];");
L.push("  var nome = reg.alias || (reg.company && reg.company.name) || '';");
L.push("  if (!nome || nomeBloqueado(nome)) continue;");
L.push("");
L.push("  var phones   = reg.phones || [];");
L.push("  var phoneObj = null;");
L.push("  for (var pi = 0; pi < phones.length; pi++) {");
L.push("    if (phones[pi].type === 'MOBILE') { phoneObj = phones[pi]; break; }");
L.push("  }");
L.push("  if (!phoneObj) {");
L.push("    for (var pi = 0; pi < phones.length; pi++) {");
L.push("      if (phones[pi].type === 'LANDLINE') { phoneObj = phones[pi]; break; }");
L.push("    }");
L.push("  }");
L.push("  if (!phoneObj) continue;");
L.push("");
L.push("  var cel = normalizarCelular(phoneObj.area, phoneObj.number);");
L.push("  if (!cel) continue;");
L.push("");
L.push("  var temWA = await verificarWhatsApp(cel);");
L.push("  if (!temWA) continue;");
L.push("");
L.push("  var emails   = reg.emails || [];");
L.push("  var emailObj = null;");
L.push("  for (var ei = 0; ei < emails.length; ei++) {");
L.push("    if (emails[ei].ownership === 'CORPORATE') { emailObj = emails[ei]; break; }");
L.push("  }");
L.push("  if (!emailObj) {");
L.push("    for (var ei = 0; ei < emails.length; ei++) {");
L.push("      if (emails[ei].ownership === 'PERSONAL') { emailObj = emails[ei]; break; }");
L.push("    }");
L.push("  }");
L.push("  var email = emailObj ? emailObj.address : null;");
L.push("");
L.push("  var addr = [];");
L.push("  if (reg.address && reg.address.street)   addr.push(reg.address.street);");
L.push("  if (reg.address && reg.address.number)   addr.push(reg.address.number);");
L.push("  if (reg.address && reg.address.district) addr.push(reg.address.district);");
L.push("");
L.push("  validos.push({");
L.push("    title:             nome,");
L.push("    empresa:           nome,");
L.push("    city:              (reg.address && reg.address.city)  || cidade,");
L.push("    cidade:            (reg.address && reg.address.city)  || cidade,");
L.push("    state:             (reg.address && reg.address.state) || estado,");
L.push("    address:           addr.join(', '),");
L.push("    phone:             cel,");
L.push("    phoneUnformatted:  '55' + cel,");
L.push("    _email:            email,");
L.push("    _cnpj:             reg.taxId,");
L.push("    _fonte_telefone:   phoneObj.type === 'MOBILE' ? 'receita_federal_mobile' : 'receita_federal_fixo',");
L.push("    _prioridade:       0,");
L.push("    quantidade_pedida: quantidade_pedida");
L.push("  });");
L.push("}");
L.push("");
L.push("if (validos.length === 0) {");
L.push("  return [{ json: { _sem_resultado: true, _meta_bruta: registros.length, _meta_filtrada: 0 } }];");
L.push("}");
L.push("");
L.push("return validos.map(function(item, idx) {");
L.push("  var out = {};");
L.push("  for (var k in item) out[k] = item[k];");
L.push("  if (idx === 0) {");
L.push("    out._meta_bruta    = registros.length;");
L.push("    out._meta_filtrada = validos.length;");
L.push("  }");
L.push("  return { json: out };");
L.push("});");

const jsCode = L.join('\n');

// Validacao sintatica
try {
  new Function('return async function() { ' + jsCode + ' }');
  console.log('Sintaxe JavaScript valida');
} catch (e) {
  console.error('ERRO DE SINTAXE: ' + e.message);
  process.exit(1);
}

// Checklist
var checks = [
  ['Sem backtick',       !jsCode.includes('`')],
  ['Sem template ${',    !jsCode.includes('${')],
  ['this.helpers capturado', jsCode.includes('this.helpers')],
  ['helpers.httpRequest',   jsCode.includes('helpers.httpRequest')],
  ['CNPJa endpoint',     jsCode.includes('api.cnpja.com')],
  ['IBGE endpoint',      jsCode.includes('servicodados.ibge')],
  ['WhatsApp check',     jsCode.includes('check-whatsapp')],
  ['encodeURIComponent', jsCode.includes('encodeURIComponent')],
  ['normalizarCelular',  jsCode.includes('normalizarCelular')],
];
checks.forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

// Aplica no no
enriquece.parameters.jsCode = jsCode;

// Reconecta reserva_suficiente[1] para enriquecer_leads (bypassa Apify)
var nomes = ['verificar_reserva', 'reserva_suficiente', 'Switch', 'IF'];
var reconectado = false;
for (var ni = 0; ni < nomes.length; ni++) {
  var conn = d.connections[nomes[ni]];
  if (!conn || !conn.main) continue;
  for (var oi = 0; oi < conn.main.length; oi++) {
    var outputs = conn.main[oi];
    if (!outputs) continue;
    var temApify = outputs.some(function(c) {
      return c.node && (
        c.node.toLowerCase().indexOf('definir') >= 0 ||
        c.node.toLowerCase().indexOf('apify')   >= 0 ||
        c.node.toLowerCase().indexOf('busca')   >= 0
      );
    });
    if (temApify) {
      d.connections[nomes[ni]].main[oi] = [{ node: 'enriquecer_leads', type: 'main', index: 0 }];
      console.log('Reconectado: ' + nomes[ni] + '[' + oi + '] para enriquecer_leads');
      reconectado = true;
      break;
    }
  }
  if (reconectado) break;
}
if (!reconectado) console.warn('AVISO: Reconexao automatica nao encontrou o caminho');

// edit_fields: garante campo email
var editFields = d.nodes.find(function(n) { return n.name === 'edit_fields' || n.name === 'Edit Fields'; });
if (editFields) {
  var assignments =
    (editFields.parameters && editFields.parameters.assignments && editFields.parameters.assignments.assignments) ||
    (editFields.parameters && editFields.parameters.values    && editFields.parameters.values.values)            || [];
  var temEmail = assignments.some(function(a) { return a.name === 'email' || a.key === 'email'; });
  if (!temEmail) {
    assignments.push({ id: 'email-field', name: 'email', value: '={{ $json._email }}', type: 'string' });
    console.log('edit_fields: campo email adicionado');
  } else {
    console.log('edit_fields: email ja presente');
  }
}

// Corrige finalizar_busca: $('definir_termos') nao executa mais (Apify bypasado)
// Substitui por leitura do webhook original
var finalizarBusca = d.nodes.find(function(n) { return n.name === 'finalizar_busca'; });
if (finalizarBusca && finalizarBusca.parameters && finalizarBusca.parameters.jsCode) {
  var fbCode = finalizarBusca.parameters.jsCode;
  // Injeta variavel de leitura do webhook no topo do codigo
  var wbLine = "var _wb = $('receber_busca_dashboard').first().json; var _bd = _wb.body || _wb;\n";
  fbCode = wbLine + fbCode;
  // Substitui todas as referencias a definir_termos
  fbCode = fbCode.split("$('definir_termos').first().json.tipo_loja").join("(_bd.tipo_loja || '')");
  fbCode = fbCode.split("$('definir_termos').first().json.quantidade_pedida").join("parseInt(_bd.quantidade || 10)");
  fbCode = fbCode.split('$("definir_termos").first().json.tipo_loja').join("(_bd.tipo_loja || '')");
  fbCode = fbCode.split('$("definir_termos").first().json.quantidade_pedida').join("parseInt(_bd.quantidade || 10)");
  finalizarBusca.parameters.jsCode = fbCode;
  console.log('finalizar_busca: referencias a definir_termos corrigidas');
} else {
  console.warn('AVISO: finalizar_busca nao encontrado ou sem jsCode');
}

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('Arquivo salvo: ' + OUTPUT);

// Verificacao final
var json = JSON.stringify(d);
console.log('');
console.log('=== VERIFICACAO FINAL ===');
console.log('Nome v6:        ' + (json.includes('Victor Pizza v6') ? 'OK' : 'FALHOU'));
console.log('CNPJa endpoint: ' + (json.includes('api.cnpja.com')    ? 'OK' : 'FALHOU'));
console.log('this.helpers:   ' + (json.includes('this.helpers')       ? 'OK' : 'FALHOU'));
console.log('Sem $helpers:   ' + (!json.includes('$helpers')          ? 'OK' : 'FALHOU'));
console.log('IBGE lookup:    ' + (json.includes('servicodados.ibge') ? 'OK' : 'FALHOU'));
console.log('WhatsApp check: ' + (json.includes('check-whatsapp')    ? 'OK' : 'FALHOU'));
console.log('Sem OpenAI:     ' + (!json.includes('openai.com')       ? 'OK' : 'FALHOU'));
console.log('Campo email:    ' + (json.includes('_email')            ? 'OK' : 'FALHOU'));
