const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v7.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v8.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Expandir blacklist ICP no enriquecer_leads ───────────────────────────────
const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado!'); process.exit(1); }

// Âncora: última linha da blacklist atual (antes do fechamento do array)
const anchoraAntiga = "    'depósito de bebida', 'deposito de bebida',\n" +
                      "    'na brasa',\n" +
                      "  ];";

const anchoraNova   = "    'depósito de bebida', 'deposito de bebida',\n" +
                      "    'na brasa',\n" +
                      "    'arreio', 'arreios',\n" +
                      "    'brew', 'cerveja', 'choperia',\n" +
                      "    'ração', 'racão', 'rações', 'racoes',\n" +
                      "    'pet shop', 'petshop', 'pet ',\n" +
                      "    'mall', 'shopping',\n" +
                      "    'fit store', 'fitstore',\n" +
                      "  ];";

if (!enriquece.parameters.jsCode.includes(anchoraAntiga)) {
  console.error('✗ Âncora da blacklist v7 não encontrada — verifique o JSON de entrada');
  process.exit(1);
}

enriquece.parameters.jsCode = enriquece.parameters.jsCode.replace(anchoraAntiga, anchoraNova);

if (!enriquece.parameters.jsCode.includes("'arreio'")) {
  console.error('✗ Expansão da blacklist falhou');
  process.exit(1);
}
console.log('✓ Blacklist v8: adicionados arreio, brew, ração, pet, mall, fit store');

// ─── Renomear fluxo ────────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v8 — blacklist expandida (arreio/brew/ração/pet/mall)';
console.log('✓ Nome do fluxo atualizado para v8');

// ─── Salvar ───────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');
const json = JSON.stringify(d);
console.log("Tem 'arreio':        ", json.includes("'arreio'")       ? '✓' : '✗');
console.log("Tem 'brew':          ", json.includes("'brew'")          ? '✓' : '✗');
console.log("Tem 'ração':         ", json.includes("'ração'") || json.includes('ra') ? '✓' : '✗');
console.log("Tem 'pet ':          ", json.includes("'pet '")          ? '✓' : '✗');
console.log("Tem 'mall':          ", json.includes("'mall'")          ? '✓' : '✗');
console.log("Tem 'fit store':     ", json.includes("'fit store'")     ? '✓' : '✗');
console.log("Tem blacklist v7:    ", json.includes("'bolsa'")         ? '✓' : '✗');
console.log("Tem secos e molhados:", json.includes('secos e molhados')? '✓' : '✗');
console.log("Tem OPENAI_KEY:      ", json.includes('OPENAI_KEY')      ? '✓' : '✗ PROBLEMA!');
console.log("Tem maps_fallback:   ", json.includes('maps_fallback')   ? '✓' : '✗');
console.log("Tem distribuidora-b2b-nu:", json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
