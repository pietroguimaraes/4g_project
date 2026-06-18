const fs = require('fs');

// v31: corrige extrair_params — linha 1 referenciava receber_busca_dashboard
// Substitui as primeiras 2 linhas por logica dual: webhook OU schedule
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v30.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v31.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v31 - fix extrair_params para schedule';
console.log('OK Nome atualizado');

var extrairParams = d.nodes.find(function(n) { return n.name === 'extrair_params'; });
if (!extrairParams) { console.error('ERRO: extrair_params nao encontrado'); process.exit(1); }
console.log('OK extrair_params encontrado');

// Le o codigo atual
var codigoAtual = extrairParams.parameters.jsCode;
console.log('Primeiras 3 linhas do codigo atual:');
codigoAtual.split('\n').slice(0, 3).forEach(function(l, i) { console.log(' ' + (i+1) + ': ' + l); });

// Substitui as primeiras 2 linhas (que referenciam receber_busca_dashboard)
// por logica que funciona nos dois caminhos (webhook e schedule)
var novasCabecalho = [
  '// Suporta webhook (dashboard) e schedule automatico',
  "var fromWebhook = $('receber_busca_dashboard').isExecuted;",
  'var raw = fromWebhook',
  "  ? $('receber_busca_dashboard').first().json",
  "  : $('parametros_schedule').first().json;",
  'var body = raw.body || raw;'
].join('\n');

// Remove as 2 primeiras linhas originais e adiciona o novo cabecalho
var linhas = codigoAtual.split('\n');
// Linha 1: var webhook = $('receber_busca_dashboard').first().json;
// Linha 2: var body    = webhook.body || webhook;
// Remove essas duas e substitui pelo novasCabecalho
var linhasRestantes = linhas.slice(2); // pula linhas 0 e 1 (index base 0)
var novoCodigo = novasCabecalho + '\n' + linhasRestantes.join('\n');

extrairParams.parameters.jsCode = novoCodigo;
console.log('OK jsCode atualizado. Novas primeiras linhas:');
novoCodigo.split('\n').slice(0, 7).forEach(function(l, i) { console.log(' ' + (i+1) + ': ' + l); });

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
var code = extrairParams.parameters.jsCode;
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v31',              json.includes('Victor Pizza v31')],
  ['isExecuted check',      code.includes('isExecuted')],
  ['fallback schedule',     code.includes("parametros_schedule").first !== undefined || code.includes("parametros_schedule')")],
  ['body ainda existe',     code.includes('var body = raw.body || raw')],
  ['sem ref direta linha1', !code.startsWith("var webhook = $('receber_busca_dashboard')")],
  ['schedule_diario',       json.includes('"schedule_diario"')],
  ['montar_email node',     json.includes('"montar_email"')],
  ['Gmail node',            json.includes('n8n-nodes-base.gmail')],
  ['processar_leads',       json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== INSTRUCOES ===');
console.log('1. Importa Fluxo_victor_pizza_v31.json no n8n');
console.log('2. Confirma credencial Gmail');
console.log('3. Ativa o workflow');
console.log('4. Clica em schedule_diario → Test step');
