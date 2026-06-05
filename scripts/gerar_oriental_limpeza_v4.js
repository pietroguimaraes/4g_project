const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v3.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v4.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── 1. Atualizar definir_termos — remove embalagens/bebidas puras ────────────
const defTermos = d.nodes.find(n => n.name === 'definir_termos');
if (!defTermos) { console.error('✗ nó definir_termos não encontrado!'); process.exit(1); }

const termosV3 = `const TERMOS = {
  'Supermercados': [
    'supermercado',
    'minimercado',
    'mercadinho',
    'mercearia',
    'mercado supermercado',
  ],
  'Atacadistas e atacarejos': [
    'atacarejo',
    'atacadão',
    'cash and carry',
    'atacadista alimentos',
    'atacado varejo',
  ],
  'Distribuidoras': [
    'distribuidora de alimentos',
    'distribuidora bebidas',
    'distribuidora descartaveis',
    'distribuidora alimentos bebidas',
    'distribuidora de produtos alimenticios',
  ],
};`;

// Supermercados: troca 'mercado supermercado' por 'mercado de bairro' (mais específico)
// Distribuidoras: remove 'distribuidora bebidas' (depósitos de cerveja) e
//   'distribuidora descartaveis' (embalagens), adiciona 'distribuidora mercearia' e
//   'distribuidora secos e molhados' (termo clássico NE para distribuidoras multi-produto)
const termosV4 = `const TERMOS = {
  'Supermercados': [
    'supermercado',
    'minimercado',
    'mercadinho',
    'mercearia',
    'mercado de bairro',
  ],
  'Atacadistas e atacarejos': [
    'atacarejo',
    'atacadão',
    'cash and carry',
    'atacadista alimentos',
    'atacado varejo',
  ],
  'Distribuidoras': [
    'distribuidora de alimentos',
    'distribuidora alimentos bebidas',
    'distribuidora de produtos alimenticios',
    'distribuidora mercearia',
    'distribuidora secos e molhados',
  ],
};`;

if (!defTermos.parameters.jsCode.includes("'distribuidora bebidas'")) {
  console.error('✗ TERMOS v3 não encontrados — verifique o texto de busca');
  process.exit(1);
}
defTermos.parameters.jsCode = defTermos.parameters.jsCode.replace(termosV3, termosV4);
if (defTermos.parameters.jsCode.includes("'distribuidora bebidas'")) {
  console.error('✗ Substituição de TERMOS falhou');
  process.exit(1);
}
console.log('✓ TERMOS v4: remove distribuidora bebidas/descartaveis, adiciona mercearia/secos e molhados');

// ─── 2. Atualizar enriquecer_leads — IA roda primeiro para TODOS os leads ─────
const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado!'); process.exit(1); }

// Substituir o comentário de cabeçalho e o loop for completo
const cabecalhoV3 = `// v46 — enriquecer_leads com IA (OpenAI web_search)
// Ordem de tentativas por lead:
//  1. Tem telefone → valida celular BR → passa ou descarta
//  2. Sem fone + tem site → raspa HTML (wa.me/ ou padrão) → valida → passa
//  3. Sem fone (falhou acima) → IA busca telefone pelo nome+cidade → valida → passa
//  4. Sem resultado → descarta`;

const cabecalhoV4 = `// v47-oriental — enriquecer_leads IA-first (WhatsApp pessoal do dono/comprador)
// Ordem de tentativas por lead:
//  1. IA busca WhatsApp PESSOAL do dono/comprador — roda para TODOS os leads
//  2. Fallback → celular do Google Maps (se IA não encontrou)
//  3. Fallback → site HTML (wa.me/ ou padrão BR)
//  4. Sem resultado → descarta`;

if (!enriquece.parameters.jsCode.includes(cabecalhoV3)) {
  console.error('✗ Cabeçalho v3 não encontrado em enriquecer_leads');
  process.exit(1);
}
enriquece.parameters.jsCode = enriquece.parameters.jsCode.replace(cabecalhoV3, cabecalhoV4);

// Substituir o loop for inteiro (da declaração até o fechamento antes do if resultado.length)
const loopV3 = `for (const item of allItems) {
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
}`;

