const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v10.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v11.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── 1. definir_termos: multiplicador 3x → 8x ────────────────────────────────
const definirTermos = d.nodes.find(n => n.name === 'definir_termos');
if (!definirTermos) { console.error('✗ nó definir_termos não encontrado'); process.exit(1); }

definirTermos.parameters.jsCode = definirTermos.parameters.jsCode
  .replace(
    'const maxResults = quantidade * 3; // multiplicador 3x',
    'const maxResults = quantidade * 8; // multiplicador 8x — buffer para validação WhatsApp'
  );

if (!definirTermos.parameters.jsCode.includes('quantidade * 8')) {
  console.error('✗ Falha ao atualizar multiplicador'); process.exit(1);
}
console.log('✓ definir_termos: multiplicador 3x → 8x (40 brutos para 5 pedidos)');

// ─── 2. enriquecer_leads: loop interno via Apify REST API ────────────────────
// O enriquecer_leads já tem validação WhatsApp (v10).
// Agora adicionamos: se válidos < quota após processar todos, busca mais via Apify.
const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado'); process.exit(1); }

// Injetamos o loop no topo do código existente: lê os parâmetros de busca
// que vêm do definir_termos via item.json (já presentes nos items do Apify)
// e usa a API do Apify para buscar mais se necessário.
const jsCodeAtual = enriquece.parameters.jsCode;

