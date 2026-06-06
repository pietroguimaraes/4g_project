const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v4.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v5.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Atualizar enriquecer_leads: 2-stage AI + remove fallback comercial ───────
const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado!'); process.exit(1); }

const code = enriquece.parameters.jsCode;

// Marcadores que delimitam a seção a substituir (função + loop do v4)
const startMarker = 'async function buscarTelefoneIA(nome, endereco, cidade) {';
const endMarker   = '  // \u2500\u2500 Etapa 4: descarta \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n}';

const startIdx = code.indexOf(startMarker);
if (startIdx === -1) {
  console.error('✗ Marcador início (buscarTelefoneIA) não encontrado no jsCode');
  process.exit(1);
}

const endIdx = code.indexOf(endMarker, startIdx);
if (endIdx === -1) {
  // Tenta variante sem espaços extras
  const endMarker2 = '  // ── Etapa 4: descarta ──────────────────────────────────────────────────────\n}';
  const endIdx2 = code.indexOf(endMarker2, startIdx);
  if (endIdx2 === -1) {
    console.error('✗ Marcador fim (Etapa 4: descarta) não encontrado no jsCode');
    console.error('Procurando por "Etapa 4":', code.indexOf('Etapa 4'));
    process.exit(1);
  }
}

const resolvedEndMarker = code.indexOf(endMarker, startIdx) !== -1 ? endMarker : '  // ── Etapa 4: descarta ──────────────────────────────────────────────────────\n}';
const resolvedEndIdx    = code.indexOf(resolvedEndMarker, startIdx);

const secaoAntiga = code.substring(startIdx, resolvedEndIdx + resolvedEndMarker.length);

// ─── Nova seção: buscarTelefoneIA 2-stage + loop sem fallback comercial ───────
const secaoNova = `async function buscarTelefoneIA(nome, endereco, cidade) {
  // ── Etapa A: busca direta do WhatsApp PESSOAL ──────────────────────────────
  const promptA = \`Preciso do WhatsApp PESSOAL (não da loja) do dono, sócio ou comprador de "\${nome}", em \${endereco ? endereco + ', ' : ''}\${cidade}, Brasil.

Procure APENAS nas redes sociais PESSOAIS:
1. Instagram pessoal do dono — número na bio ou em posts com "meu zap", "wpp pessoal"
2. Facebook PESSOAL do proprietário — perfil de pessoa física, não página de empresa
3. Google: "\${nome} \${cidade} dono" → identifique o nome do dono → busque o celular pessoal dessa pessoa

NÃO retorne:
- Número do site da empresa
- Número do Google Maps da loja
- WhatsApp comercial de atendimento (SAC, pedidos)

Se só encontrar número comercial da loja, responda exatamente: não encontrado
Caso contrário, responda APENAS o número com DDD (ex: 82912345678).\`;

  try {
    const rA = await $helpers.httpRequest({
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Authorization': \`Bearer \${openaiKey}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        tool_choice: 'required',
        messages: [{ role: 'user', content: promptA }],
        max_tokens: 50,
      }),
    });
    const celA = normalizarCelular((rA.choices?.[0]?.message?.content || '').trim());
    if (celA) return celA;
  } catch(eA) { /* segue para Etapa B */ }

  // ── Etapa B: nome do sócio → WhatsApp pessoal ─────────────────────────────
  const promptB = \`Para a empresa "\${nome}" em \${cidade}, Brasil, faça duas etapas em sequência:

ETAPA 1 — Encontre o nome completo do dono/sócio/comprador:
- Receita Federal: quadro de sócios pelo CNPJ da empresa
- LinkedIn: perfis com cargo "proprietário", "sócio-gerente", "comprador"
- Instagram ou Facebook: quem aparece nas publicações como responsável da empresa
- Google: "\${nome} \${cidade} proprietário" ou "\${nome} \${cidade} sócio"

ETAPA 2 — Com o nome encontrado, ache o WhatsApp PESSOAL dessa pessoa:
- Instagram pessoal (número na bio ou em posts)
- Facebook pessoal (perfil de pessoa física, não página de empresa)
- Google: "[nome da pessoa] WhatsApp" ou "[nome da pessoa] \${cidade} contato"

Responda APENAS o número com DDD (ex: 82912345678).
Se não encontrar o nome OU não encontrar contato pessoal, responda: não encontrado\`;

  try {
    const rB = await $helpers.httpRequest({
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Authorization': \`Bearer \${openaiKey}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        tool_choice: 'required',
        messages: [{ role: 'user', content: promptB }],
        max_tokens: 80,
      }),
    });
    const celB = normalizarCelular((rB.choices?.[0]?.message?.content || '').trim());
    if (celB) return celB;
  } catch(eB) { /* nada */ }

  return null;
}

for (const item of allItems) {
  const nome    = item.json.title || item.json.empresa || '';
  const cidade  = item.json.city || item.json.cidade || '';
  const end     = item.json.address || item.json.endereco || '';

  // ── Etapa 1: IA — 2 tentativas (pessoal direto + nome-do-sócio) ───────────
  // Só passa leads onde a IA confirma contato PESSOAL. Sem fallback comercial.
  if (nome && cidade) {
    const celIA = await buscarTelefoneIA(nome, end, cidade);
    if (celIA) {
      resultado.push({ json: Object.assign({}, item.json, {
        phoneUnformatted: '55' + celIA,
        phone: celIA,
        _fonte_telefone: 'ia_pessoal',
      })});
      continue;
    }
  }

  // ── Etapa 2: descarta — sem fallback comercial (Maps/HTML removidos) ───────
}`;

