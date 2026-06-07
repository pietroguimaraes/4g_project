const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v5.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v6.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado!'); process.exit(1); }

let code = enriquece.parameters.jsCode;

// ─── Fix 1: corrige variável openaiKey → OPENAI_KEY ──────────────────────────
// Bug: v5 usou ${openaiKey} mas o código define const OPENAI_KEY (maiúsculo)
// Resultado: ReferenceError silencioso no try/catch → 0 leads entregues
const qtdOcorrencias = (code.match(/\$\{openaiKey\}/g) || []).length;
if (qtdOcorrencias === 0) {
  console.error('✗ Bug openaiKey não encontrado no jsCode — verifique o v5 JSON');
  process.exit(1);
}

code = code.split('${openaiKey}').join('${OPENAI_KEY}');

if (code.includes('${openaiKey}')) {
  console.error('✗ Substituição de openaiKey falhou — ainda há ocorrências');
  process.exit(1);
}
console.log('✓ Fix 1: openaiKey → OPENAI_KEY (' + qtdOcorrencias + ' ocorrências corrigidas)');

// ─── Fix 2: adiciona rawTel ao loop ───────────────────────────────────────────
const loopHeaderAntigo = 'for (const item of allItems) {\n  const nome    = item.json.title || item.json.empresa';
const loopHeaderNovo   = 'for (const item of allItems) {\n  const rawTel  = (item.json.phone || item.json.phoneUnformatted || \'\');\n  const nome    = item.json.title || item.json.empresa';

if (!code.includes(loopHeaderAntigo)) {
  console.error('✗ Cabeçalho do loop sem rawTel não encontrado');
  process.exit(1);
}
code = code.replace(loopHeaderAntigo, loopHeaderNovo);
console.log('✓ Fix 2a: rawTel adicionado ao loop');

// ─── Fix 3: restaura fallback Maps no loop ────────────────────────────────────
// Texto exato conforme gerado pelo v5 (confirmado via debug)
const loopTailAntigo = '  // \u2500\u2500 Etapa 2: descarta \u2014 sem fallback comercial (Maps/HTML removidos) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\n}';

if (!code.includes(loopTailAntigo)) {
  console.error('✗ Final do loop v5 (Etapa 2 descarta) não encontrado');
  process.exit(1);
}

const loopTailNovo =
  '  // \u2500\u2500 Etapa 2: Fallback \u2014 celular do Google Maps (IA n\u00e3o encontrou pessoal) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
  '  if (rawTel.replace(/\\D/g, \'\').length >= 10) {\n' +
  '    const cel = normalizarCelular(rawTel);\n' +
  '    if (cel) {\n' +
  '      resultado.push({ json: Object.assign({}, item.json, {\n' +
  '        phoneUnformatted: \'55\' + cel,\n' +
  '        _fonte_telefone: \'maps_fallback\',\n' +
  '      })});\n' +
  '      continue;\n' +
  '    }\n' +
  '  }\n' +
  '\n' +
  '  // \u2500\u2500 Etapa 3: descarta \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
  '}';

code = code.replace(loopTailAntigo, loopTailNovo);

if (!code.includes('maps_fallback')) {
  console.error('✗ Fallback Maps não foi inserido no código');
  process.exit(1);
}
console.log('✓ Fix 3: fallback Maps restaurado no loop (Etapa 2)');

enriquece.parameters.jsCode = code;

// ─── Renomear fluxo ────────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v6 — fix openaiKey + 2-stage AI + fallback Maps';
console.log('✓ Nome do fluxo atualizado para v6');

// ─── Salvar ───────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');
const json = JSON.stringify(d);
console.log('NÃO tem ${openaiKey}:      ', !json.includes('${openaiKey}') ? '✓' : '✗ PROBLEMA!');
console.log('Tem ${OPENAI_KEY}:         ', json.includes('${OPENAI_KEY}') ? '✓' : '✗ PROBLEMA!');
console.log('Tem rawTel no loop:        ', json.includes('"const rawTel') || json.includes('const rawTel') ? '✓' : '✗');
console.log('Tem maps_fallback:         ', json.includes('maps_fallback') ? '✓' : '✗ PROBLEMA!');
console.log('Tem promptA:               ', json.includes('promptA') ? '✓' : '✗');
console.log('Tem promptB:               ', json.includes('promptB') ? '✓' : '✗');
console.log('Tem Etapa A:               ', json.includes('Etapa A') ? '✓' : '✗');
console.log('Tem Etapa B:               ', json.includes('Etapa B') ? '✓' : '✗');
console.log('NÃO tem website_html:      ', !json.includes('website_html') ? '✓' : '✗');
console.log('Contém distribuidora-b2b:  ', json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
console.log('NÃO tem 4g-project:        ', !json.includes('4g-project.vercel.app') ? '✓' : '✗ PROBLEMA!');
console.log('Contém TERMOS mercearia:   ', json.includes('distribuidora mercearia') ? '✓' : '✗');
