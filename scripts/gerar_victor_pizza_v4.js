const fs = require('fs');

// v4: substitui Apify + OpenAI pelo CNPJá (Receita Federal)
// Pipeline novo: CNPJá (CNAE + estado + cidade) → email incluso → UazAPI WhatsApp check
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v11.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v4.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── 1. Nome ──────────────────────────────────────────────────────────────────
d.name = 'Fluxo Victor Pizza v4 — CNPJá (Receita Federal) substitui Apify + OpenAI';
console.log('✓ Nome atualizado');

// ─── 2. enriquecer_leads: CNPJá como fonte principal ─────────────────────────
const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado'); process.exit(1); }

enriquece.parameters.jsCode = `// v4-victor-pizza — CNPJá como fonte (Receita Federal)
// Substitui Apify + OpenAI. Pipeline: CNAE + estado + cidade → leads com email + telefone → UazAPI

const CNPJA_KEY    = 'SUA_CHAVE_CNPJA_AQUI';
const UAZAPI_URL   = 'https://secondbrain.uazapi.com';
const UAZAPI_TOKEN = '6781e300-9cfe-4d72-9195-aff89f807be2';

// Lê dados direto do webhook (ignora input do Apify)
const webhook = $('receber_busca_dashboard').first().json;
const body = webhook.body || webhook;
const estado       = body.estado      || 'SP';
const cidade       = body.cidade      || '';
const tipo_loja    = body.tipo_loja   || 'Supermercados';
const quantidade_pedida = parseInt(body.quantidade || 10);
const search_id    = body.search_id   || '';

// Mapeia tipo_loja → CNAE numérico (IBGE)
const CNAE_MAP = {
  'Supermercados':    [4711302],
  'Hipermercados':    [4711301],
  'Redes de mercado': [4711302, 4711301],
};
const cnaes = CNAE_MAP[tipo_loja] || [4711302];

// Blacklist nativa (passada para API — evita custo com termos errados)
const BLACKLIST_API = [
  'mercearia', 'mercadinho', 'padaria', 'mini mercado',
  'hortifruti', 'quitanda', 'frutaria',
  'restaurante', 'lanchonete', 'pizzaria',
  'farmacia', 'farmácia', 'acougue', 'açougue',
  'petshop', 'pet shop',
].join(',');

// ── Funções ───────────────────────────────────────────────────────────────────

function normalizarCelular(area, number) {
  if (!area || !number) return null;
  let d = String(area) + String(number).replace(/\\\\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.substring(2);
  if (d.length === 10) {
    const t = d.charAt(2);
    if (['6','7','8','9'].includes(t)) d = d.substring(0,2) + '9' + d.substring(2);
    else return null;
  }
  if (d.length !== 11) return null;
  if (d.charAt(2) !== '9') return null;
  const ddd = parseInt(d.substring(0,2));
  if (ddd < 11 || ddd > 99) return null;
  return d;
}

async function existeNoWhatsApp(cel) {
  const phone = '55' + cel;
  try {
    const r = await $helpers.httpRequest({
      method: 'POST',
      url: \`\${UAZAPI_URL}/contact/check-whatsapp\`,
      headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return r.exists === true;
  } catch(e) { return true; }
}

// Busca código IBGE da cidade para filtro preciso
async function buscarCodigoIBGE(estado, cidade) {
  if (!cidade) return null;
  try {
    const municipios = await $helpers.httpRequest({
      method: 'GET',
      url: \`https://servicodados.ibge.gov.br/api/v1/localidades/estados/\${estado}/municipios\`,
    });
    const normalizar = s => s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    const match = municipios.find(m => normalizar(m.nome) === normalizar(cidade));
    return match?.id || null;
  } catch(e) { return null; }
}

// Busca leads no CNPJá
async function buscarCNPJa(estado, municipioId, cnaes, quantidade) {
async function buscarCNPJa(estado, municipioId, cnaes, quantidade) {
  const parts = [];
  parts.push('mainActivity.id.in=' + encodeURIComponent(cnaes.join(',')));
  parts.push('address.state.in=' + encodeURIComponent(estado));
  if (municipioId) parts.push('address.municipality.in=' + encodeURIComponent(String(municipioId)));
  parts.push('status.id.in=2');
  parts.push('phones.ex=true');
  parts.push('names.nin=' + encodeURIComponent(BLACKLIST_API));
  parts.push('limit=' + String(Math.min(quantidade * 5, 100)));

  const r = await $helpers.httpRequest({
    method: 'GET',
    url: \`https://api.cnpja.com/office?\${parts.join('&')}\`,
  });
  return r.records || [];
}

// ── Pipeline principal ────────────────────────────────────────────────────────

const municipioId = await buscarCodigoIBGE(estado, cidade);
const registros = await buscarCNPJa(estado, municipioId, cnaes, quantidade_pedida);

const validos = [];

for (const reg of registros) {
  const nome = reg.alias || reg.company?.name || '';
  if (!nome) continue;

  // Email: corporativo > pessoal (ignora contabilidade)
  const emails = reg.emails || [];
  const email = (
    emails.find(e => e.ownership === 'CORPORATE') ||
    emails.find(e => e.ownership === 'PERSONAL')
  )?.address || null;

  // Telefone: móvel preferencial > fixo
  const phones = reg.phones || [];
  const phone = phones.find(p => p.type === 'MOBILE') || phones.find(p => p.type === 'LANDLINE');
  if (!phone) continue;

  const cel = normalizarCelular(phone.area, phone.number);
  if (!cel) continue;

  const temWhatsApp = await existeNoWhatsApp(cel);
  if (!temWhatsApp) continue;

  validos.push({
    title:            nome,
    empresa:          nome,
    city:             reg.address?.city  || cidade,
    cidade:           reg.address?.city  || cidade,
    state:            reg.address?.state || estado,
    address:          [reg.address?.street, reg.address?.number, reg.address?.district].filter(Boolean).join(', '),
    phone:            cel,
    phoneUnformatted: '55' + cel,
    _email:           email,
    _cnpj:            reg.taxId,
    _fonte_telefone:  phone.type === 'MOBILE' ? 'receita_federal_mobile' : 'receita_federal_fixo',
    _prioridade:      0,
    quantidade_pedida,
  });

  // Buffer 2x (metade vai para leads, metade para reserva)
  if (validos.length >= quantidade_pedida * 2) break;
}

if (validos.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: registros.length, _meta_filtrada: 0 } }];
}

return validos.map((item, idx) => ({
  json: {
    ...item,
    _meta_bruta:    idx === 0 ? registros.length : undefined,
    _meta_filtrada: idx === 0 ? validos.length   : undefined,
  }
}));
`;

