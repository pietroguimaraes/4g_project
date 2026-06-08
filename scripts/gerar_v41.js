const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v40_buscar_por_ia.json', 'utf8'));

// === v41: Remove sistema de reserva de leads ===
// O sistema de reserva faz sentido com Apify (roda múltiplas rodadas acumulando leads).
// Com OpenAI web_search, cada busca já retorna o resultado final — reserva é desnecessária.
//
// REMOVE: verificar_reserva, calcular_estrategia, reserva_suficiente, ativar_reserva, patch_reserva_concluida
// SIMPLIFICA: receber_busca_dashboard → definir_termos (direto)

const NOS_RESERVA = [
  'verificar_reserva',
  'calcular_estrategia',
  'reserva_suficiente',
  'ativar_reserva',
  'patch_reserva_concluida',
];

// -------------------------------------------------------
// 1. Remover nós de reserva
// -------------------------------------------------------
const antesDe = d.nodes.length;
d.nodes = d.nodes.filter(n => !NOS_RESERVA.includes(n.name));
console.log(`✓ ${antesDe - d.nodes.length} nós de reserva removidos`);

// -------------------------------------------------------
// 2. Remover conexões dos nós de reserva
// -------------------------------------------------------
for (const nome of NOS_RESERVA) {
  delete d.connections[nome];
}
console.log('✓ Conexões de reserva removidas');

// -------------------------------------------------------
// 3. receber_busca_dashboard → definir_termos (era → verificar_reserva)
// -------------------------------------------------------
d.connections['receber_busca_dashboard'].main[0] = [{ node: 'definir_termos', type: 'main', index: 0 }];
console.log('✓ receber_busca_dashboard → definir_termos (direto)');

// -------------------------------------------------------
// Salvar
// -------------------------------------------------------
d.name = 'Fluxo_4g — Dashboard v2 (v41 sem-reserva)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v41_sem_reserva.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v41_sem_reserva.json salvo em Downloads');

// -------------------------------------------------------
// Verificação
// -------------------------------------------------------
const temReserva = NOS_RESERVA.some(n => d.nodes.find(no => no.name === n));
const conexDB    = d.connections['receber_busca_dashboard']?.main?.[0]?.[0]?.node;
const temDT      = d.nodes.some(n => n.name === 'definir_termos');
const temBIA     = d.nodes.some(n => n.name === 'buscar_por_ia');
const conexDT    = d.connections['definir_termos']?.main?.[0]?.[0]?.node;

console.log('\n=== VERIFICACAO ===');
console.log('Nós de reserva removidos:',               !temReserva ? '✓' : '✗ (ainda existem!)');
console.log('receber_busca_dashboard → definir_termos:', conexDB === 'definir_termos' ? '✓' : `✗ (${conexDB})`);
console.log('definir_termos existe:',                   temDT ? '✓' : '✗');
console.log('buscar_por_ia existe:',                    temBIA ? '✓' : '✗');
console.log('definir_termos → buscar_por_ia:',          conexDT === 'buscar_por_ia' ? '✓' : `✗ (${conexDT})`);

console.log('\nFluxo simplificado:');
console.log('receber_busca_dashboard → definir_termos → buscar_por_ia → parsear_resposta_ia → filtrar_whatsapp → finalizar_busca → verificar_resultado → code_in_java → ...');
console.log('\n⚠️  Lembre de colocar sua chave OpenAI no nó buscar_por_ia antes de testar.');
