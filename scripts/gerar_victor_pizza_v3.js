const fs = require('fs');

// Base: fluxo oriental v11
// Output: fluxo Victor Pizza v3 — blacklist expandida + CNPJ (BrasilAPI) + validação SMTP (mailcheck.ai)
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v11.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v3.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── 1. Nome do fluxo ─────────────────────────────────────────────────────────
d.name = 'Fluxo Victor Pizza v3 — supermercados SP/PR/RS/SC + CNPJ + validação email + blacklist expandida';
console.log('✓ Nome atualizado');

// ─── 2. enriquecer_leads ──────────────────────────────────────────────────────
const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado'); process.exit(1); }

enriquece.parameters.jsCode = `// v3-victor-pizza — enriquecer_leads com CNPJ (BrasilAPI) + validação SMTP (mailcheck.ai) + blacklist expandida
// Waterfall: IA busca fone+email+CNPJ → BrasilAPI confirma email pelo CNPJ → mailcheck.ai valida

const OPENAI_KEY   = 'SUA_CHAVE_OPENAI_AQUI';
const UAZAPI_URL   = 'https://secondbrain.uazapi.com';
const UAZAPI_TOKEN = '6781e300-9cfe-4d72-9195-aff89f807be2';

const primeiroItem = $input.first().json;
const quantidade_pedida = parseInt(primeiroItem.quantidade_pedida || primeiroItem.quantidade || 10);

// ── Funções utilitárias ────────────────────────────────────────────────────────

function normalizarCelular(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\\\\D/g, '');
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

async function existeNoWhatsApp(cel11digitos) {
  const phone = '55' + cel11digitos;
  try {
    const r = await $helpers.httpRequest({
      method: 'POST',
      url: \`\${UAZAPI_URL}/contact/check-whatsapp\`,
      headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return r.exists === true;
  } catch(e) {
    return true; // fail open
  }
}

async function chamarIA(prompt) {
  try {
    const r = await $helpers.httpRequest({
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Authorization': \`Bearer \${OPENAI_KEY}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        tool_choice: 'required',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
      }),
    });
    return (r.choices?.[0]?.message?.content || '').trim();
  } catch(e) { return ''; }
}

async function buscarEmailCNPJ(cnpj) {
  if (!cnpj) return null;
  const cnpjLimpo = cnpj.replace(/\\\\D/g, '');
  if (cnpjLimpo.length !== 14) return null;
  try {
    const r = await $helpers.httpRequest({
      method: 'GET',
      url: \`https://brasilapi.com.br/api/cnpj/v1/\${cnpjLimpo}\`,
    });
    if (r.email && r.email.includes('@')) {
      return r.email.trim().toLowerCase();
    }
    return null;
  } catch(e) { return null; }
}

async function validarEmail(email) {
  if (!email || !email.includes('@')) return false;
  try {
    const r = await $helpers.httpRequest({
      method: 'GET',
      url: \`https://api.mailcheck.ai/email/\${encodeURIComponent(email)}\`,
    });
    return r.mx === true && r.disposable === false && r.block === false;
  } catch(e) {
    return true; // fail open se API estiver fora
  }
}

async function buscarContatos(nome, cidade, end, telApify) {
  const temTel = telApify && normalizarCelular(telApify);

  const prompt = temTel
    ? \`O negócio "\${nome}" está em \${end ? end + ', ' : ''}\${cidade}, Brasil. Número cadastrado: \${telApify}.

TAREFA:
1. Esse número é WhatsApp PESSOAL do comprador/dono ou é da loja?
   Se pessoal → TELEFONE:\${telApify.replace(/\\\\D/g,'')}
   Se da loja → procure pessoal e responda: TELEFONE:[número]
   Se não encontrar → TELEFONE:não encontrado
2. Email de contato da empresa ou do comprador/gerente de compras:
   Se encontrar → EMAIL:[endereço@email.com]
   Se não → EMAIL:não encontrado
3. CNPJ da empresa (busque no Google):
   Se encontrar → CNPJ:[XX.XXX.XXX/XXXX-XX]
   Se não → CNPJ:não encontrado\`
    : \`Para "\${nome}" em \${cidade}, Brasil:
1. WhatsApp PESSOAL do dono/comprador (não número da loja):
   TELEFONE:[número com DDD] ou TELEFONE:não encontrado
2. Email de contato da empresa ou do comprador:
   EMAIL:[endereço@email.com] ou EMAIL:não encontrado
3. CNPJ da empresa (busque no Google):
   CNPJ:[XX.XXX.XXX/XXXX-XX] ou CNPJ:não encontrado\`;

  const res = await chamarIA(prompt);

  let telefone = null;
  let email = null;
  let cnpj = null;

  const tMatch = res.match(/TELEFONE[:\\\\s]+([^\\\\n]+)/i);
  if (tMatch && !tMatch[1].toLowerCase().includes('não') && !tMatch[1].toLowerCase().includes('nao')) {
    telefone = normalizarCelular(tMatch[1]);
  }

  const eMatch = res.match(/EMAIL[:\\\\s]+([^\\\\n]+)/i);
  if (eMatch && eMatch[1].includes('@')) {
    const emailIA = eMatch[1].trim().toLowerCase();
    if (!emailIA.includes('não') && !emailIA.includes('nao')) {
      email = emailIA;
    }
  }

  const cMatch = res.match(/CNPJ[:\\\\s]+([0-9]{2}[.\\\\s]?[0-9]{3}[.\\\\s]?[0-9]{3}[\\\\/\\\\s]?[0-9]{4}[-\\\\s]?[0-9]{2})/i);
  if (cMatch) {
    cnpj = cMatch[1].trim();
  }

  if (!email && cnpj) {
    const emailCNPJ = await buscarEmailCNPJ(cnpj);
    if (emailCNPJ) email = emailCNPJ;
  }

  if (email) {
    const valido = await validarEmail(email);
    if (!valido) email = null;
  }

  return { telefone, email, cnpj };
}

const blacklist = [
  // Mercearias e similares (pequenos, sem volume)
  'mercearia', 'mercadinho', 'padaria', 'mini mercado', 'mini-mercado',

  // Alimentação fora do lar (não compram pizza pra revenda)
  'restaurante', 'churrasco', 'espeto', 'espetinho', 'assado',
  'bistrô', 'bistro', 'grill', 'rotisseri', 'rotisseria',
  'buffet', 'catering', 'self service', 'self-service',
  'bar ', 'barzinho', 'boteco', 'botequim', 'taberna',
  'café ', 'cafeteria', 'cafezinho', 'coffee',
  'suco', 'sucos', 'vitamina', 'juice',
  'confeitaria', 'doceria', 'brigaderi', 'bolo',
  'food truck', 'foodtruck',

  // Hortifruti / quitanda
  'hortifruti', 'hortifruiti', 'quitanda', 'verdureiro', 'frutaria', 'feira',

  // Adega / bebidas especializadas
  'adega', 'licor', 'destilaria', 'vinho', 'wines',

  // Conveniência de posto
  'conveniência', 'conveniencia', 'posto ',

  // Moda / vestuário
  'bolsa', 'modas', 'vestuário', 'vestuario', 'calçado', 'calcado', 'sapato', 'roupa', 'fashion', 'confecção',

  // Ótica / joias
  'óculos', 'oculos', 'ótica', 'otica', 'joias', 'jóias', 'bijuteria',

  // Eletrônicos / informática
  'celular', 'eletrônic', 'eletromóv', 'eletrodom', 'informática', 'informatica', 'computador', 'smartphone',

  // Construção
  'piso', 'cerâmica', 'ceramica', 'ferragem',

  // Fitness / estética
  'suplemento', 'academia', 'fitness', 'musculação', 'musculacao',
  'maquiagem', 'beauty', 'cosmétic', 'cosmetic', 'cabeleireiro', 'estética', 'estetica',

  // Plantas / flores
  'planta ', 'plantas', 'jardim', 'flores', 'floricultura',

  // Outros irrelevantes
  'alfaiataria', 'cogumelo',
  'móveis', 'moveis', 'colchão', 'colchao', 'sofá', 'sofa', 'decoração',
  'autopeça', 'autopeças', 'veículo', 'veiculo', 'automóvel',
  'pizzaria', 'lanchonete', 'hamburgu', 'churrascaria',
  'farmácia', 'farmacia',
  'depósito de bebida', 'deposito de bebida',
  'na brasa', 'arreio', 'arreios',
  'brew', 'cerveja', 'choperia',
  'ração', 'racão', 'rações', 'racoes',
  'pet shop', 'petshop', 'pet ',
  'mall', 'shopping',
  'fábrica de açaí', 'fabrica de acai', 'sorvetes',
  'açougue', 'acougue', 'peixaria',
];

async function processarLote(items) {
  const validos = [];
  for (const item of items) {
    const rawTel = item.phone || item.phoneUnformatted || '';
    const nome   = item.title || item.empresa || '';
    const cidade = item.city  || item.cidade  || '';
    const end    = item.address || item.endereco || '';

    if (!nome || !cidade) continue;
    if (blacklist.some(p => nome.toLowerCase().includes(p))) continue;

    const { telefone: celIA, email, cnpj } = await buscarContatos(nome, cidade, end, rawTel);

    if (celIA && await existeNoWhatsApp(celIA)) {
      validos.push({ ...item, phoneUnformatted: '55' + celIA, phone: celIA, _email: email, _cnpj: cnpj, _fonte_telefone: 'ia_pessoal', _prioridade: 0 });
      continue;
    }

    const celApify = normalizarCelular(rawTel);
    if (celApify && await existeNoWhatsApp(celApify)) {
      validos.push({ ...item, phoneUnformatted: '55' + celApify, phone: celApify, _email: email, _cnpj: cnpj, _fonte_telefone: 'maps_fallback', _prioridade: 1 });
    }
  }
  return validos;
}

const loteInicial = $input.all().map(i => i.json);
const todosValidos = await processarLote(loteInicial);

if (todosValidos.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: loteInicial.length, _meta_filtrada: 0 } }];
}

todosValidos.sort((a, b) => (a._prioridade || 0) - (b._prioridade || 0));

return todosValidos.map((item, idx) => ({
  json: {
    ...item,
    _meta_bruta:    idx === 0 ? loteInicial.length : undefined,
    _meta_filtrada: idx === 0 ? todosValidos.length  : undefined,
  }
}));
`;