console.log('✓ enriquecer_leads v4: CNPJá (Receita Federal) configurado');

// ─── 3. Reconectar verificar_reserva → enriquecer_leads (pula Apify) ─────────
// Encontra o nó que faz o roteamento FALSE (sem reserva suficiente)
const rotaNomes = ['verificar_reserva', 'reserva_suficiente', 'Switch', 'IF'];
let reconectado = false;

for (const nomeNo of rotaNomes) {
  const conn = d.connections[nomeNo];
  if (!conn?.main) continue;

  // Procura o output que vai para definir_termos ou para Apify
  for (let outputIdx = 0; outputIdx < conn.main.length; outputIdx++) {
    const outputs = conn.main[outputIdx];
    if (!outputs) continue;

    const temApify = outputs.some(c =>
      c.node && (
        c.node.toLowerCase().includes('definir') ||
        c.node.toLowerCase().includes('apify') ||
        c.node.toLowerCase().includes('actor') ||
        c.node.toLowerCase().includes('busca')
      )
    );

    if (temApify) {
      const original = outputs.map(c => c.node).join(', ');
      d.connections[nomeNo].main[outputIdx] = [
        { node: 'enriquecer_leads', type: 'main', index: 0 }
      ];
      console.log(`✓ Reconectado: ${nomeNo}[${outputIdx}] → enriquecer_leads (era: ${original})`);
      reconectado = true;
      break;
    }
  }
  if (reconectado) break;
}

if (!reconectado) {
  console.warn('⚠ Reconexão automática não encontrou o caminho. Ajuste manualmente no n8n:');
  console.warn('  → Desconecte o nó de rota FALSE do "verificar_reserva" de "definir_termos"');
  console.warn('  → Conecte direto para "enriquecer_leads"');
}

// ─── 4. edit_fields: garante campo email ──────────────────────────────────────
const editFields = d.nodes.find(n => n.name === 'edit_fields' || n.name === 'Edit Fields');
if (editFields) {
  const assignments = editFields.parameters?.assignments?.assignments || editFields.parameters?.values?.values || [];
  const temEmail = assignments.some(a => a.name === 'email' || a.key === 'email');
  if (!temEmail) {
    assignments.push({ id: 'email-field', name: 'email', value: '={{ $json._email }}', type: 'string' });
    console.log('✓ edit_fields: campo email adicionado');
  } else {
    console.log('✓ edit_fields: email já presente');
  }
}

// ─── 5. Salvar ────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── 6. Verificação ───────────────────────────────────────────────────────────
const json = JSON.stringify(d);
console.log('\n=== VERIFICAÇÃO ===');
console.log('Nome v4:              ', json.includes('Victor Pizza v4') ? '✓' : '✗');
console.log('CNPJá endpoint:       ', json.includes('api.cnpja.com') ? '✓' : '✗');
console.log('Blacklist nativa:     ', json.includes('BLACKLIST_API') ? '✓' : '✗');
console.log('IBGE cidade lookup:   ', json.includes('servicodados.ibge') ? '✓' : '✗');
console.log('WhatsApp check:       ', json.includes('check-whatsapp') ? '✓' : '✗');
console.log('Sem OpenAI:           ', !json.includes('openai.com') ? '✓' : '✗ (ainda tem OpenAI)');
console.log('Sem Apify no código:  ', !json.includes('apify.com') ? '✓' : '✗ (ainda tem Apify)');
console.log('Campo email:          ', json.includes('_email') ? '✓' : '✗');
