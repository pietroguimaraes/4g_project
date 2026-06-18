const fs = require('fs');
const crypto = require('crypto');

// v28: adiciona Schedule Trigger + parametros fixos para automacao diaria
// Fluxo automatico: Schedule → parametros_schedule → verificar_reserva → (fluxo normal)
// O fluxo manual via dashboard continua funcionando em paralelo
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v27.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v28.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v28 - schedule diario automatico';
console.log('OK Nome atualizado');

// ── Localiza nodes de referencia ──────────────────────────────────────────────
var receber = d.nodes.find(function(n) { return n.name === 'receber_busca_dashboard'; });
if (!receber) { console.error('ERRO: receber_busca_dashboard nao encontrado'); process.exit(1); }
console.log('OK receber_busca_dashboard em', receber.position);

var verificarReserva = d.nodes.find(function(n) { return n.name === 'verificar_reserva'; });
if (!verificarReserva) { console.error('ERRO: verificar_reserva nao encontrado'); process.exit(1); }
console.log('OK verificar_reserva em', verificarReserva.position);

// Garante continueOnFail em patch_busca_concluida para nao travar quando
// search_id do schedule nao existe na tabela searches
var patchBusca = d.nodes.find(function(n) { return n.name === 'patch_busca_concluida'; });
if (patchBusca) {
  patchBusca.continueOnFail = true;
  console.log('OK patch_busca_concluida: continueOnFail = true');
}

// ── Node 1: Schedule Trigger ──────────────────────────────────────────────────
// Dispara de segunda a sexta as 08:00 (horario do servidor n8n)
var scheduleNode = {
  id: crypto.randomUUID(),
  name: 'schedule_diario',
  type: 'n8n-nodes-base.scheduleTrigger',
  typeVersion: 1.2,
  position: [receber.position[0], receber.position[1] + 200],
  parameters: {
    rule: {
      interval: [{
        field: 'cronExpression',
        expression: '0 8 * * 1-5'
      }]
    }
  }
};
d.nodes.push(scheduleNode);
console.log('OK Schedule Trigger adicionado (seg-sex 08:00)');

// ── Node 2: Code com parametros fixos do Victor ───────────────────────────────
var paramsNode = {
  id: crypto.randomUUID(),
  name: 'parametros_schedule',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [receber.position[0] + 240, receber.position[1] + 200],
  parameters: {
    mode: 'runOnceForAllItems',
    jsCode: [
      '// Parametros fixos para a busca automatica diaria do Victor',
      '// Para mudar cidade, tipo ou quantidade: editar aqui',
      'return [{',
      '  json: {',
      '    municipio_id: 3550308,          // Sao Paulo (IBGE)',
      "    tipo_loja:    'SUPERMERCADO',",
      '    quantidade:   10,',
      "    categoria:    'SUPERMERCADO',",
      "    user_id:      '0c706fb0-54f3-453b-b350-38e9fa57b20e',  // Victor",
      "    search_id:    'schedule-' + Date.now()  // ID unico por execucao",
      '  }',
      '}];'
    ].join('\n')
  }
};
d.nodes.push(paramsNode);
console.log('OK parametros_schedule adicionado (SP, SUPERMERCADO, 10 leads)');

// ── Conexoes ──────────────────────────────────────────────────────────────────
// schedule_diario → parametros_schedule
d.connections['schedule_diario'] = {
  main: [[{ node: 'parametros_schedule', type: 'main', index: 0 }]]
};
console.log('OK schedule_diario → parametros_schedule');

// parametros_schedule → verificar_reserva
// verificar_reserva ja recebe de receber_busca_dashboard — adiciona segunda entrada
if (!d.connections['parametros_schedule']) {
  d.connections['parametros_schedule'] = { main: [] };
}
d.connections['parametros_schedule'] = {
  main: [[{ node: 'verificar_reserva', type: 'main', index: 0 }]]
};
console.log('OK parametros_schedule → verificar_reserva');

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v28',               json.includes('Victor Pizza v28')],
  ['schedule_diario',        json.includes('"schedule_diario"')],
  ['scheduleTrigger',        json.includes('scheduleTrigger')],
  ['cron seg-sex 08h',       json.includes('0 8 * * 1-5')],
  ['parametros_schedule',    json.includes('"parametros_schedule"')],
  ['municipio SP',           json.includes('3550308')],
  ['user_id Victor',         json.includes('0c706fb0-54f3-453b-b350-38e9fa57b20e')],
  ['continueOnFail patch',   json.includes('"continueOnFail": true')],
  ['montar_email node',      json.includes('"montar_email"')],
  ['Gmail node',             json.includes('n8n-nodes-base.gmail')],
  ['processar_leads',        json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== COMO FUNCIONA O SCHEDULE ===');
console.log('- De segunda a sexta, as 08:00, o n8n dispara automaticamente');
console.log('- Busca 10 supermercados em Sao Paulo');
console.log('- Enriquece com CNPJa (email, CNPJ, endereco)');
console.log('- Envia email automaticamente para leads com email');
console.log('- Busca manual pelo dashboard continua funcionando normalmente');
console.log('');
console.log('Para mudar horario: editar o node schedule_diario (cron: 0 8 * * 1-5)');
console.log('Para mudar cidade/quantidade: editar o node parametros_schedule');
