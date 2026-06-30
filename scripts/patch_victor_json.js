const fs = require('fs');

const json = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_victor_selfe_v2_original.json', 'utf8'));

// ── FIX 1: montar_harvestapi ──────────────────────────────────────────────────
// - Remove currentJobTitleFilter (match exato, muito restritivo)
// - Usa OR entre cargos no searchQuery
// - Passa cargos[] para processar_leads usar no filtro de cargo
const CODE_MONTAR_HARVESTAPI = `var empresa = $('verificar_empresa').first().json;

var cargos  = empresa.cargos  || [];
var regioes = empresa.regioes || ['Brasil'];
var metaDia = empresa.max_leads_dia   || 14;
var buffer  = empresa.buffer_multiplo || 2.5;
// Mínimo 50 perfis para ter volume suficiente no teste
var maxItems = Math.max(Math.ceil(metaDia * buffer), 50);

var ESTADO_MAP = {
  'Brasil': 'Brazil', 'Nacional': 'Brazil',
  'SP': 'Sao Paulo, Brazil', 'São Paulo': 'Sao Paulo, Brazil',
  'RJ': 'Rio de Janeiro, Brazil',
  'RS': 'Rio Grande do Sul, Brazil',
  'PR': 'Parana, Brazil',
  'SC': 'Santa Catarina, Brazil',
  'MG': 'Minas Gerais, Brazil',
  'BA': 'Bahia, Brazil',
  'SE': 'Sergipe, Brazil',
  'Santo André': 'Santo Andre, Sao Paulo, Brazil',
  'São Bernardo do Campo': 'Sao Bernardo do Campo, Sao Paulo, Brazil',
  'São Caetano do Sul': 'Sao Caetano do Sul, Sao Paulo, Brazil',
  'Diadema': 'Diadema, Sao Paulo, Brazil',
  'Mauá': 'Maua, Sao Paulo, Brazil',
  'Ribeirão Pires': 'Ribeirao Pires, Sao Paulo, Brazil',
  'Rio Grande da Serra': 'Rio Grande da Serra, Sao Paulo, Brazil'
};

var locationsFilter = regioes.map(function(r) { return ESTADO_MAP[r] || r; });

// Mapeamento genérico: min_funcionarios → faixas do LinkedIn
// Inclui todas as faixas onde o mínimo da faixa >= min_funcionarios
// Ex: min=1000 → ['1001-5000','5001-10000','10001+']  (1001>=1000 ✓)
//     min=500  → ['501-1000','1001-5000','5001-10000','10001+']
//     null     → sem filtro (todas as empresas)
var ALL_BANDS = [
  { min: 1,     value: '1-10' },
  { min: 11,    value: '11-50' },
  { min: 51,    value: '51-200' },
  { min: 201,   value: '201-500' },
  { min: 501,   value: '501-1000' },
  { min: 1001,  value: '1001-5000' },
  { min: 5001,  value: '5001-10000' },
  { min: 10001, value: '10001+' }
];

var companyHeadcountFilter = [];
if (empresa.min_funcionarios) {
  companyHeadcountFilter = ALL_BANDS
    .filter(function(b) { return b.min >= empresa.min_funcionarios; })
    .map(function(b) { return b.value; });
}

console.log('Empresa:', empresa.nome, '| Cargos:', cargos, '| Regioes:', locationsFilter, '| Max:', maxItems, '| Headcount:', companyHeadcountFilter);

if (!cargos.length) {
  return [{ json: { _erro: 'sem_cargos', empresa_nome: empresa.nome } }];
}

var harvestapiInput = {
  profileScraperMode: 'Full + email search',
  searchQuery:        cargos.join(' OR '),
  locationsFilter:    locationsFilter,
  maxItems:           maxItems,
  proxyConfiguration: { useApifyProxy: true }
};

if (companyHeadcountFilter.length) {
  harvestapiInput.companyHeadcountFilter = companyHeadcountFilter;
}

return [{ json: {
  empresa_id:        empresa.id,
  empresa_nome:      empresa.nome,
  template_email:    empresa.template_email,
  cargos:            cargos,
  max_leads_dia:     metaDia,
  _harvestapi_input: harvestapiInput,
  _max_items:        maxItems,
  _meta_dia:         metaDia
} }];`;

