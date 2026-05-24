const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v42_enriquecimento.json', 'utf8'));

// === v43: Corrige finalizar_busca ===
// Problema: finalizar_busca ainda usa lógica da era de reserva (targetComBuffer)
// que limitava a saída para apenas 2 de 19 itens.
// Solução: simplificar finalizar_busca para passar todos os itens como LOCALIZADOS.

const codigoFinalizarBusca = `const allItems = $input.all();
const items = allItems.filter(i => !i.json._sem_resultado);
const tipoLoja = $('definir_termos').first().json.tipo_loja || '';

if (items.length === 0) {
  return [{ json: { _sem_resultado: true, _total_entregue: 0, _tipo_loja: tipoLoja } }];
}

return items.map(item => {
  const json = Object.assign({}, item.json);
  delete json._meta_bruta;
  delete json._meta_filtrada;
  json._status_final = 'LOCALIZADOS';
  json._tipo_loja = tipoLoja;
  json._total_entregue = items.length;
  return { json };
});`;

const nodeFin = d.nodes.find(n => n.name === 'finalizar_busca');
if (!nodeFin) {
  console.error('✗ nó finalizar_busca não encontrado!');
  process.exit(1);
}
nodeFin.parameters.jsCode = codigoFinalizarBusca;
console.log('✓ finalizar_busca simplificado (sem lógica de reserva)');

// -------------------------------------------------------
// Salvar
// -------------------------------------------------------
d.name = 'Fluxo_4g — Dashboard v2 (v43 finalizar-corrigido)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v43_finalizar.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v43_finalizar.json salvo em Downloads');

// -------------------------------------------------------
// Verificação
// -------------------------------------------------------
const codigoAtual = nodeFin.parameters.jsCode;
const temTargetBuffer = codigoAtual.includes('targetComBuffer');
const temLocalizados  = codigoAtual.includes('LOCALIZADOS');
const conexEnriq      = d.connections['enriquecer_leads']?.main?.[0]?.[0]?.node;
const conexFin        = d.connections['finalizar_busca']?.main?.[0]?.[0]?.node;

console.log('\n=== VERIFICACAO ===');
console.log('targetComBuffer removido:', !temTargetBuffer ? '✓' : '✗ (ainda existe!)');
console.log('LOCALIZADOS presente:',     temLocalizados   ? '✓' : '✗');
console.log('enriquecer_leads → finalizar_busca:', conexEnriq === 'finalizar_busca' ? '✓' : `✗ (${conexEnriq})`);
console.log('finalizar_busca → verificar_resultado:', conexFin === 'verificar_resultado' ? '✓' : `✗ (${conexFin})`);

console.log('\nFluxo:');
console.log('receber_busca_dashboard → definir_termos → Run an Actor → enriquecer_leads → finalizar_busca → verificar_resultado → ...');
console.log('\nfinalizar_busca (nova lógica):');
console.log('  - Filtra _sem_resultado');
console.log('  - Todos os itens passam como LOCALIZADOS');
console.log('  - Sem limite por targetComBuffer');
