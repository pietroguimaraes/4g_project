const fs = require('fs');
const crypto = require('crypto');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v11.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v15.json';

const CNPJA_KEY    = '1239882e-5005-475f-9be1-41b4123846dd-b7c95f5e-5c9e-4b78-9ef3-4ffdb872a793';
const SUPABASE_URL = 'https://tuctjosvxdzbfnyvvodc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1Y3Rqb3N2eGR6YmZueXZ2b2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTk3MzYsImV4cCI6MjA5NDY5NTczNn0.jPjPQz18lsEdpQLSxQCz2kP0uObAQ1XTs1Kj5qANcko';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v15 - municipio_id vem do frontend';
console.log('OK Nome atualizado');

// ── 1. Transforma enriquecer_leads → extrair_params ───────────────────────────
var enriquece = d.nodes.find(function(n) { return n.name === 'enriquecer_leads'; });
if (!enriquece) { console.error('ERRO: no enriquecer_leads nao encontrado'); process.exit(1); }

var posBase = Array.isArray(enriquece.position) ? enriquece.position : [600, 300];
enriquece.name = 'extrair_params';
enriquece.type = 'n8n-nodes-base.code';
enriquece.typeVersion = 2;
enriquece.parameters = { mode: 'runOnceForAllItems', jsCode: buildExtrairParams() };
console.log('OK extrair_params configurado');

// ── 2. Atualiza referencias de conexoes ───────────────────────────────────────
Object.keys(d.connections).forEach(function(nodeName) {
  var conn = d.connections[nodeName];
  if (!conn || !conn.main) return;
  conn.main.forEach(function(outputs) {
    if (!outputs) return;
    outputs.forEach(function(c) {
      if (c && c.node === 'enriquecer_leads') c.node = 'extrair_params';
    });
  });
});
if (d.connections['enriquecer_leads']) {
  d.connections['extrair_params'] = d.connections['enriquecer_leads'];
  delete d.connections['enriquecer_leads'];
}
console.log('OK Referencias enriquecer_leads → extrair_params');

// ── 3. FIX: $('enriquecer_leads') → $('processar_leads') em todos os nodes ───
d.nodes.forEach(function(node) {
  var paramStr = JSON.stringify(node.parameters);
  if (paramStr.indexOf('enriquecer_leads') >= 0) {
    var fixed = paramStr.split("$('enriquecer_leads')").join("$('processar_leads')");
    fixed = fixed.split('$("enriquecer_leads")').join('$("processar_leads")');
    node.parameters = JSON.parse(fixed);
    console.log('OK Fix enriquecer_leads → processar_leads em: ' + node.name);
  }
});

// ── 4. Reconecta reserva_suficiente → extrair_params ─────────────────────────
var nomesOrigem = ['verificar_reserva', 'reserva_suficiente', 'Switch', 'IF'];
var reconectado = false;
for (var ni = 0; ni < nomesOrigem.length; ni++) {
  var nomeCon = nomesOrigem[ni];
  var conn = d.connections[nomeCon];
  if (!conn || !conn.main) continue;
  for (var oi = 0; oi < conn.main.length; oi++) {
    var outputs = conn.main[oi];
    if (!outputs) continue;
    var temApify = outputs.some(function(c) {
      return c && c.node && (
        c.node.toLowerCase().indexOf('definir') >= 0 ||
        c.node.toLowerCase().indexOf('apify')   >= 0 ||
        c.node.toLowerCase().indexOf('busca')   >= 0
      );
    });
    if (temApify) {
      d.connections[nomeCon].main[oi] = [{ node: 'extrair_params', type: 'main', index: 0 }];
      console.log('OK Reconectado: ' + nomeCon + '[' + oi + '] → extrair_params');
      reconectado = true;
      break;
    }
  }
  if (reconectado) break;
}
if (!reconectado) console.warn('AVISO: Reconexao automatica nao encontrou o caminho');

// ── 5. Adiciona os 4 novos nos ────────────────────────────────────────────────
// v15: SEM buscar_municipios_ibge, SEM encontrar_id
// Cadeia: extrair_params → buscar_fones_existentes → preparar_busca → buscar_cnpja → processar_leads
var px = posBase[0];
var py = posBase[1];