// Novo loop: IA roda primeiro para TODOS os leads; Google Maps vira fallback
const loopV4 = `for (const item of allItems) {
  const rawTel = (item.json.phone || item.json.phoneUnformatted || '');
  const website = item.json.website || '';
  const nome    = item.json.title || item.json.empresa || '';
  const cidade  = item.json.city || item.json.cidade || '';
  const end     = item.json.address || item.json.endereco || '';

  // ── Etapa 1: IA busca WhatsApp PESSOAL do dono/comprador (TODOS os leads) ──
  // Não depende de ter ou não ter telefone do Maps — sempre tenta primeiro
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

  // ── Etapa 2: Fallback → celular do Google Maps (IA não encontrou) ───────────
  if (rawTel.replace(/\\D/g, '').length >= 10) {
    const cel = normalizarCelular(rawTel);
    if (cel) {
      resultado.push({ json: Object.assign({}, item.json, {
        phoneUnformatted: '55' + cel,
        _fonte_telefone: 'maps_fallback',
      })});
      continue;
    }
  }

  // ── Etapa 3: Fallback → site HTML (wa.me/ ou padrão BR) ─────────────────────
  let foundByHtml = false;
  if (website) {
    try {
      const response = await $helpers.httpRequest({ method: 'GET', url: website, timeout: 8000 });
      const html = (typeof response === 'string') ? response : (response.body || response.data || JSON.stringify(response));

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

  // ── Etapa 4: descarta ──────────────────────────────────────────────────────
}`;

if (!enriquece.parameters.jsCode.includes('// ── Etapa 1: tem telefone → valida ──────────────────────────')) {
  console.error('✗ Loop v3 não encontrado em enriquecer_leads — verifique o marcador da Etapa 1');
  process.exit(1);
}
enriquece.parameters.jsCode = enriquece.parameters.jsCode.replace(loopV3, loopV4);
if (enriquece.parameters.jsCode.includes('// ── Etapa 1: tem telefone → valida ──────────────────────────')) {
  console.error('✗ Substituição do loop falhou — loop antigo ainda presente');
  process.exit(1);
}
console.log('✓ enriquecer_leads v4: IA roda PRIMEIRO para todos os leads; Maps vira fallback');

// ─── 3. Renomear fluxo ────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v4 — IA-first (WhatsApp pessoal dono/comprador)';
console.log('✓ Nome do fluxo atualizado para v4');

// ─── 4. Salvar ────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── 5. Verificação ───────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');
const json = JSON.stringify(d);
console.log("TERMOS: NÃO tem 'distribuidora bebidas':   ", !json.includes("'distribuidora bebidas'") ? '✓' : '✗ PROBLEMA!');
console.log("TERMOS: NÃO tem 'distribuidora descartaveis':", !json.includes("'distribuidora descartaveis'") ? '✓' : '✗ PROBLEMA!');
console.log("TERMOS: Tem 'distribuidora mercearia':     ", json.includes("'distribuidora mercearia'") ? '✓' : '✗');
console.log("TERMOS: Tem 'distribuidora secos e molhados':", json.includes("'distribuidora secos e molhados'") ? '✓' : '✗');
console.log("IA-first: Tem 'Etapa 1: IA busca WhatsApp PESSOAL':", json.includes('IA busca WhatsApp PESSOAL') ? '✓' : '✗');
console.log("IA-first: Tem 'Etapa 2: Fallback → celular do Google Maps':", json.includes('Fallback → celular do Google Maps') ? '✓' : '✗');
console.log("IA-first: NÃO tem loop antigo 'Etapa 1: tem telefone':", !json.includes('Etapa 1: tem telefone') ? '✓' : '✗ PROBLEMA!');
console.log('Contém "dono, diretor":',     json.includes('dono, diretor') ? '✓' : '✗');
console.log('Contém Instagram:',           json.includes('Instagram') ? '✓' : '✗');
console.log('Contém distribuidora-b2b-nu:', json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
console.log('Contém 4g-project.vercel.app:', json.includes('4g-project.vercel.app') ? '✗ PROBLEMA!' : '✓ Não encontrado');

console.log('\n⚠️  AVISO DE PERFORMANCE:');
console.log('   A IA agora roda para TODOS os leads (~90 brutos).');
console.log('   Tempo esperado: 5-15 minutos por busca (vs ~1 min antes).');
console.log('   Isso é intencional — qualidade > velocidade para Reinan.');
