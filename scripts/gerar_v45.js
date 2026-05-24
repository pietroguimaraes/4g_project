const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v44b_reserva.json', 'utf8'));

// === v45: Validação de celular no enriquecer_leads ===
//
// Problema: finalizar_busca divide os leads (ex: 20 LOCALIZADOS + 40 RESERVA) ANTES
// do code_in_java validar o formato de celular. O code_in_java então descarta alguns
// dos 20 LOCALIZADOS (telefones fixos, DDDs inválidos, etc.), e o usuário recebe menos
// do que pediu.
//
// Solução: aplicar a mesma validação de celular do code_in_java DENTRO do enriquecer_leads,
// logo após encontrar o telefone. Assim só chegam ao finalizar_busca leads com celular
// válido brasileiro, e a divisão N LOCALIZADOS + resto RESERVA fica exata.

const novoCodigoEnriquecimento = `// v45 — enriquecer_leads com validação de celular
// Para cada lead do Apify:
//   ✓ tem celular válido (BR, 11 dígitos) → passa direto
//   ✓ sem telefone + tem website → busca wa.me/ ou telefone no HTML → valida
//   ✗ sem telefone + sem website → descarta
//   ✗ telefone fixo / formato inválido → descarta

const allItems = $input.all();
const quantidade_bruta = allItems.length;
const resultado = [];

// Valida e normaliza um telefone para celular BR (11 dígitos: DD + 9 + 8 dígitos)
// Retorna o número normalizado (sem 55) ou null se inválido
function normalizarCelular(raw) {
  let digits = raw.replace(/\\D/g, '');
  // Remove DDI 55
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.substring(2);
  // Normaliza 10 dígitos (formato antigo sem o 9)
  if (digits.length === 10) {
    const terceiro = digits.charAt(2);
    if (['6','7','8','9'].includes(terceiro)) {
      digits = digits.substring(0, 2) + '9' + digits.substring(2);
    } else {
      return null; // fixo, descarta
    }
  }
  // Deve ter exatamente 11 dígitos
  if (digits.length !== 11) return null;
  // 3º dígito deve ser 9 (celular)
  if (digits.charAt(2) !== '9') return null;
  // DDD válido (11–99)
  const ddd = parseInt(digits.substring(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  return digits;
}

for (const item of allItems) {
  const rawTel = (item.json.phone || item.json.phoneUnformatted || '');
  const website = item.json.website || '';

  // Já tem telefone — valida se é celular BR
  if (rawTel.replace(/\\D/g, '').length >= 10) {
    const cel = normalizarCelular(rawTel);
    if (cel) {
      resultado.push({ json: Object.assign({}, item.json, { phoneUnformatted: '55' + cel }) });
    }
    // Se não passou na validação: descarta (fixo, formato inválido)
    continue;
  }

  // Sem telefone e sem website — descarta
  if (!website) continue;

  // Tem website — tenta extrair telefone/WhatsApp do HTML
  try {
    const response = await $helpers.httpRequest({
      method: 'GET',
      url: website,
      timeout: 8000,
    });

    const html = (typeof response === 'string') ? response : (response.body || response.data || JSON.stringify(response));

    // 1. Procura link wa.me/ (WhatsApp direto)
    const waMatch = html.match(/wa\\.me\\/(\\d{10,15})/);
    if (waMatch) {
      const cel = normalizarCelular(waMatch[1]);
      if (cel) {
        resultado.push({ json: Object.assign({}, item.json, {
          phoneUnformatted: '55' + cel,
          phone: cel,
          _fonte_telefone: 'website_wame',
        })});
        continue;
      }
    }

    // 2. Procura padrão de telefone brasileiro no HTML
    const telPatterns = html.match(/\\(?\\d{2}\\)?\\s*9?\\d{4}[-\\s]?\\d{4}/g) || [];
    for (const pat of telPatterns) {
      const cel = normalizarCelular(pat);
      if (cel) {
        resultado.push({ json: Object.assign({}, item.json, {
          phoneUnformatted: '55' + cel,
          phone: cel,
          _fonte_telefone: 'website_html',
        })});
        break;
      }
    }
    // Se não achou nada válido, descarta

  } catch(e) {
    // Site inacessível — descarta
  }
}

if (resultado.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: quantidade_bruta, _meta_filtrada: 0 } }];
}

return resultado.map((item, idx) => ({
  json: Object.assign({}, item.json, {
    _meta_bruta: idx === 0 ? quantidade_bruta : undefined,
    _meta_filtrada: idx === 0 ? resultado.length : undefined,
  })
}));`;

const nodeEL = d.nodes.find(n => n.name === 'enriquecer_leads');
nodeEL.parameters.jsCode = novoCodigoEnriquecimento;
console.log('✓ enriquecer_leads: validação de celular BR adicionada');

// Salvar
d.name = 'Fluxo_4g — Dashboard v2 (v45 celular-validado)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v45_celular.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v45_celular.json salvo em Downloads');

// Verificação
const code = nodeEL.parameters.jsCode;
console.log('\n=== VERIFICACAO ===');
console.log('normalizarCelular função:',    code.includes('normalizarCelular') ? '✓' : '✗');
console.log('Valida 11 dígitos:',           code.includes('length !== 11') ? '✓' : '✗');
console.log('Valida 3º dígito = 9:',        code.includes("charAt(2) !== '9'") ? '✓' : '✗');
console.log('Valida DDD (11–99):',          code.includes('ddd < 11') ? '✓' : '✗');
console.log('Normaliza 10→11 dígitos:',     code.includes('length === 10') ? '✓' : '✗');
console.log('phoneUnformatted com 55+cel:', code.includes("'55' + cel") ? '✓' : '✗');

console.log('\nFluxo de validação no enriquecer_leads:');
console.log('  tem telefone → normalizarCelular() → válido → passa / inválido → descarta');
console.log('  sem telefone + site → extrai wa.me/ ou padrão → normalizarCelular() → válido → passa');
console.log('  sem telefone + sem site → descarta');
console.log('\nResultado esperado: finalizar_busca recebe apenas celulares válidos');
console.log('→ divisão N LOCALIZADOS + resto RESERVA fica exata');