// 5a. buscar_fones_existentes — telefones já no banco para anti-duplicata
var nodeFones = {
  id: crypto.randomUUID(),
  name: 'buscar_fones_existentes',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.1,
  position: [px + 220, py],
  parameters: {
    method: 'GET',
    url: '={{ $json.supabase_phones_url }}',
    authentication: 'none',
    sendQuery: false,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'apikey',        value: SUPABASE_ANON },
        { name: 'Authorization', value: 'Bearer ' + SUPABASE_ANON }
      ]
    },
    sendBody: false,
    options: { response: { response: { neverError: true } } }
  }
};
d.nodes.push(nodeFones);
console.log('OK buscar_fones_existentes adicionado');

// 5b. preparar_busca — monta URL CNPJa usando municipio_id do webhook
var nodePreparar = {
  id: crypto.randomUUID(),
  name: 'preparar_busca',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [px + 440, py],
  parameters: { mode: 'runOnceForAllItems', jsCode: buildPreparar() }
};
d.nodes.push(nodePreparar);
console.log('OK preparar_busca adicionado (municipio_id do frontend)');

// 5c. buscar_cnpja — HTTP GET CNPJa
var nodeBuscarCnpja = {
  id: crypto.randomUUID(),
  name: 'buscar_cnpja',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.1,
  position: [px + 660, py],
  parameters: {
    method: 'GET',
    url: '={{ $json.cnpja_url }}',
    authentication: 'none',
    sendQuery: false,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Authorization', value: CNPJA_KEY }] },
    sendBody: false,
    options: {}
  }
};
d.nodes.push(nodeBuscarCnpja);
console.log('OK buscar_cnpja adicionado');

// 5d. processar_leads — normaliza, filtra duplicatas, aceita fixo e celular
var nodeProcessar = {
  id: crypto.randomUUID(),
  name: 'processar_leads',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [px + 880, py],
  parameters: { mode: 'runOnceForAllItems', jsCode: buildProcessar() }
};
d.nodes.push(nodeProcessar);
console.log('OK processar_leads adicionado');

// ── 6. Cabeamento ─────────────────────────────────────────────────────────────
// v15: extrair_params → buscar_fones_existentes → preparar_busca → buscar_cnpja → processar_leads → finalizar_busca
d.connections['extrair_params']         = { main: [[{ node: 'buscar_fones_existentes', type: 'main', index: 0 }]] };
d.connections['buscar_fones_existentes']= { main: [[{ node: 'preparar_busca',          type: 'main', index: 0 }]] };
d.connections['preparar_busca']         = { main: [[{ node: 'buscar_cnpja',            type: 'main', index: 0 }]] };
d.connections['buscar_cnpja']           = { main: [[{ node: 'processar_leads',         type: 'main', index: 0 }]] };
d.connections['processar_leads']        = { main: [[{ node: 'finalizar_busca',         type: 'main', index: 0 }]] };
console.log('OK Cadeia: extrair_params → buscar_fones_existentes → preparar_busca → buscar_cnpja → processar_leads → finalizar_busca');

// ── 7. Corrige finalizar_busca ────────────────────────────────────────────────
var finalizar = d.nodes.find(function(n) { return n.name === 'finalizar_busca'; });
if (finalizar && finalizar.parameters && finalizar.parameters.jsCode) {
  var fbCode = finalizar.parameters.jsCode;
  var wbLine = "var _wb = $('receber_busca_dashboard').first().json; var _bd = _wb.body || _wb;\n";
  if (fbCode.indexOf('receber_busca_dashboard') < 0) fbCode = wbLine + fbCode;
  fbCode = fbCode.split("$('definir_termos').first().json.tipo_loja").join("(_bd.tipo_loja || '')");
  fbCode = fbCode.split("$('definir_termos').first().json.quantidade_pedida").join("parseInt(_bd.quantidade || 10)");
  fbCode = fbCode.split('$("definir_termos").first().json.tipo_loja').join("(_bd.tipo_loja || '')");
  fbCode = fbCode.split('$("definir_termos").first().json.quantidade_pedida').join("parseInt(_bd.quantidade || 10)");
  finalizar.parameters.jsCode = fbCode;
  console.log('OK finalizar_busca: referencias a definir_termos corrigidas');
} else {
  console.warn('AVISO: finalizar_busca nao encontrado ou sem jsCode');
}