enriquece.parameters.jsCode = code.replace(secaoAntiga, secaoNova);

if (enriquece.parameters.jsCode === code) {
  console.error('✗ Substituição falhou — código não foi alterado');
  process.exit(1);
}

console.log('✓ buscarTelefoneIA v5: Etapa A (pessoal direto) + Etapa B (nome-do-sócio)');
console.log('✓ Loop v5: apenas IA pessoal — Maps e HTML removidos, sem fallback comercial');

// ─── Renomear fluxo ────────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v5 — 2-stage AI pessoal, filtra comerciais';
console.log('✓ Nome do fluxo atualizado para v5');

// ─── Salvar ───────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');
const json = JSON.stringify(d);
console.log('Tem promptA (pessoal direto):           ', json.includes('promptA') ? '✓' : '✗');
console.log('Tem promptB (nome-do-sócio):            ', json.includes('promptB') ? '✓' : '✗');
console.log('Tem Etapa A:                            ', json.includes('Etapa A') ? '✓' : '✗');
console.log('Tem Etapa B:                            ', json.includes('Etapa B') ? '✓' : '✗');
console.log('Tem "ia_pessoal":                       ', json.includes('ia_pessoal') ? '✓' : '✗');
console.log('NÃO tem maps_fallback:                  ', !json.includes('maps_fallback') ? '✓' : '✗ PROBLEMA!');
console.log('NÃO tem website_wame:                   ', !json.includes('website_wame') ? '✓' : '✗ PROBLEMA!');
console.log('NÃO tem website_html:                   ', !json.includes('website_html') ? '✓' : '✗ PROBLEMA!');
console.log('NÃO tem "Etapa 4: descarta" (loop antigo):', !json.includes('Etapa 4: descarta') ? '✓' : '✗ PROBLEMA!');
console.log('Contém distribuidora-b2b-nu:            ', json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
console.log('NÃO tem 4g-project.vercel.app:         ', !json.includes('4g-project.vercel.app') ? '✓' : '✗ PROBLEMA!');
console.log('Contém TERMOS v4 (mercearia):           ', json.includes('distribuidora mercearia') ? '✓' : '✗');

console.log('\n⚠️  AVISO DE PERFORMANCE:');
console.log('   Cada lead faz até 2 chamadas de IA (Etapa A + Etapa B).');
console.log('   Tempo esperado por busca de 90 leads: 15-40 minutos.');
console.log('   Quantidade entregue MENOR, mas todos são contatos PESSOAIS do dono/comprador.');
console.log('   Leads sem contato pessoal confirmado são descartados (não chegam ao Reinan).');
