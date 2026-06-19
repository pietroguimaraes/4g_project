const fs = require('fs');

// v43: dois fixes criticos
// 1. preparar_busca: adiciona offset no CNPJa = total de leads ja existentes
// 2. atualizar_prospectado: le telefone de garantir_campos (nao de $json que vira {skipped,duplicate})
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v42.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v43.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v43 - paginacao CNPJa + fix atualizar_prospectado';
console.log('OK Nome atualizado');

// ── 1. Fix preparar_busca — adiciona offset ───────────────────────────────────
var pb = d.nodes.find(function(n) { return n.name === 'preparar_busca'; });
if (!pb) { console.error('ERRO: preparar_busca nao encontrado'); process.exit(1); }

pb.parameters.jsCode = [
  "// Le params de extrair_params — municipio_id ja vem do frontend (codigo IBGE inteiro)",
  "var params = $('extrair_params').first().json;",
  "",
  "// Offset = total de leads ja existentes para este tipo_loja",
  "// buscar_fones_existentes retorna um item por telefone",
  "var offset = $input.all().filter(function(i) { return !i.json.error; }).length;",
  "",
  "var queryParams = [",
  "  'mainActivity.id.in=' + encodeURIComponent(params.cnaes_str),",
  "  'address.state.in='   + encodeURIComponent(params.estado),",
  "  'status.id.in=2',",
  "  'phones.ex=true',",
  "  'emails.ex=true',",
  "  'limit=' + params.limit,",
  "  'offset=' + offset",
  "];",
  "",
  "// Filtro por municipio IBGE (mais preciso que por cidade string)",
  "if (params.municipio_id) {",
  "  queryParams.push('address.municipality.in=' + params.municipio_id);",
  "}",
  "",
  "console.log('CNPJa offset:', offset, '| limit:', params.limit);",
  "",
  "return [{ json: {",
  "  cnpja_url:         'https://api.cnpja.com/office?' + queryParams.join('&'),",
  "  quantidade_pedida: params.quantidade_pedida,",
  "  search_id:         params.search_id,",
  "  estado:            params.estado,",
  "  cidade:            params.cidade,",
  "  municipio_id:      params.municipio_id,",
  "  bairro:            params.bairro,",
  "  tipo_loja:         params.tipo_loja,",
  "  offset_usado:      offset",
  "} }];"
].join('\n');

console.log('OK preparar_busca atualizado com offset');

// ── 2. Fix atualizar_prospectado — le telefone de garantir_campos ─────────────
var ap = d.nodes.find(function(n) { return n.name === 'atualizar_prospectado'; });
if (!ap) { console.error('ERRO: atualizar_prospectado nao encontrado'); process.exit(1); }

ap.parameters.url = "={{ 'https://distribuidora-b2b-nu.vercel.app/api/leads/' + ($('garantir_campos').item.json.Telefone || $('garantir_campos').item.json.telefone) }}";
console.log('OK atualizar_prospectado URL corrigida para usar garantir_campos');
console.log('   ', ap.parameters.url);

// ── 3. Salva ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── 4. Verificacao ────────────────────────────────────────────────────────────
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v43',                       json.includes('Victor Pizza v43')],
  ['offset no CNPJa',                pb.parameters.jsCode.includes("'offset=' + offset")],
  ['offset usa buscar_fones',        pb.parameters.jsCode.includes('$input.all()')],
  ['atualizar usa garantir_campos',  ap.parameters.url.includes('garantir_campos')],
  ['chave CNPJa nova',               json.includes('5b365975-c026-40c1-9ae1-7a322abf73a3')],
  ['dashboard → extrair_params',     d.connections['receber_busca_dashboard'].main[0][0].node === 'extrair_params'],
  ['schedule_diario',                json.includes('"schedule_diario"')],
  ['Gmail node',                     json.includes('n8n-nodes-base.gmail')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== LOGICA DE PAGINACAO (v43) ===');
console.log('buscar_fones_existentes retorna N telefones ja no banco');
console.log('preparar_busca usa N como offset no CNPJa');
console.log('CNPJa retorna empresas a partir da posicao N → sempre novas');