// ── 8. edit_fields: garante email e cnpj ─────────────────────────────────────
var editFields = d.nodes.find(function(n) { return n.name === 'edit_fields' || n.name === 'Edit Fields'; });
if (editFields) {
  var assignments =
    (editFields.parameters && editFields.parameters.assignments && editFields.parameters.assignments.assignments) ||
    (editFields.parameters && editFields.parameters.values    && editFields.parameters.values.values)            || [];
  var temEmail = assignments.some(function(a) { return a.name === 'email' || a.key === 'email'; });
  if (!temEmail) {
    assignments.push({ id: 'email-field', name: 'email', value: '={{ $json._email }}', type: 'string' });
    console.log('OK edit_fields: campo email adicionado');
  } else { console.log('OK edit_fields: email ja presente'); }
  var temCnpj = assignments.some(function(a) { return a.name === 'cnpj' || a.key === 'cnpj'; });
  if (!temCnpj) {
    assignments.push({ id: 'cnpj-field', name: 'cnpj', value: '={{ $json._cnpj }}', type: 'string' });
    console.log('OK edit_fields: campo cnpj adicionado');
  } else { console.log('OK edit_fields: cnpj ja presente'); }
}

// ── 9. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 10. Verificacao final ─────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
var checks = [
  ['Nome v15',                        json.includes('Victor Pizza v15')],
  ['extrair_params',                  json.includes('"extrair_params"')],
  ['buscar_fones_existentes',         json.includes('"buscar_fones_existentes"')],
  ['preparar_busca',                  json.includes('"preparar_busca"')],
  ['buscar_cnpja',                    json.includes('"buscar_cnpja"')],
  ['processar_leads',                 json.includes('"processar_leads"')],
  ['api.cnpja.com',                   json.includes('api.cnpja.com')],
  ['emails.ex=true',                  json.includes('emails.ex=true')],
  ['municipio_id no codigo',          json.includes('municipio_id')],
  ['address.municipality.in',         json.includes('address.municipality.in')],
  ['Anti-duplicata (telefonesExist)', json.includes('telefonesExistentes')],
  ['campo bairro em processar_leads', json.includes('address.district')],
  ['SEM buscar_municipios_ibge',      !json.includes('"buscar_municipios_ibge"')],
  ['SEM encontrar_id',                !json.includes('"encontrar_id"')],
  ['SEM $helpers',                    !json.includes('$helpers')],
  ['SEM fetch(',                      !json.includes('fetch(')],
  ['SEM enriquecer_leads ref',        !json.includes("'enriquecer_leads'") && !json.includes('"enriquecer_leads"')],
  ['processar_leads em outros nodes', json.includes("$('processar_leads')")],
];
checks.forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

// ── Funcoes que constroem jsCode ──────────────────────────────────────────────

