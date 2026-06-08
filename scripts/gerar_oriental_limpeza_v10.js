const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v9.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v10.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Novo jsCode do enriquecer_leads ──────────────────────────────────────────
const novoJsCode = `// v10-oriental — enriquecer_leads com validação WhatsApp (UazAPI)
// Pipeline por lead:
//  1. IA busca WhatsApp PESSOAL do dono (2 tentativas)
//     → validar no UazAPI → se existe: ia_pessoal (frente da fila)
//  2. IA falha → usa número do Apify como fallback
//     → validar no UazAPI → se existe: maps_fallback (final da fila)
//  3. Número inválido no WhatsApp → DESCARTA

const OPENAI_KEY  = 'SUA_CHAVE_OPENAI_AQUI';
const UAZAPI_URL  = 'https://secondbrain.uazapi.com';
const UAZAPI_TOKEN = '6781e300-9cfe-4d72-9195-aff89f807be2';

const allItems = $input.all();
const quantidade_bruta = allItems.length;
const resultado = [];

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

// Verifica se o número existe no WhatsApp via UazAPI
// Retorna true se existe, false se não existe
async function existeNoWhatsApp(cel11digitos) {
  const phone = '55' + cel11digitos;
  try {
    const r = await $helpers.httpRequest({
      method: 'POST',
      url: \`\${UAZAPI_URL}/contact/check-whatsapp\`,
      headers: {
        'token': UAZAPI_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone }),
    });
    return r.exists === true;
  } catch(e) {
    // Se a API falhar por erro de rede, deixa passar (fail open)
    // para não perder leads válidos por problema temporário
    return true;
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
  } catch(e) {
    return '';
  }
}

async function buscarPessoal(nome, cidade, end, telApify) {
  const temTelApify = telApify && normalizarCelular(telApify);

  // ── Etapa A: verificar número do Apify E buscar pessoal ───────────────────
  const promptA = temTelApify
    ? \`O negócio é "\${nome}" em \${end ? end + ', ' : ''}\${cidade}, Brasil. O número que tenho é \${telApify}.

TAREFA: Descubra se esse número é o WhatsApp PESSOAL do dono, sócio ou comprador (não da loja).

Se esse número É pessoal do dono → responda: PESSOAL:\${telApify.replace(/\\D/g,'')}
Se esse número é da loja (comercial) → procure nas redes sociais PESSOAIS do proprietário (Instagram, Facebook, LinkedIn) e responda: PESSOAL:[número com DDD]
Se não encontrar nenhum número pessoal → responda: não encontrado\`
    : \`Encontre o WhatsApp PESSOAL (não da loja) do dono, sócio ou comprador de "\${nome}" em \${end ? end + ', ' : ''}\${cidade}, Brasil.

Procure em Instagram pessoal, Facebook pessoal, LinkedIn do proprietário.
NÃO retorne número comercial (conta business, logo da loja na foto).

Se encontrar → responda: PESSOAL:[número com DDD]
Se não encontrar → responda: não encontrado\`;

  const resA = await chamarIA(promptA);
  const matchA = resA.match(/PESSOAL[:\\s]+([\\d\\s\\-\\(\\)]+)/i);
  if (matchA) {
    const cel = normalizarCelular(matchA[1]);
    if (cel) return cel;
  }

  // ── Etapa B: nome do sócio → pessoal ──────────────────────────────────────
  const promptB = \`Para a empresa "\${nome}" em \${cidade}, Brasil:

PASSO 1 — Nome do dono/sócio/comprador (Receita Federal, LinkedIn, Google).
PASSO 2 — WhatsApp PESSOAL dessa pessoa (Instagram, Facebook pessoal).

Se encontrar → responda: PESSOAL:[número com DDD]
Se não encontrar → responda: não encontrado\`;

  const resB = await chamarIA(promptB);
  const matchB = resB.match(/PESSOAL[:\\s]+([\\d\\s\\-\\(\\)]+)/i);
  if (matchB) {
    const cel = normalizarCelular(matchB[1]);
    if (cel) return cel;
  }

  return null;
}

for (const item of allItems) {
  const rawTel = item.json.phone || item.json.phoneUnformatted || '';
  const nome   = item.json.title || item.json.empresa || '';
  const cidade = item.json.city  || item.json.cidade  || '';
  const end    = item.json.address || item.json.endereco || '';

  // ── Blacklist ICP ──────────────────────────────────────────────────────────
  const nLC = nome.toLowerCase();
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
  if (blacklist.some(p => nLC.includes(p))) continue;

  if (!nome || !cidade) continue;

  // ── Tentativa 1: IA busca pessoal → valida no WhatsApp ────────────────────
  const celIA = await buscarPessoal(nome, cidade, end, rawTel);
  if (celIA) {
    const existe = await existeNoWhatsApp(celIA);
    if (existe) {
      resultado.push({ json: Object.assign({}, item.json, {
        phoneUnformatted: '55' + celIA,
        phone: celIA,
        _fonte_telefone: 'ia_pessoal',
        _prioridade: 0,
      })});
      continue;
    }
    // IA encontrou mas número não está no WhatsApp → tenta Apify como fallback
  }

  // ── Tentativa 2: Apify como fallback → valida no WhatsApp ─────────────────
  const celApify = normalizarCelular(rawTel);
  if (celApify) {
    const existe = await existeNoWhatsApp(celApify);
    if (existe) {
      resultado.push({ json: Object.assign({}, item.json, {
        phoneUnformatted: '55' + celApify,
        phone: celApify,
        _fonte_telefone: 'maps_fallback',
        _prioridade: 1,
      })});
      continue;
    }
  }

  // ── Nenhum número válido no WhatsApp → DESCARTA ────────────────────────────
}

if (resultado.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: quantidade_bruta, _meta_filtrada: 0 } }];
}

// ia_pessoal na frente, maps_fallback no final
resultado.sort((a, b) => (a.json._prioridade || 0) - (b.json._prioridade || 0));

return resultado.map((item, idx) => ({
  json: Object.assign({}, item.json, {
    _meta_bruta:    idx === 0 ? quantidade_bruta : undefined,
    _meta_filtrada: idx === 0 ? resultado.length  : undefined,
  })
}));
`;

// ─── Substituir jsCode no nó enriquecer_leads ─────────────────────────────────
const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado'); process.exit(1); }

enriquece.parameters.jsCode = novoJsCode;
console.log('✓ enriquecer_leads v10: IA + validação WhatsApp (UazAPI)');

// ─── Renomear ─────────────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v10 — valida WhatsApp via UazAPI antes de salvar';
console.log('✓ Nome atualizado para v10');

// ─── Salvar ───────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
const json = JSON.stringify(d);
console.log('\n=== VERIFICAÇÃO ===');
console.log('Tem UazAPI check:        ', json.includes('check-whatsapp') ? '✓' : '✗');
console.log('Tem UAZAPI_TOKEN:        ', json.includes('6781e300') ? '✓' : '✗');
console.log('Tem ia_pessoal:          ', json.includes('ia_pessoal') ? '✓' : '✗');
console.log('Tem maps_fallback:       ', json.includes('maps_fallback') ? '✓' : '✗');
console.log('Tem blacklist sorvetes:  ', json.includes('sorvetes') ? '✓' : '✗');
console.log('Tem distribuidora-b2b-nu:', json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
