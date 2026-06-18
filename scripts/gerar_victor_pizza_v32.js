const fs = require('fs');

// v32: corrige TODOS os Code nodes que referenciam receber_busca_dashboard
// Escaneia cada node e substitui o padrao de leitura do webhook por logica dual
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v31.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v32.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v32 - fix todos os nodes para schedule';
console.log('OK Nome atualizado');

var corrigidos = 0;

d.nodes.forEach(function(node) {
  if (!node.parameters || !node.parameters.jsCode) return;

  var code = node.parameters.jsCode;
  if (!code.includes("$('receber_busca_dashboard')")) return;

  console.log('\n>>> Corrigindo node:', node.name);

  var linhas = code.split('\n');

  // Detecta o padrao: linha com $('receber_busca_dashboard').first().json
  // e a linha seguinte com .body || ...
  // Substitui as duas por logica dual (isExecuted)
  var novasLinhas = [];
  var i = 0;
  var inserido = false;

  while (i < linhas.length) {
    var linha = linhas[i];

    // Detecta linha que le receber_busca_dashboard
    if (!inserido && linha.includes("$('receber_busca_dashboard').first().json")) {
      // Extrai o nome da variavel (ex: _wb, webhook)
      var match = linha.match(/var\s+(\w+)\s*=/);
      var varName = match ? match[1] : '_wb';

      // Detecta linha seguinte com .body || (ex: var body = _wb.body || _wb)
      var nextLinha = linhas[i + 1] || '';
      var bodyMatch = nextLinha.match(/var\s+(\w+)\s*=\s*\w+\.body\s*\|\|\s*\w+/);
      var bodyVar = bodyMatch ? bodyMatch[1] : null;

      console.log('  Variavel detectada:', varName, '| body var:', bodyVar || '(nao detectado)');

      // Insere logica dual
      novasLinhas.push('// Suporta webhook (dashboard) e schedule automatico');
      novasLinhas.push("var fromWebhook = $('receber_busca_dashboard').isExecuted;");
      novasLinhas.push('var ' + varName + ' = fromWebhook');
      novasLinhas.push("  ? $('receber_busca_dashboard').first().json");
      novasLinhas.push("  : $('parametros_schedule').first().json;");

      inserido = true;
      i++; // pula linha original do varName

      // Se a proxima linha e o .body ||, mantem ela (agora usa varName correto)
      if (bodyVar && nextLinha.includes('.body ||')) {
        novasLinhas.push(nextLinha); // mantém a linha "var body = _wb.body || _wb;"
        i++; // pula linha do body
      }
      continue;
    }

    // Qualquer outra referencia restante a receber_busca_dashboard
    // (que nao seja o padrao .first().json ja tratado)
    if (linha.includes("$('receber_busca_dashboard')") && !linha.includes('isExecuted')) {
      console.log('  Referencia adicional na linha', i + 1, '— substituindo por fromWebhook check');
      linha = linha.replace(
        /\$\('receber_busca_dashboard'\)/g,
        "(fromWebhook ? $('receber_busca_dashboard') : $('parametros_schedule'))"
      );
    }

    novasLinhas.push(linha);
    i++;
  }

  node.parameters.jsCode = novasLinhas.join('\n');
  corrigidos++;

  console.log('  OK corrigido. Novas primeiras 6 linhas:');
  novasLinhas.slice(0, 6).forEach(function(l, idx) {
    console.log('    ' + (idx + 1) + ': ' + l);
  });
});

console.log('\n=== Nodes corrigidos:', corrigidos, '===');

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('OK Arquivo salvo: ' + OUTPUT);

// Verificacao final
var json = JSON.stringify(d);
var refsRestantes = (json.match(/\$\('receber_busca_dashboard'\)\.first\(\)\.json/g) || []).length;
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v32',             json.includes('Victor Pizza v32')],
  ['isExecuted em todos',  json.includes('isExecuted')],
  ['schedule_diario',      json.includes('"schedule_diario"')],
  ['montar_email node',    json.includes('"montar_email"')],
  ['Gmail node',           json.includes('n8n-nodes-base.gmail')],
  ['processar_leads',      json.includes('"processar_leads"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('Refs diretas restantes a receber_busca_dashboard.first().json:', refsRestantes);
if (refsRestantes === 0) {
  console.log('OK Todas as referencias foram substituidas por logica dual');
} else {
  console.log('ATENCAO: ainda existem', refsRestantes, 'referencias diretas — podem precisar de correcao manual');
}