function buildExtrairParams() {
  var L = [];
  L.push("var webhook           = $('receber_busca_dashboard').first().json;");
  L.push("var body              = webhook.body || webhook;");
  L.push("var estado            = String(body.estado    || 'SP');");
  L.push("var cidade            = String(body.cidade    || '');");
  L.push("var municipio_id      = body.municipio_id ? parseInt(body.municipio_id) : null;");
  L.push("var bairro            = body.bairro ? String(body.bairro) : null;");
  L.push("var tipo_loja         = String(body.tipo_loja || 'Supermercados');");
  L.push("var quantidade_pedida = parseInt(body.quantidade || 10);");
  L.push("var search_id         = String(body.search_id || '');");
  L.push("");
  L.push("var CNAE_MAP = {");
  L.push("  'Supermercados':    '4711302',");
  L.push("  'Hipermercados':    '4711301',");
  L.push("  'Redes de mercado': '4711302,4711301'");
  L.push("};");
  L.push("var cnaes_str = CNAE_MAP[tipo_loja] || '4711302';");
  L.push("var limit     = Math.min(quantidade_pedida * 8, 100);");
  L.push("");
  L.push("var supabase_phones_url = 'https://tuctjosvxdzbfnyvvodc.supabase.co/rest/v1/leads'");
  L.push("  + '?select=telefone'");
  L.push("  + '&tipo_loja=eq.' + encodeURIComponent(tipo_loja)");
  L.push("  + '&limit=1000';");
  L.push("");
  L.push("return [{ json: {");
  L.push("  estado:              estado,");
  L.push("  cidade:              cidade,");
  L.push("  municipio_id:        municipio_id,");
  L.push("  bairro:              bairro,");
  L.push("  tipo_loja:           tipo_loja,");
  L.push("  quantidade_pedida:   quantidade_pedida,");
  L.push("  search_id:           search_id,");
  L.push("  cnaes_str:           cnaes_str,");
  L.push("  limit:               limit,");
  L.push("  supabase_phones_url: supabase_phones_url");
  L.push("} }];");
  return L.join('\n');
}

function buildPreparar() {
  var L = [];
  L.push("// Le params de extrair_params — municipio_id ja vem do frontend (codigo IBGE inteiro)");
  L.push("// Nao e necessario fazer lookup no IBGE em runtime");
  L.push("var params = $('extrair_params').first().json;");
  L.push("");
  L.push("var queryParams = [");
  L.push("  'mainActivity.id.in=' + encodeURIComponent(params.cnaes_str),");
  L.push("  'address.state.in='   + encodeURIComponent(params.estado),");
  L.push("  'status.id.in=2',");
  L.push("  'phones.ex=true',");
  L.push("  'emails.ex=true',");
  L.push("  'limit=' + params.limit");
  L.push("];");
  L.push("");
  L.push("// Filtro por municipio IBGE (mais preciso que por cidade string)");
  L.push("if (params.municipio_id) {");
  L.push("  queryParams.push('address.municipality.in=' + params.municipio_id);");
  L.push("}");
  L.push("");
  L.push("return [{ json: {");
  L.push("  cnpja_url:         'https://api.cnpja.com/office?' + queryParams.join('&'),");
  L.push("  quantidade_pedida: params.quantidade_pedida,");
  L.push("  search_id:         params.search_id,");
  L.push("  estado:            params.estado,");
  L.push("  cidade:            params.cidade,");
  L.push("  municipio_id:      params.municipio_id,");
  L.push("  bairro:            params.bairro,");
  L.push("  tipo_loja:         params.tipo_loja");
  L.push("} }];");
  return L.join('\n');
}

