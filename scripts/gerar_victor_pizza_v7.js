const fs = require('fs');
const crypto = require('crypto');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v11.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v7.json';

const CNPJA_KEY    = '1239882e-5005-475f-9be1-41b4123846dd-b7c95f5e-5c9e-4b78-9ef3-4ffdb872a793';
const UAZAPI_URL   = 'https://secondbrain.uazapi.com';
const UAZAPI_TOKEN = '6781e300-9cfe-4d72-9195-aff89f807be2';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v7 - CNPJa via HTTP Request';
console.log('✓ Nome atualizado');

// ── 1. Transforma enriquecer_leads → preparar_busca (só monta URL, sem HTTP) ──
var enriquece = d.nodes.find(function(n) { return n.name === 'enriquecer_leads'; });
if (!enriquece) { console.error('✗ ERRO: no enriquecer_leads nao encontrado'); process.exit(1); }

var posBase = Array.isArray(enriquece.position) ? enriquece.position : [600, 300];
enriquece.name = 'preparar_busca';
enriquece.type = 'n8n-nodes-base.code';
enriquece.typeVersion = 2;
enriquece.parameters = { mode: 'runOnceForAllItems', jsCode: buildPreparar() };
console.log('✓ preparar_busca configurado (ex-enriquecer_leads) — posicao: ' + posBase);

// ── 2. Atualiza referencias nas conexoes enriquecer_leads → preparar_busca ────
Object.keys(d.connections).forEach(function(nodeName) {
  var conn = d.connections[nodeName];
  if (!conn || !conn.main) return;
  conn.main.forEach(function(outputs) {
    if (!outputs) return;
    outputs.forEach(function(c) {
      if (c && c.node === 'enriquecer_leads') c.node = 'preparar_busca';
    });
  });
});
if (d.connections['enriquecer_leads']) {
  d.connections['preparar_busca'] = d.connections['enriquecer_leads'];
  delete d.connections['enriquecer_leads'];
}
console.log('✓ Referencias enriquecer_leads → preparar_busca atualizadas');

// ── 3. Bypassa definir_termos/Apify: conecta reserva_suficiente → preparar_busca
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
      d.connections[nomeCon].main[oi] = [{ node: 'preparar_busca', type: 'main', index: 0 }];
      console.log('✓ Reconectado: ' + nomeCon + '[' + oi + '] → preparar_busca (bypassa Apify)');
      reconectado = true;
      break;
    }
  }
  if (reconectado) break;
}
if (!reconectado) console.warn('⚠ Reconexao automatica nao encontrou o caminho — verifique manualmente');

// ── 4. Adiciona novos nos ─────────────────────────────────────────────────────
var px = posBase[0];
var py = posBase[1];

// buscar_cnpja: HTTP Request GET
var nodeBuscarCnpja = {
  id: crypto.randomUUID(),
  name: 'buscar_cnpja',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.1,
  position: [px + 220, py],
  parameters: {
    method: 'GET',
    url: '={{ $json.cnpja_url }}',
    authentication: 'none',
    sendQuery: false,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Authorization', value: CNPJA_KEY }
      ]
    },
    sendBody: false,
    options: {}
  }
};
d.nodes.push(nodeBuscarCnpja);
console.log('✓ buscar_cnpja adicionado');

// processar_leads: Code (roda uma vez, filtra e normaliza todos os registros)
var nodeProcessar = {
  id: crypto.randomUUID(),
  name: 'processar_leads',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [px + 440, py],
  parameters: {
    mode: 'runOnceForAllItems',
    jsCode: buildProcessar()
  }
};
d.nodes.push(nodeProcessar);
console.log('✓ processar_leads adicionado');

// verificar_whatsapp: HTTP Request POST (roda para cada lead)
var nodeVerificarWA = {
  id: crypto.randomUUID(),
  name: 'verificar_whatsapp',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.1,
  position: [px + 660, py],
  onError: 'continueRegularOutput',
  parameters: {
    method: 'POST',
    url: UAZAPI_URL + '/contact/check-whatsapp',
    authentication: 'none',
    sendQuery: false,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'token', value: UAZAPI_TOKEN },
        { name: 'Content-Type', value: 'application/json' }
      ]
    },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: '={{ JSON.stringify({ phone: $json._wa_phone }) }}',
    options: {}
  }
};
d.nodes.push(nodeVerificarWA);
console.log('✓ verificar_whatsapp adicionado');