// Adiciona o loop WRAP em volta do código atual
const novoJsCode = `// v11-oriental — enriquecer_leads com loop automático (máx. 3 rodadas)
// Se leads válidos < quota após processar 1ª rodada → busca mais no Apify
// Cada rodada chama Apify REST API diretamente com os mesmos parâmetros de busca

const OPENAI_KEY   = 'SUA_CHAVE_OPENAI_AQUI';
const UAZAPI_URL   = 'https://secondbrain.uazapi.com';
const UAZAPI_TOKEN = '6781e300-9cfe-4d72-9195-aff89f807be2';

// Parâmetros de busca originais (vêm junto com os itens do Apify)
const primeiroItem = $input.first().json;
const quantidade_pedida = parseInt(primeiroItem.quantidade_pedida || primeiroItem.quantidade || 5);

const MAX_LOOPS = 3;

// ── Funções utilitárias ────────────────────────────────────────────────────────

function normalizarCelular(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\\D/g, '');
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
    return true; // fail open — não perde lead por falha de API
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
        max_tokens: 80,
      }),
    });
    return (r.choices?.[0]?.message?.content || '').trim();
  } catch(e) { return ''; }
}

async function buscarPessoal(nome, cidade, end, telApify) {
  const temTel = telApify && normalizarCelular(telApify);

  const promptA = temTel
    ? \`O negócio é "\${nome}" em \${end ? end + ', ' : ''}\${cidade}, Brasil. O número que tenho é \${telApify}.

TAREFA: Esse número é WhatsApp PESSOAL do dono/comprador ou é número da loja?
Se pessoal → responda: PESSOAL:\${telApify.replace(/\\D/g,'')}
Se da loja → procure nas redes pessoais do proprietário e responda: PESSOAL:[número]
Se não encontrar → responda: não encontrado\`
    : \`WhatsApp PESSOAL do dono/comprador de "\${nome}" em \${cidade}, Brasil.
Procure em Instagram/Facebook/LinkedIn pessoal. NÃO retorne número comercial.
Se encontrar → PESSOAL:[número com DDD]. Se não → não encontrado\`;

  const resA = await chamarIA(promptA);
  const mA = resA.match(/PESSOAL[:\\s]+([\\d\\s\\-\\(\\)]+)/i);
  if (mA) { const c = normalizarCelular(mA[1]); if (c) return c; }

  const promptB = \`Para "\${nome}" em \${cidade}, Brasil:
1. Encontre nome do dono/sócio (Receita Federal, LinkedIn, Google)
2. Ache WhatsApp PESSOAL dessa pessoa
Se encontrar → PESSOAL:[número]. Se não → não encontrado\`;

  const resB = await chamarIA(promptB);
  const mB = resB.match(/PESSOAL[:\\s]+([\\d\\s\\-\\(\\)]+)/i);
  if (mB) { const c = normalizarCelular(mB[1]); if (c) return c; }

  return null;
}

const blacklist = [
  'bolsa', 'modas', 'vestuário', 'vestuario', 'calçado', 'calcado', 'sapato', 'roupa', 'fashion', 'confecção',
  'óculos', 'oculos', 'ótica', 'otica', 'joias', 'jóias', 'bijuteria',
  'celular', 'eletrônic', 'eletromóv', 'eletrodom', 'informática', 'informatica', 'computador', 'smartphone',
  'piso', 'cerâmica', 'ceramica', 'ferragem', 'tinta ', 'tintas',
  'suplemento', 'academia', 'fitness', 'musculação', 'musculacao',
  'maquiagem', 'beauty', 'cosmétic', 'cosmetic', 'cabeleireiro', 'estética', 'estetica',
  'planta ', 'plantas', 'jardim', 'flores', 'floricultura',
  'alfaiataria', 'cogumelo',
  'móveis', 'moveis', 'colchão', 'colchao', 'sofá', 'sofa', 'decoração',
  'autopeça', 'autopeças', 'veículo', 'veiculo', 'automóvel',
  'pizzaria', 'lanchonete', 'hamburgu', 'churrascaria',
  'farmácia', 'farmacia',
  'depósito de bebida', 'deposito de bebida',
  'na brasa',
  'arreio', 'arreios',
  'brew', 'cerveja', 'choperia',
  'ração', 'racão', 'rações', 'racoes',
  'pet shop', 'petshop', 'pet ',
  'mall', 'shopping',
  'fit store', 'fitstore',
  'fábrica de açaí', 'fabrica de acai', 'sorvetes',
];

// ── Processar um lote de itens do Apify ───────────────────────────────────────
async function processarLote(items) {
  const validos = [];
  for (const item of items) {
    const rawTel = item.phone || item.phoneUnformatted || '';
    const nome   = item.title || item.empresa || '';
    const cidade = item.city  || item.cidade  || '';
    const end    = item.address || item.endereco || '';

    if (!nome || !cidade) continue;
    if (blacklist.some(p => nome.toLowerCase().includes(p))) continue;

    // Tenta pessoal → valida WhatsApp
    const celIA = await buscarPessoal(nome, cidade, end, rawTel);
    if (celIA && await existeNoWhatsApp(celIA)) {
      validos.push({ ...item, phoneUnformatted: '55' + celIA, phone: celIA, _fonte_telefone: 'ia_pessoal', _prioridade: 0 });
      continue;
    }

    // Fallback: Apify → valida WhatsApp
    const celApify = normalizarCelular(rawTel);
    if (celApify && await existeNoWhatsApp(celApify)) {
      validos.push({ ...item, phoneUnformatted: '55' + celApify, phone: celApify, _fonte_telefone: 'maps_fallback', _prioridade: 1 });
    }
  }
  return validos;
}

// ── Loop principal: processa lote inicial, busca mais se necessário ───────────
const todosValidos = [];
const loopCount = { value: 0 };

// Rodada 1: itens que vieram do Apify pelo n8n
const loteInicial = $input.all().map(i => i.json);
const validos1 = await processarLote(loteInicial);
todosValidos.push(...validos1);
loopCount.value = 1;

// Rodadas 2 e 3 (se necessário): chama Apify REST API diretamente
// Nota: requer APIFY_TOKEN. Deixar aqui preparado para ativar após demo.
// Para ativar: descomentar o bloco abaixo e preencher APIFY_TOKEN.

/*
const APIFY_TOKEN = 'SEU_TOKEN_AQUI';
const searchStringsArray = primeiroItem.searchStringsArray || ['supermercado'];
const locationQuery = primeiroItem.locationQuery || '';
const perSearch = primeiroItem.perSearch || 5;

while (todosValidos.length < quantidade_pedida && loopCount.value < MAX_LOOPS) {
  loopCount.value++;
  try {
    const apifyRun = await $helpers.httpRequest({
      method: 'POST',
      url: \`https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items?token=\${APIFY_TOKEN}\`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchStringsArray, maxCrawledPlacesPerSearch: perSearch, locationQuery, language: 'pt-PT' }),
    });
    if (Array.isArray(apifyRun) && apifyRun.length > 0) {
      const validosExtra = await processarLote(apifyRun);
      todosValidos.push(...validosExtra);
    }
  } catch(e) { break; }
}
*/

// ── Resultado ─────────────────────────────────────────────────────────────────
if (todosValidos.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: loteInicial.length, _meta_filtrada: 0, _loops: loopCount.value } }];
}

// ia_pessoal primeiro, maps_fallback depois
todosValidos.sort((a, b) => (a._prioridade || 0) - (b._prioridade || 0));

return todosValidos.map((item, idx) => ({
  json: {
    ...item,
    _meta_bruta:    idx === 0 ? loteInicial.length : undefined,
    _meta_filtrada: idx === 0 ? todosValidos.length  : undefined,
    _loops:         idx === 0 ? loopCount.value : undefined,
  }
}));
`;

enriquece.parameters.jsCode = novoJsCode;
console.log('✓ enriquecer_leads v11: loop preparado (Apify REST API — ativar com token após demo)');

// ─── 3. Renomear ──────────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v11 — 8x buffer + WhatsApp check + loop preparado';
console.log('✓ Nome atualizado para v11');

// ─── 4. Salvar ────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── 5. Verificação ──────────────────────────────────────────────────────────
const json = JSON.stringify(d);
console.log('\n=== VERIFICAÇÃO ===');
console.log('Multiplicador 8x:        ', json.includes('quantidade * 8') ? '✓' : '✗');
console.log('Tem UazAPI check:         ', json.includes('check-whatsapp') ? '✓' : '✗');
console.log('Tem loop comentado:       ', json.includes('APIFY_TOKEN') ? '✓' : '✗');
console.log('Tem blacklist sorvetes:   ', json.includes('sorvetes') ? '✓' : '✗');
console.log('Tem ia_pessoal:           ', json.includes('ia_pessoal') ? '✓' : '✗');
console.log('Tem maps_fallback:        ', json.includes('maps_fallback') ? '✓' : '✗');
console.log('Tem distribuidora-b2b-nu: ', json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