// ── FIX 2: processar_leads ────────────────────────────────────────────────────
// Claudinho: dois filtros obrigatórios:
//   1. CARGO: lead só passa se o cargo bate com o que a empresa do Victor compra
//   2. SMTP:  lead só passa se o HarvestAPI confirmou que a caixa existe
//   Sem IA inventando email. Sem domain validation (emails são dos clientes do Victor).
const CODE_PROCESSAR_LEADS = `var DOMINIOS_PESSOAIS = [
  'gmail.com','hotmail.com','yahoo.com','outlook.com',
  'uol.com.br','bol.com.br','terra.com.br','ig.com.br',
  'yahoo.com.br','live.com','msn.com','icloud.com',
  'me.com','globomail.com','r7.com','oi.com.br'
];

// Lê contexto da empresa (cargos esperados, empresa_id, etc.)
var meta = {};
try { meta = $('montar_harvestapi').first().json; } catch(e) {}

var cargosEsperados = (meta.cargos || []);

// Palavras-chave extraídas dos cargos (>4 chars para ignorar "de", "do", "da")
var termosValidos = [];
cargosEsperados.forEach(function(c) {
  c.toLowerCase().split(' ').forEach(function(p) {
    if (p.length > 4 && termosValidos.indexOf(p) === -1) termosValidos.push(p);
  });
});

console.log('Termos de cargo validos:', termosValidos);

// ── FILTRO 1: CARGO ──────────────────────────────────────────────────────────
// Verifica se o cargo do lead contém ao menos uma palavra-chave dos cargos esperados
// Ex: "Comprador de Congelados" → ["comprador","congelados","pereciveis","gerente","compras","diretor"]
function cargoValido(cargoLead) {
  if (!termosValidos.length) return true; // sem restrição se empresa sem cargos
  if (!cargoLead) return false;           // sem cargo = não passa
  var lower = cargoLead.toLowerCase();
  return termosValidos.some(function(t) { return lower.indexOf(t) !== -1; });
}

// ── FILTRO 2: SMTP ───────────────────────────────────────────────────────────
// HarvestAPI retorna campo de verificação SMTP. Status inválidos = rejeitado.
// Se campo não existir: aceita (modo "Full + email search" já faz SMTP por default)
var STATUS_INVALIDOS = ['invalid', 'bounce', 'catch_all', 'unknown', 'disposable', 'false'];

function smtpValido(perfil) {
  var status = perfil.emailVerified || perfil.emailStatus || perfil.smtpValid ||
    perfil.verificationStatus || perfil.email_verified || null;

  if (status === null || status === undefined) return true; // campo ausente = aceita
  if (typeof status === 'boolean') return status;
  var s = String(status).toLowerCase();
  return STATUS_INVALIDOS.indexOf(s) === -1;
}

function extrairEmail(emailField) {
  if (!emailField) return null;
  if (typeof emailField === 'string') return emailField;
  if (typeof emailField === 'object' && !Array.isArray(emailField)) {
    return emailField.email || emailField.address || emailField.value || null;
  }
  if (Array.isArray(emailField)) {
    for (var i = 0; i < emailField.length; i++) {
      var v = extrairEmail(emailField[i]);
      if (v) return v;
    }
  }
  return null;
}

var perfis = $input.all();
var resultado = [];
var desc = { sem_email: 0, pessoal: 0, cargo_invalido: 0, smtp_invalido: 0 };

for (var i = 0; i < perfis.length; i++) {
  var j = perfis[i].json;

  // Email
  var email = extrairEmail(j.email || j.workEmail || j.personalEmail || j.emails || null);
  if (!email) { desc.sem_email++; continue; }
  email = email.toLowerCase().trim();

  var dominio = email.split('@')[1] || '';
  if (DOMINIOS_PESSOAIS.indexOf(dominio) !== -1) { desc.pessoal++; continue; }

  // FILTRO 1: Cargo
  var cargo = j.jobTitle || j.headline || j.title || '';
  if (!cargoValido(cargo)) {
    desc.cargo_invalido++;
    console.log('Cargo rejeitado:', cargo, '| email:', email);
    continue;
  }

  // FILTRO 2: SMTP
  if (!smtpValido(j)) {
    desc.smtp_invalido++;
    console.log('SMTP invalido:', email, '| status:', j.emailStatus || j.emailVerified);
    continue;
  }

  var nome        = ((j.firstName || '') + ' ' + (j.lastName || '')).trim() || j.name || '';
  var empresa_lead = j.companyName || j.currentCompany || '';

  resultado.push({ json: {
    email:             email,
    nome:              nome,
    cargo:             cargo,
    empresa_nome_lead: empresa_lead,
    empresa_id:        meta.empresa_id,
    empresa_nome:      meta.empresa_nome,
    template_email:    meta.template_email,
    linkedin_url:      j.linkedinUrl || j.url || '',
    _dominio_email:    dominio
  }});
}

console.log(
  'Resultado:', resultado.length, 'leads validos /',
  perfis.length, 'perfis |',
  'sem_email:', desc.sem_email,
  '| pessoal:', desc.pessoal,
  '| cargo_invalido:', desc.cargo_invalido,
  '| smtp_invalido:', desc.smtp_invalido
);

if (resultado.length === 0) {
  return [{ json: { _sem_resultados: true, empresa_nome: meta.empresa_nome, _desc: desc } }];
}
return resultado;`;

// Aplica patches
json.nodes = json.nodes.map(function(node) {
  if (node.name === 'montar_harvestapi') {
    node.parameters.jsCode = CODE_MONTAR_HARVESTAPI;
    console.log('✓ Patched: montar_harvestapi');
  }
  if (node.name === 'processar_leads') {
    node.parameters.jsCode = CODE_PROCESSAR_LEADS;
    console.log('✓ Patched: processar_leads');
  }
  return node;
});

const output = 'C:/Users/guima/Downloads/Fluxo_victor_selfe_v2.json';
fs.writeFileSync(output, JSON.stringify(json, null, 2));
console.log('✓ Salvo:', output);