// juntar_e_filtrar: Code (roda para cada item, combina resultado WA com dados do lead)
var nodeJuntar = {
  id: crypto.randomUUID(),
  name: 'juntar_e_filtrar',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [px + 880, py],
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: buildJuntar()
  }
};
d.nodes.push(nodeJuntar);
console.log('✓ juntar_e_filtrar adicionado');

// ── 5. Cabeamento dos nos ─────────────────────────────────────────────────────
// preparar_busca → buscar_cnpja → processar_leads → verificar_whatsapp → juntar_e_filtrar → finalizar_busca
d.connections['preparar_busca'] = {
  main: [[{ node: 'buscar_cnpja', type: 'main', index: 0 }]]
};
d.connections['buscar_cnpja'] = {
  main: [[{ node: 'processar_leads', type: 'main', index: 0 }]]
};
d.connections['processar_leads'] = {
  main: [[{ node: 'verificar_whatsapp', type: 'main', index: 0 }]]
};
d.connections['verificar_whatsapp'] = {
  main: [[{ node: 'juntar_e_filtrar', type: 'main', index: 0 }]]
};
d.connections['juntar_e_filtrar'] = {
  main: [[{ node: 'finalizar_busca', type: 'main', index: 0 }]]
};
console.log('✓ Cadeia de conexoes configurada');

// ── 6. Corrige finalizar_busca (remove referencias a definir_termos) ──────────
var finalizar = d.nodes.find(function(n) { return n.name === 'finalizar_busca'; });
if (finalizar && finalizar.parameters && finalizar.parameters.jsCode) {
  var fbCode = finalizar.parameters.jsCode;
  var wbLine = "var _wb = $('receber_busca_dashboard').first().json; var _bd = _wb.body || _wb;\n";
  if (fbCode.indexOf('receber_busca_dashboard') < 0) {
    fbCode = wbLine + fbCode;
  }
  fbCode = fbCode.split("$('definir_termos').first().json.tipo_loja").join("(_bd.tipo_loja || '')");
  fbCode = fbCode.split("$('definir_termos').first().json.quantidade_pedida").join("parseInt(_bd.quantidade || 10)");
  fbCode = fbCode.split('$("definir_termos").first().json.tipo_loja').join("(_bd.tipo_loja || '')");
  fbCode = fbCode.split('$("definir_termos").first().json.quantidade_pedida').join("parseInt(_bd.quantidade || 10)");
  finalizar.parameters.jsCode = fbCode;
  console.log('✓ finalizar_busca: referencias a definir_termos corrigidas');
} else {
  console.warn('⚠ finalizar_busca nao encontrado ou sem jsCode');
}

// ── 7. edit_fields: garante campo email ───────────────────────────────────────
var editFields = d.nodes.find(function(n) { return n.name === 'edit_fields' || n.name === 'Edit Fields'; });
if (editFields) {
  var assignments =
    (editFields.parameters && editFields.parameters.assignments && editFields.parameters.assignments.assignments) ||
    (editFields.parameters && editFields.parameters.values    && editFields.parameters.values.values)            || [];
  var temEmail = assignments.some(function(a) { return a.name === 'email' || a.key === 'email'; });
  if (!temEmail) {
    assignments.push({ id: 'email-field', name: 'email', value: '={{ $json._email }}', type: 'string' });
    console.log('✓ edit_fields: campo email adicionado');
  } else {
    console.log('✓ edit_fields: email ja presente');
  }
}

// ── 8. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo: ' + OUTPUT);

