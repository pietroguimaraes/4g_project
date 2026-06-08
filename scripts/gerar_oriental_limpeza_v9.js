const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v8.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v9.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Novo jsCode do enriquecer_leads ──────────────────────────────────────────
const novoJsCode = `// v9-oriental — enriquecer_leads IA-verificadora (somente WhatsApp PESSOAL)
// Pipeline:
//  1. IA verifica se o número do Apify é pessoal do dono/comprador
//     — Se for pessoal → salva como ia_pessoal
//     — Se for comercial → IA faz nova busca (Instagram/Facebook/LinkedIn pessoal)
//       — Encontrou → salva como ia_pessoal
//       — Não encontrou → DESCARTA (não entrega número comercial)
//  2. Sem número no Apify → IA faz busca direta
//     — Encontrou → salva como ia_pessoal
//     — Não encontrou → DESCARTA

const OPENAI_KEY = 'SUA_CHAVE_OPENAI_AQUI';

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

  // ── Etapa A: verificar o número do Apify E buscar pessoal ─────────────────
  const promptA = temTelApify
    ? \`O negócio é "\${nome}" em \${end ? end + ', ' : ''}\${cidade}, Brasil. O número que tenho é \${telApify}.

TAREFA: Descubra se esse número é o WhatsApp PESSOAL do dono, sócio ou comprador (não da loja).

Verifique nos resultados de busca e redes sociais:
- Esse número aparece como contato PESSOAL do proprietário em algum lugar?
- O perfil do WhatsApp com esse número tem foto de pessoa (não logo da loja)?

Se esse número É pessoal do dono → responda: PESSOAL:\${telApify.replace(/\\D/g,'')}
Se esse número é da loja (comercial) → procure nas redes sociais PESSOAIS do proprietário (Instagram, Facebook, LinkedIn) e responda: PESSOAL:[número encontrado com DDD]
Se não encontrar nenhum número pessoal → responda: não encontrado\`
    : \`Encontre o WhatsApp PESSOAL (não da loja) do dono, sócio ou comprador de "\${nome}" em \${end ? end + ', ' : ''}\${cidade}, Brasil.

Procure em:
1. Instagram PESSOAL do proprietário — número na bio ou posts "meu zap", "wpp pessoal"
2. Facebook PESSOAL do dono — perfil de pessoa física, não página de empresa
3. LinkedIn — perfil pessoal com cargo "proprietário", "comprador", "gerente"
4. Google: "\${nome} \${cidade} dono" → nome do dono → WhatsApp pessoal da pessoa

NÃO retorne número comercial (conta business da loja com logo, horário de funcionamento na bio).

Se encontrar → responda: PESSOAL:[número com DDD]
Se não encontrar → responda: não encontrado\`;

  const resA = await chamarIA(promptA);
  const matchA = resA.match(/PESSOAL[:\\s]+([\\d\\s\\-\\(\\)]+)/i);
  if (matchA) {
    const cel = normalizarCelular(matchA[1]);
    if (cel) return cel;
  }

  // ── Etapa B: busca pelo nome do sócio ─────────────────────────────────────
  const promptB = \`Para a empresa "\${nome}" em \${cidade}, Brasil:

PASSO 1 — Encontre o nome do dono/sócio/comprador:
- Receita Federal (quadro societário pelo CNPJ)
- LinkedIn ("proprietário", "sócio-gerente", "comprador")
- Google: "\${nome} \${cidade} proprietário" ou "\${nome} \${cidade} sócio"

PASSO 2 — Com o nome encontrado, ache o WhatsApp PESSOAL:
- Instagram pessoal (número na bio ou posts)
- Facebook pessoal (perfil de pessoa física)
- Google: "[nome da pessoa] \${cidade} WhatsApp"

Se encontrar → responda: PESSOAL:[número com DDD]
Se não encontrar → responda: não encontrado\`;

  const resB = await chamarIA(promptB);
  const matchB = resB.match(/PESSOAL[:\\s]+([\\d\\s\\-\\(\\)]+)/i);
  if (matchB) {
    const cel = normalizarCelular(matchB[1]);
    if (cel) return cel;
  }

  return null; // DESCARTA — não entrega número comercial
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
  ];
  if (blacklist.some(p => nLC.includes(p))) continue;

  if (!nome || !cidade) continue;

  // ── Busca IA: verifica Apify + busca pessoal ──────────────────────────────
  const celPessoal = await buscarPessoal(nome, cidade, end, rawTel);

  if (celPessoal) {
    // IA encontrou contato pessoal → vai na FRENTE da fila
    resultado.push({ json: Object.assign({}, item.json, {
      phoneUnformatted: '55' + celPessoal,
      phone: celPessoal,
      _fonte_telefone: 'ia_pessoal',
      _prioridade: 0,
    })});
  } else {
    // IA não encontrou → guarda número comercial do Apify como fallback (vai no FINAL da fila)
    const celApify = normalizarCelular(rawTel);
    if (celApify) {
      resultado.push({ json: Object.assign({}, item.json, {
        phoneUnformatted: '55' + celApify,
        phone: celApify,
        _fonte_telefone: 'maps_fallback',
        _prioridade: 1,
      })});
    }
    // Se não tem nem número comercial → descarta
  }
}

if (resultado.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: quantidade_bruta, _meta_filtrada: 0 } }];
}

// Ordena: ia_pessoal primeiro (prioridade 0), maps_fallback depois (prioridade 1)
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
console.log('✓ enriquecer_leads v9: IA-verificadora, sem fallback comercial');

// ─── Renomear ─────────────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v9 — IA verifica Apify + busca pessoal, sem fallback comercial';
console.log('✓ Nome atualizado para v9');

// ─── Salvar ───────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
const json = JSON.stringify(d);
console.log('\n=== VERIFICAÇÃO ===');
console.log('Tem IA-verificadora:     ', json.includes('TAREFA: Descubra se esse n') ? '✓' : '✗');
console.log('Tem tag PESSOAL:         ', json.includes('PESSOAL:') ? '✓' : '✗');
console.log('Tem maps_fallback (fallback ok):', json.includes("maps_fallback") ? '✓' : '✗');
console.log('Tem blacklist v8 (arreio):', json.includes("arreio") ? '✓' : '✗');
console.log('Tem ia_pessoal:          ', json.includes("ia_pessoal") ? '✓' : '✗');
console.log('Tem distribuidora-b2b-nu:', json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
