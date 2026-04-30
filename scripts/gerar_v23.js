const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v22_sem_multiplicador.json', 'utf8'));

// =============================================================
// PROBLEMA IDENTIFICADO:
//   edit_fields → HTTP Request2 (check WhatsApp) → HTTP Request6 (save DB)
//   Leads sem WhatsApp passam com onError:continueRegularOutput, mas
//   o item de erro pode não carregar $('edit_fields').item corretamente.
//   Resultado: só leads COM WhatsApp chegam ao DB → muitos perdidos.
//
// FIX v23:
//   edit_fields → HTTP Request6 (salva TODOS no DB primeiro)
//   HTTP Request6 → patch_busca_concluida (mantém)
//   HTTP Request2 desconectado do fluxo principal (não bloqueia mais o save)
// =============================================================

// =============================================================
// 1. edit_fields — adicionar Cidade, Estado, Pais, Site
//    (campos que o Apify retorna e a API aceita)
// =============================================================
const editFields = d.nodes.find(n => n.name === 'edit_fields');

// Remove campos antigos que vamos recriar (evita duplicata em re-runs)
editFields.parameters.assignments.assignments = editFields.parameters.assignments.assignments.filter(
  a => !['Cidade', 'Estado', 'Pais', 'Site'].includes(a.name)
);

editFields.parameters.assignments.assignments.push(
  {
    id: 'cidade-v23',
    name: 'Cidade',
    // Apify às vezes retorna city, às vezes está no address; pega o que vier
    value: '={{ $json.city || ($json.address || \'\').split(\',\')[0].trim() }}',
    type: 'string'
  },
  {
    id: 'estado-v23',
    name: 'Estado',
    value: '={{ $json.state || $json.stateCode || \'\' }}',
    type: 'string'
  },
  {
    id: 'pais-v23',
    name: 'Pais',
    value: '={{ $json.countryCode || \'BR\' }}',
    type: 'string'
  },
  {
    id: 'site-v23',
    name: 'Site',
    value: '={{ $json.website || \'\' }}',
    type: 'string'
  }
);
console.log('✓ edit_fields: campos Cidade, Estado, Pais, Site adicionados');

// =============================================================
// 2. HTTP Request6 — atualizar body com campos completos
//    Inclui estado, pais, site (que antes faltavam ou vinham undefined)
// =============================================================
const hr6 = d.nodes.find(n => n.name === 'HTTP Request6');
hr6.parameters.jsonBody = [
  '={',
  '  "empresa": "{{ $(\'edit_fields\').item.json.Empresa }}",',
  '  "telefone": "{{ $(\'edit_fields\').item.json.Telefone }}",',
  '  "website": "{{ $(\'edit_fields\').item.json.Site }}",',
  '  "cidade": "{{ $(\'edit_fields\').item.json.Cidade }}",',
  '  "estado": "{{ $(\'edit_fields\').item.json.Estado }}",',
  '  "pais": "{{ $(\'edit_fields\').item.json.Pais }}",',
  '  "status": "{{ $(\'edit_fields\').item.json._status_final }}",',
  '  "tipo_loja": "{{ $(\'edit_fields\').item.json._tipo_loja }}"',
  '}',
].join('\n');
console.log('✓ HTTP Request6: body atualizado com todos os campos');

// =============================================================
// 3. RECONECTAR: edit_fields → HTTP Request6 (direto, sem WhatsApp gate)
//    HTTP Request6 → patch_busca_concluida (mantém — executeOnce:true)
// =============================================================
d.connections['edit_fields'] = {
  main: [[{ node: 'HTTP Request6', type: 'main', index: 0 }]]
};
console.log('✓ Conexão: edit_fields → HTTP Request6 (todos os leads salvos)');

// HTTP Request6 → patch_busca_concluida já estava correto, mantém
console.log('✓ Conexão: HTTP Request6 →', d.connections['HTTP Request6'].main[0][0].node, '(mantido)');

// =============================================================
// 4. SALVAR v23
// =============================================================
d.name = 'Fluxo_4g — Dashboard v2 (v23 salva-todos-leads)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v23_salva_todos.json', JSON.stringify(d, null, 2));
console.log('✓ Fluxo_4g_v23_salva_todos.json salvo em Downloads');

console.log('\n=== VERIFICAÇÃO ===');
console.log('edit_fields →', d.connections['edit_fields'].main[0][0].node);
console.log('HTTP Request6 →', d.connections['HTTP Request6'].main[0][0].node);
const campos = d.nodes.find(n => n.name === 'edit_fields').parameters.assignments.assignments.map(a => a.name);
console.log('edit_fields campos:', campos.join(', '));
console.log('');
console.log('Fluxo de busca agora:');
console.log('  filtrar_categoria → finalizar_busca → code_in_java → edit_fields');
console.log('  → HTTP Request6 (salva TODOS no DB)');
console.log('  → patch_busca_concluida');
console.log('');
console.log('Resultado esperado: todos os leads com celular válido vão ao dashboard,');
console.log('independente de estarem ou não no WhatsApp.');
