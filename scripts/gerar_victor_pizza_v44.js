const fs = require('fs');

// v44: reverte offset do CNPJa (parametro invalido) + mantem fix atualizar_prospectado
// A deduplicacao ja funciona em processar_leads via buscar_fones_existentes
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v42.json'; // volta ao v42 (sem offset)
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v44.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v44 - fix atualizar_prospectado (sem offset CNPJa)';
console.log('OK Nome atualizado');

// ── Fix atualizar_prospectado — le telefone de garantir_campos ────────────────
// Quando HTTP Request6 retorna {skipped:true, reason:duplicate},
// $json.Telefone fica undefined. Precisa ler de garantir_campos.
var ap = d.nodes.find(function(n) { return n.name === 'atualizar_prospectado'; });
if (!ap) { console.error('ERRO: atualizar_prospectado nao encontrado'); process.exit(1); }

ap.parameters.url = "={{ 'https://distribuidora-b2b-nu.vercel.app/api/leads/' + ($('garantir_campos').item.json.Telefone || $('garantir_campos').item.json.telefone) }}";
console.log('OK atualizar_prospectado URL corrigida para usar garantir_campos');

// ── Salva ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao ───────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
var pb = d.nodes.find(function(n) { return n.name === 'preparar_busca'; });

console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v44',                       json.includes('Victor Pizza v44')],
  ['sem offset no CNPJa',            !pb.parameters.jsCode.includes("'offset='")],
  ['atualizar usa garantir_campos',  ap.parameters.url.includes('garantir_campos')],
  ['deduplicacao em processar_leads', json.includes('buscar_fones_existentes')],
  ['chave CNPJa nova',               json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
  ['dashboard → extrair_params',     d.connections['receber_busca_dashboard'].main[0][0].node === 'extrair_params'],
  ['schedule_diario',                json.includes('"schedule_diario"')],
  ['Gmail node',                     json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== COMO FUNCIONA A DEDUPLICACAO ===');
console.log('buscar_fones_existentes → busca todos os telefones ja no banco');
console.log('processar_leads → filtra empresas cujo fone ja existe no banco');
console.log('HTTP Request6 → salva novos (ou skipa duplicatas que escaparam)');
console.log('atualizar_prospectado → PATCH com telefone de garantir_campos (correto)');
