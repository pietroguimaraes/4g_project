const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v44_reserva.json', 'utf8'));

// === v44b: Corrige definir_termos ===
// Problema: $input agora recebe o JSON do verificar_reserva ({count, leads}),
// não mais o body do receber_busca_dashboard.
// Solução: trocar $input.first().json.body → $('receber_busca_dashboard').first().json.body

const nodeDT = d.nodes.find(n => n.name === 'definir_termos');

nodeDT.parameters.jsCode = nodeDT.parameters.jsCode.replace(
  /const body = \$input\.first\(\)\.json\.body;/,
  "const body = $('receber_busca_dashboard').first().json.body;"
);

console.log('✓ definir_termos: $input → $("receber_busca_dashboard")');

// Verificação
const uses_input     = nodeDT.parameters.jsCode.includes('$input.first().json.body');
const uses_receber   = nodeDT.parameters.jsCode.includes("$('receber_busca_dashboard').first().json.body");
const tem_3x         = nodeDT.parameters.jsCode.includes('* 3') || nodeDT.parameters.jsCode.includes('*3') || nodeDT.parameters.jsCode.includes('maxResults3x');
const tem_qtd_pedida = nodeDT.parameters.jsCode.includes('quantidade_pedida');

console.log('Usa $input (erro):', uses_input ? '✗ ainda tem!' : '✓ removido');
console.log('Usa receber_busca_dashboard:', uses_receber ? '✓' : '✗');
console.log('Multiplicador 3x:', tem_3x ? '✓' : '✗');
console.log('quantidade_pedida:', tem_qtd_pedida ? '✓' : '✗');

// Salvar
d.name = 'Fluxo_4g — Dashboard v2 (v44b 3x+reserva corrigido)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v44b_reserva.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v44b_reserva.json salvo em Downloads');
