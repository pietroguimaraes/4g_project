const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v18_reserva.json', 'utf8'));

// =============================================================
// 1. ADICIONAR _status_final e _tipo_loja ao edit_fields
//    Esses campos já existem no $json (code_in_java usa ...item.json)
//    Assim HTTP Request6 pode ler diretamente de edit_fields sem
//    precisar rastrear paired items de volta por code_in_java
// =============================================================
const editFields = d.nodes.find(n => n.name === 'edit_fields');
const assignments = editFields.parameters.assignments.assignments;

// Remove se já existir (para não duplicar em re-runs)
editFields.parameters.assignments.assignments = assignments.filter(
  a => a.name !== '_status_final' && a.name !== '_tipo_loja'
);

editFields.parameters.assignments.assignments.push(
  {
    id: 'status-final-v19',
    name: '_status_final',
    value: '={{ $json._status_final }}',
    type: 'string'
  },
  {
    id: 'tipo-loja-v19',
    name: '_tipo_loja',
    value: '={{ $json._tipo_loja }}',
    type: 'string'
  }
);
console.log('✓ edit_fields: adicionado _status_final e _tipo_loja');

// =============================================================
// 2. CORRIGIR HTTP Request6: usar edit_fields em vez de finalizar_busca
//    Evita cruzar a barreira de pairing do code_in_java
// =============================================================
const hr6 = d.nodes.find(n => n.name === 'HTTP Request6');
hr6.parameters.jsonBody = [
  '={',
  '  "empresa": "{{ $(\'edit_fields\').item.json.Empresa }}",',
  '  "telefone": "{{ $(\'edit_fields\').item.json.Telefone }}",',
  '  "website": "{{ $(\'edit_fields\').item.json.Site }}",',
  '  "cidade": "{{ $(\'edit_fields\').item.json[\'Localização\'] }}",',
  '  "status": "{{ $(\'edit_fields\').item.json._status_final }}",',
  '  "tipo_loja": "{{ $(\'edit_fields\').item.json._tipo_loja }}"',
  '}',
].join('\n');
console.log('✓ HTTP Request6: referências movidas para edit_fields (sem cruzar code_in_java)');

// =============================================================
// 3. SALVAR v19
// =============================================================
d.name = 'Fluxo_4g — Dashboard v2 (v19 fix-pairing)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v19_fix_pairing.json', JSON.stringify(d, null, 2));
console.log('✓ Fluxo_4g_v19_fix_pairing.json salvo em Downloads');

// Verificação
console.log('\n=== VERIFICAÇÃO ===');
const ef = d.nodes.find(n => n.name === 'edit_fields');
const campos = ef.parameters.assignments.assignments.map(a => a.name);
console.log('edit_fields campos:', campos);
const hr6check = d.nodes.find(n => n.name === 'HTTP Request6');
console.log('HTTP Request6 body:', hr6check.parameters.jsonBody);
console.log('Nós totais:', d.nodes.length);
