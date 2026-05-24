const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v45_celular.json', 'utf8'));

// === v46: Enriquecimento por IA (OpenAI web_search) ===
//
// Para leads sem telefone válido após HTML scraping:
// Chama a OpenAI Responses API com web_search_preview pedindo o WhatsApp/celular
// da empresa pelo nome + endereço + cidade.
//
// Ordem de tentativas no enriquecer_leads:
//  1. Tem telefone → valida (normalizarCelular) → passa ou descarta
//  2. Sem telefone + tem site → raspa HTML (wa.me/ ou padrão BR) → valida → passa
//  3. Sem telefone (com ou sem site, se etapa anterior falhou) → IA busca → valida → passa
//  4. Nada funcionou → descarta

const OPENAI_KEY = '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';

const novoCodigoEnriquecimento = `// v46 — enriquecer_leads com IA (OpenAI web_search)
// Ordem de tentativas por lead:
//  1. Tem telefone → valida celular BR → passa ou descarta
//  2. Sem fone + tem site → raspa HTML (wa.me/ ou padrão) → valida → passa
//  3. Sem fone (falhou acima) → IA busca telefone pelo nome+cidade → valida → passa
//  4. Sem resultado → descarta

const OPENAI_KEY = '${OPENAI_KEY}';

const allItems = $input.all();
const quantidade_bruta = allItems.length;
const resultado = [];

// Valida e normaliza para celular BR (11 dígitos DD+9+8)
// Retorna string normalizada sem DDI, ou null se inválido
function normalizarCelular(raw) {
  let d = raw.replace(/\\D/g, '');
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

// Chama a OpenAI Responses API com web_search_preview
// Retorna o número encontrado (normalizado) ou null
async function buscarTelefoneIA(nome, endereco, cidade) {
  try {
    const prompt = \`Busque o número de WhatsApp ou celular da empresa: "\${nome}", localizada em \${endereco ? endereco + ', ' : ''}\${cidade}, Brasil.
Responda APENAS com o número de telefone (com DDD), sem formatação, sem texto adicional.
Se não encontrar com certeza, responda: não encontrado\`;

    const resp = await $helpers.httpRequest({
      method: 'POST',
      url: 'https://api.openai.com/v1/responses',
      headers: {
        'Authorization': \`Bearer \${OPENAI_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        input: prompt,
      }),
      timeout: 20000,
    });

    // Extrai texto da resposta
    const outputItems = resp.output || [];
    const msg = outputItems.find(o => o.type === 'message');
    const txt = (msg?.content?.find(c => c.type === 'output_text')?.text || '').trim();

    if (!txt || txt.toLowerCase().includes('não encontrado') || txt.toLowerCase().includes('nao encontrado')) {
      return null;
    }

    // Tenta extrair um número do texto retornado
    const nums = txt.match(/[\\d\\s()\\-+]+/g) || [];
    for (const n of nums) {
      const cel = normalizarCelular(n);
      if (cel) return cel;
    }
    return null;
  } catch(e) {
    return null; // falha silenciosa
  }
}

for (const item of allItems) {
  const rawTel = (item.json.phone || item.json.phoneUnformatted || '');
  const website = item.json.website || '';
  const nome    = item.json.title || item.json.empresa || '';
  const cidade  = item.json.city || item.json.cidade || '';
  const end     = item.json.address || item.json.endereco || '';

  // ── Etapa 1: tem telefone → valida ──────────────────────────
  if (rawTel.replace(/\\D/g, '').length >= 10) {
    const cel = normalizarCelular(rawTel);
    if (cel) {
      resultado.push({ json: Object.assign({}, item.json, { phoneUnformatted: '55' + cel }) });
    } else {
      // Telefone inválido (fixo?) → tenta IA antes de descartar
      const celIA = await buscarTelefoneIA(nome, end, cidade);
      if (celIA) {
        resultado.push({ json: Object.assign({}, item.json, {
          phoneUnformatted: '55' + celIA,
          phone: celIA,
          _fonte_telefone: 'ia_websearch',
        })});
      }
    }
    continue;
  }

  // ── Etapa 2: sem telefone + tem site → raspa HTML ────────────
  let foundByHtml = false;
  if (website) {
    try {
      const response = await $helpers.httpRequest({ method: 'GET', url: website, timeout: 8000 });
      const html = (typeof response === 'string') ? response : (response.body || response.data || JSON.stringify(response));

      // wa.me/ (WhatsApp direto)
      const waMatch = html.match(/wa\\.me\\/(\\d{10,15})/);
      if (waMatch) {
        const cel = normalizarCelular(waMatch[1]);
        if (cel) {
          resultado.push({ json: Object.assign({}, item.json, {
            phoneUnformatted: '55' + cel, phone: cel, _fonte_telefone: 'website_wame',
          })});
          foundByHtml = true;
        }
      }

      if (!foundByHtml) {
        const pats = html.match(/\\(?\\d{2}\\)?\\s*9?\\d{4}[-\\s]?\\d{4}/g) || [];
        for (const p of pats) {
          const cel = normalizarCelular(p);
          if (cel) {
            resultado.push({ json: Object.assign({}, item.json, {
              phoneUnformatted: '55' + cel, phone: cel, _fonte_telefone: 'website_html',
            })});
            foundByHtml = true;
            break;
          }
        }
      }
    } catch(e) { /* site inacessível */ }
  }

  if (foundByHtml) continue;

  // ── Etapa 3: IA busca o telefone ────────────────────────────
  if (nome && cidade) {
    const celIA = await buscarTelefoneIA(nome, end, cidade);
    if (celIA) {
      resultado.push({ json: Object.assign({}, item.json, {
        phoneUnformatted: '55' + celIA,
        phone: celIA,
        _fonte_telefone: 'ia_websearch',
      })});
      continue;
    }
  }

  // ── Etapa 4: descarta ────────────────────────────────────────
}

if (resultado.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: quantidade_bruta, _meta_filtrada: 0 } }];
}

return resultado.map((item, idx) => ({
  json: Object.assign({}, item.json, {
    _meta_bruta:    idx === 0 ? quantidade_bruta : undefined,
    _meta_filtrada: idx === 0 ? resultado.length  : undefined,
  })
}));`;