console.log('✓ enriquecer_leads v3: blacklist expandida + CNPJ BrasilAPI + validação SMTP');

// ─── 3. edit_fields: garante campo email ──────────────────────────────────────
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
} else {
  console.warn('⚠ edit_fields não encontrado — adicionar campo email manualmente no n8n');
}

// ─── 4. Salvar ────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── 5. Verificação ───────────────────────────────────────────────────────────
const json = JSON.stringify(d);
console.log('\n=== VERIFICAÇÃO ===');
console.log('Nome atualizado:       ', json.includes('Victor Pizza v3') ? '✓' : '✗');
console.log('Blacklist mercearia:   ', json.includes('mercearia') ? '✓' : '✗');
console.log('Blacklist restaurante: ', json.includes('restaurante') ? '✓' : '✗');
console.log('Blacklist hortifruti:  ', json.includes('hortifruti') ? '✓' : '✗');
console.log('CNPJ BrasilAPI:        ', json.includes('brasilapi.com.br') ? '✓' : '✗');
console.log('Validação SMTP:        ', json.includes('mailcheck.ai') ? '✓' : '✗');
console.log('Tem UazAPI check:      ', json.includes('check-whatsapp') ? '✓' : '✗');
console.log('Tem ia_pessoal:        ', json.includes('ia_pessoal') ? '✓' : '✗');