// ── 9. Verificacao final ──────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
var checks = [
  ['Nome v7',              json.includes('Victor Pizza v7')],
  ['preparar_busca',       json.includes('"preparar_busca"')],
  ['buscar_cnpja',         json.includes('"buscar_cnpja"')],
  ['processar_leads',      json.includes('"processar_leads"')],
  ['verificar_whatsapp',   json.includes('"verificar_whatsapp"')],
  ['juntar_e_filtrar',     json.includes('"juntar_e_filtrar"')],
  ['api.cnpja.com',        json.includes('api.cnpja.com')],
  ['check-whatsapp',       json.includes('check-whatsapp')],
  ['Sem $helpers',         !json.includes('$helpers')],
  ['Sem fetch(',           !json.includes('fetch(')],
  ['Sem this.helpers',     !json.includes('this.helpers')],
  ['Sem definir_termos',   !json.includes("$('definir_termos')")],
  ['Campo _email',         json.includes('_email')],
  ['Campo _cnpj',          json.includes('_cnpj')],
];
checks.forEach(function(c) { console.log((c[1] ? '✓' : '✗') + ' ' + c[0]); });

// ── Funcoes que constroem jsCode dos nos ──────────────────────────────────────

function buildPreparar() {
  var L = [];
  L.push("// preparar_busca — le webhook, monta URL da CNPJa (sem HTTP aqui)");
  L.push("var webhook           = $('receber_busca_dashboard').first().json;");
  L.push("var body              = webhook.body || webhook;");
  L.push("var estado            = String(body.estado    || 'SP');");
  L.push("var cidade            = String(body.cidade    || '');");
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
  L.push("var limit = Math.min(quantidade_pedida * 8, 100);");
  L.push("");
  L.push("var params = [");
  L.push("  'mainActivity.id.in=' + encodeURIComponent(cnaes_str),");
  L.push("  'address.state.in='   + encodeURIComponent(estado),");
  L.push("  'status.id.in=2',");
  L.push("  'phones.ex=true',");
  L.push("  'limit=' + limit");
  L.push("];");
  L.push("");
  L.push("return [{ json: {");
  L.push("  cnpja_url:         'https://api.cnpja.com/office?' + params.join('&'),");
  L.push("  quantidade_pedida: quantidade_pedida,");
  L.push("  search_id:         search_id,");
  L.push("  estado:            estado,");
  L.push("  cidade:            cidade,");
  L.push("  tipo_loja:         tipo_loja");
  L.push("} }];");
  return L.join('\n');
}

function buildProcessar() {
  var L = [];
  L.push("// processar_leads — filtra e normaliza registros retornados pela CNPJa");
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
  L.push("var preparar          = $('preparar_busca').first().json;");
  L.push("var quantidade_pedida = preparar.quantidade_pedida;");
  L.push("var cidade            = preparar.cidade;");
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
  L.push("");
  L.push("  var addr = [];");
  L.push("  if (reg.address && reg.address.street)   addr.push(reg.address.street);");
  L.push("  if (reg.address && reg.address.number)   addr.push(reg.address.number);");
  L.push("  if (reg.address && reg.address.district) addr.push(reg.address.district);");
  L.push("");
  L.push("  resultado.push({");
  L.push("    title:             nome,");
  L.push("    empresa:           nome,");
  L.push("    city:              (reg.address && reg.address.city)  || cidade,");
  L.push("    cidade:            (reg.address && reg.address.city)  || cidade,");
  L.push("    state:             (reg.address && reg.address.state) || estado,");
  L.push("    address:           addr.join(', '),");
  L.push("    phone:             cel,");
  L.push("    phoneUnformatted:  '55' + cel,");
  L.push("    _wa_phone:         '55' + cel,");
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

function buildJuntar() {
  var L = [];
  L.push("// juntar_e_filtrar — une resultado WA com dados do lead (roda para cada item)");
  L.push("// $input.item = resposta da UazAPI ({ exists: true/false })");
  L.push("// $('processar_leads').item = lead original (pareado pelo n8n)");
  L.push("var waResp = $input.item.json;");
  L.push("var lead   = $('processar_leads').item.json;");
  L.push("");
  L.push("// Passa sem_resultado direto para finalizar_busca tratar");
  L.push("if (lead._sem_resultado) {");
  L.push("  return [{ json: lead }];");
  L.push("}");
  L.push("");
  L.push("// Descarta lead sem WhatsApp");
  L.push("if (!waResp.exists) {");
  L.push("  return [];");
  L.push("}");
  L.push("");
  L.push("return [{ json: Object.assign({}, lead, { _wa_verificado: true }) }];");
  return L.join('\n');
}