const nodeEL = d.nodes.find(n => n.name === 'enriquecer_leads');
nodeEL.parameters.jsCode = novoCodigoEnriquecimento;
console.log('✓ enriquecer_leads: IA (OpenAI web_search) adicionada como etapa 3');

d.name = 'Fluxo_4g — Dashboard v2 (v46 ia-enriquecimento)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v46_ia.json', JSON.stringify(d, null, 2));
console.log('✓ Fluxo_4g_v46_ia.json salvo em Downloads');

const code = nodeEL.parameters.jsCode;
console.log('\n=== VERIFICACAO ===');
console.log('OPENAI_KEY presente:',         code.includes('sk-proj') ? '✓' : '✗');
console.log('buscarTelefoneIA função:',      code.includes('buscarTelefoneIA') ? '✓' : '✗');
console.log('gpt-4o-mini:',                 code.includes('gpt-4o-mini') ? '✓' : '✗');
console.log('web_search_preview:',          code.includes('web_search_preview') ? '✓' : '✗');
console.log('_fonte_telefone ia_websearch:', code.includes('ia_websearch') ? '✓' : '✗');
console.log('Etapa 1 (tem fone):',          code.includes('Etapa 1') ? '✓' : '✗');
console.log('Etapa 2 (HTML):',              code.includes('Etapa 2') ? '✓' : '✗');
console.log('Etapa 3 (IA):',               code.includes('Etapa 3') ? '✓' : '✗');
console.log('Etapa 4 (descarta):',          code.includes('Etapa 4') ? '✓' : '✗');
console.log('\nFluxo de enriquecimento:');
console.log('  1. Tem fone → valida celular BR → passa (ou tenta IA se fixo)');
console.log('  2. Sem fone + site → HTML (wa.me/ ou padrão) → passa');
console.log('  3. Sem fone → IA (nome+cidade) → passa');
console.log('  4. Sem resultado → descarta');