function buildProcessar() {
  var L = [];
  L.push("var BLACKLIST = [");
  L.push("  'mercearia', 'mercadinho', 'padaria', 'mini mercado',");
  L.push("  'hortifruti', 'quitanda', 'frutaria',");
  L.push("  'restaurante', 'lanchonete', 'pizzaria',");
  L.push("  'farmacia', 'farmácia', 'acougue', 'açougue', 'petshop', 'pet shop'");
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
  L.push("// Aceita celular (11 digitos, 3o digito=9) E fixo (10 digitos 2-5)");
  L.push("// Celular antigo de 10 digitos com 3o em 6-9: adiciona o 9");
  L.push("function normalizarTelefone(area, number) {");
  L.push("  if (!area || !number) return null;");
  L.push("  var digits = String(area) + String(number).replace(/\\D/g, '');");
  L.push("  var ddd = parseInt(digits.substring(0, 2));");
  L.push("  if (ddd < 11 || ddd > 99) return null;");
  L.push("  // Celular: 11 digitos, 3o = 9");
  L.push("  if (digits.length === 11 && digits.charAt(2) === '9') return digits;");
  L.push("  // Celular antigo sem o 9: 10 digitos comecando com 6-9 — adiciona 9");
  L.push("  if (digits.length === 10 && '6789'.indexOf(digits.charAt(2)) >= 0) {");
  L.push("    return digits.substring(0, 2) + '9' + digits.substring(2);");
  L.push("  }");
  L.push("  // Fixo: 10 digitos comecando com 2-5");
  L.push("  if (digits.length === 10 && '2345'.indexOf(digits.charAt(2)) >= 0) {");
  L.push("    return digits;");
  L.push("  }");
  L.push("  return null;");
  L.push("}");
  L.push("");
  L.push("// Anti-duplicata: carrega telefones ja no banco");
  L.push("var telefonesExistentes = {};");
  L.push("try {");
  L.push("  var fonesItems = $('buscar_fones_existentes').all();");
  L.push("  for (var fi = 0; fi < fonesItems.length; fi++) {");
  L.push("    var tel = fonesItems[fi].json && fonesItems[fi].json.telefone;");
  L.push("    if (tel) {");
  L.push("      telefonesExistentes[String(tel)] = true;");
  L.push("      telefonesExistentes['55' + String(tel)] = true;");
  L.push("    }");
  L.push("  }");
  L.push("} catch(e) {}");
  L.push("");
  L.push("var preparar          = $('preparar_busca').first().json;");
  L.push("var quantidade_pedida = preparar.quantidade_pedida;");
  L.push("var estado            = preparar.estado;");
  L.push("");
  L.push("var cnpja_resp = $input.first().json;");
  L.push("var records    = cnpja_resp.records || [];");
  L.push("var resultado  = [];");
  L.push("");
  L.push("for (var i = 0; i < records.length; i++) {");
  L.push("  if (resultado.length >= quantidade_pedida * 3) break;");
  L.push("  var reg  = records[i];");
  L.push("  var nome = reg.alias || (reg.company && reg.company.name) || '';");
  L.push("  if (!nome || nomeBloqueado(nome)) continue;");
  L.push("");
  L.push("  // Tenta celular primeiro, depois fixo");
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
  L.push("  var tel = normalizarTelefone(phoneObj.area, phoneObj.number);");
  L.push("  if (!tel) continue;");
  L.push("");
  L.push("  // Anti-duplicata");
  L.push("  if (telefonesExistentes[tel] || telefonesExistentes['55' + tel]) continue;");
  L.push("");
  L.push("  // Email: CORPORATE → PERSONAL → qualquer");
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
  L.push("  if (!emailObj && emails.length > 0) emailObj = emails[0];");
  L.push("");
  L.push("  var addr = [];");
  L.push("  if (reg.address && reg.address.street)   addr.push(reg.address.street);");
  L.push("  if (reg.address && reg.address.number)   addr.push(reg.address.number);");
  L.push("  if (reg.address && reg.address.district) addr.push(reg.address.district);");
  L.push("");
  L.push("  resultado.push({");
  L.push("    title:             nome,");
  L.push("    empresa:           nome,");
  L.push("    city:              (reg.address && reg.address.city) || preparar.cidade,");
  L.push("    cidade:            (reg.address && reg.address.city) || preparar.cidade,");
  L.push("    state:             (reg.address && reg.address.state) || estado,");
  L.push("    address:           addr.join(', '),");
  L.push("    bairro:            (reg.address && reg.address.district) || null,");
  L.push("    cep:               (reg.address && reg.address.zip) || null,");
  L.push("    phone:             tel,");
  L.push("    phoneUnformatted:  '55' + tel,");
  L.push("    _wa_phone:         '55' + tel,");
  L.push("    _email:            emailObj ? emailObj.address : null,");
  L.push("    _cnpj:             reg.taxId,");
  L.push("    _fonte_telefone:   phoneObj.type === 'MOBILE' ? 'receita_federal_mobile' : 'receita_federal_fixo',");
  L.push("    _prioridade:       0,");
  L.push("    quantidade_pedida: quantidade_pedida,");
  L.push("    _meta_bruta:       records.length");
  L.push("  });");
  L.push("}");
  L.push("");
  L.push("if (resultado.length === 0) {");
  L.push("  return [{ json: { _sem_resultado: true, _meta_bruta: records.length, _meta_filtrada: 0 } }];");
  L.push("}");
  L.push("");
  L.push("return resultado.map(function(item) { return { json: item }; });");
  return L.join('\n');
}
