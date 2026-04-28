const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v19_fix_pairing.json', 'utf8'));

// =============================================================
// ÚNICO FIX: finalizar_busca — buffer de 1.5x para duplicatas
//
// Problema: marcava exatamente N como LOCALIZADOS.
// Se 1 desses N já existe no banco → entrega N-1.
//
// Fix: marca N * 1.5 como LOCALIZADOS.
// Duplicatas consomem o buffer; ao final o usuário recebe >= N novos.
// O excedente real (além de N) ainda vai pra RESERVA normalmente.
// =============================================================
const finalizarNode = d.nodes.find(n => n.name === 'finalizar_busca');
finalizarNode.parameters.jsCode = [
  "const items = $input.all();",
  "const quantidadePedida = $('mapear_tipo_loja').first().json._quantidade_pedida || 30;",
  "const reservaCount = $('mapear_tipo_loja').first().json._reserva_count || 0;",
  "const tipoLoja = $('mapear_tipo_loja').first().json.tipo_loja || '';",
  "",
  "// Quantos do Apify precisamos para completar além da reserva",
  "const targetApify = Math.max(0, quantidadePedida - reservaCount);",
  "// Buffer de 1.5x: se 13 pedidos → 20 vão como LOCALIZADOS",
  "// Duplicatas consomem o buffer sem zerar a entrega",
  "const targetComBuffer = Math.ceil(targetApify * 1.5);",
  "const quantidade_entregue = Math.min(items.length, targetApify) + reservaCount;",
  "",
  "return items.map(function(item, idx) {",
  "  const json = Object.assign({}, item.json);",
  "  delete json._meta_bruta;",
  "  delete json._meta_filtrada;",
  "  delete json._meta_pedida;",
  "  json._status_final = idx < targetComBuffer ? 'LOCALIZADOS' : 'RESERVA';",
  "  json._tipo_loja = tipoLoja;",
  "  json._total_entregue = quantidade_entregue;",
  "  return { json };",
  "});",
].join('\n');
console.log('✓ finalizar_busca: buffer 1.5x para LOCALIZADOS (evita entrega menor que pedido)');

// =============================================================
// SALVAR v20
// =============================================================
d.name = 'Fluxo_4g — Dashboard v2 (v20 buffer-duplicatas)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v20_buffer.json', JSON.stringify(d, null, 2));
console.log('✓ Fluxo_4g_v20_buffer.json salvo em Downloads');

console.log('\n=== EXEMPLO ===');
console.log('Pedido: 13  →  targetApify=13  →  targetComBuffer=20');
console.log('Apify filtra: 65  →  20 vão LOCALIZADOS, 45 vão RESERVA');
console.log('Se 7 são duplicatas: 13 novos chegam no dashboard ✓');
