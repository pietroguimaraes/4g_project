// Simulação do runtime n8n para testar o fluxo v28 sem importar no n8n
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v28_receita_federal.json', 'utf8'));

let erros = [];
let avisos = [];
let ok = [];

// ─── Helpers ───────────────────────────────────────────────────────────────

function nodeNomes() {
  return d.nodes.map(n => n.name);
}

function extrairReferencias(code) {
  const refs = [];
  const re = /\$\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = re.exec(code)) !== null) refs.push(m[1]);
  return [...new Set(refs)];
}

function checarSintaxe(nome, code) {
  try {
    new Function('$input', '$', '$env', '$json', '$node', code);
    return true;
  } catch(e) {
    erros.push(`SINTAXE [${nome}]: ${e.message}`);
    return false;
  }
}

// ─── 1. Sintaxe de todos os jsCode ─────────────────────────────────────────

console.log('\n=== 1. SINTAXE DOS NODES DE CÓDIGO ===');
const codeNodes = d.nodes.filter(n => n.parameters?.jsCode);
for (const node of codeNodes) {
  if (checarSintaxe(node.name, node.parameters.jsCode)) {
    ok.push(`Sintaxe OK: ${node.name}`);
    console.log('✓', node.name);
  }
}

// ─── 2. Referências $('node') existem ──────────────────────────────────────

console.log('\n=== 2. REFERÊNCIAS $("node") ===');
const nomes = nodeNomes();
for (const node of codeNodes) {
  const refs = extrairReferencias(node.parameters.jsCode);
  for (const ref of refs) {
    if (nomes.includes(ref)) {
      ok.push(`Ref OK: ${node.name} → $('${ref}')`);
      console.log(`✓ ${node.name} → $('${ref}')`);
    } else {
      erros.push(`REF INEXISTENTE: ${node.name} referencia $('${ref}') que não existe`);
      console.log(`✗ ${node.name} → $('${ref}') NÃO EXISTE`);
    }
  }
}

// ─── 3. Simular execução do mapear_tipo_loja ───────────────────────────────

console.log('\n=== 3. SIMULAÇÃO: mapear_tipo_loja ===');

// Dados que chegam de reserva_suficiente (webhook body)
const webhookBody = {
  body: {
    tipo_loja: 'Lojas de artigos esportivos',
    cidade: 'São Paulo',
    estado: 'SP',
    quantidade: 20,
  }
};

// Simula dados do IBGE (como o HTTP Request retornaria)
const ibgeResponse = [
  { id: 3550308, nome: 'São Paulo' },
  { id: 3509502, nome: 'Campinas' },
  { id: 3518800, nome: 'Guarulhos' },
];

const mapearNode = d.nodes.find(n => n.name === 'mapear_tipo_loja');

// Mock do runtime n8n
const mockN8n = {
  'reserva_suficiente': { first: () => ({ json: webhookBody }) },
  'buscar_ibge_municipios': { first: () => ({ json: ibgeResponse }) },
};

const mockInput = {
  first: () => ({ json: ibgeResponse }), // $input aponta para IBGE (bug do v27)
  all: () => [{ json: ibgeResponse }],
};

try {
  const fn = new Function('$input', '$', '$env', '$json', '$node',
    `"use strict";\n${mapearNode.parameters.jsCode}`
  );
  const result = fn(
    mockInput,
    (nome) => mockN8n[nome] || { first: () => ({ json: {} }), all: () => [] },
    {},
    {},
    {}
  );

  const out = result[0].json;
  console.log('tipo_loja:', out.tipo_loja ? `✓ "${out.tipo_loja}"` : '✗ VAZIO');
  console.log('cidade:', out.cidade ? `✓ "${out.cidade}"` : '✗ VAZIO');
  console.log('estado:', out.estado ? `✓ "${out.estado}"` : '✗ VAZIO');
  console.log('quantidade:', out.quantidade ? `✓ ${out.quantidade}` : '✗ VAZIO');
  console.log('cnaes:', out.cnaes?.length ? `✓ ${JSON.stringify(out.cnaes)}` : '✗ VAZIO');
  console.log('ibge_code:', out.ibge_code ? `✓ "${out.ibge_code}"` : '⚠ VAZIO (cidade não encontrada ou IBGE falhou)');

  if (!out.tipo_loja) erros.push('mapear_tipo_loja: tipo_loja vazio');
  if (!out.cidade) erros.push('mapear_tipo_loja: cidade vazia');
  if (!out.estado) erros.push('mapear_tipo_loja: estado vazio');
  if (!out.cnaes?.length) erros.push('mapear_tipo_loja: cnaes vazio');
  if (out.ibge_code !== '3550308') avisos.push(`ibge_code esperado 3550308, recebido "${out.ibge_code}"`);
  else ok.push('ibge_code correto: 3550308');

} catch(e) {
  erros.push(`EXECUÇÃO mapear_tipo_loja: ${e.message}`);
  console.log('✗ ERRO:', e.message);
}

// ─── 4. Simular filtrar_categoria com dados da RF ──────────────────────────

console.log('\n=== 4. SIMULAÇÃO: filtrar_categoria (dados Receita Federal) ===');

const rfItems = [
  { json: { telefone1: '11987654321', nome_fantasia: 'Sports Zone', razao_social: 'SPORTS ZONE LTDA', situacao_cadastral: 'ATIVA', cnpj: '12345678000100', municipio: 'São Paulo', uf: 'SP', logradouro: 'Rua A', numero: '1', bairro: 'Centro', tipo_logradouro: 'Rua' } },
  { json: { telefone1: '', nome_fantasia: '', razao_social: 'SEM TELEFONE LTDA', situacao_cadastral: 'ATIVA', cnpj: '99999999000100', municipio: 'São Paulo', uf: 'SP', logradouro: 'Rua B', numero: '2', bairro: 'Lapa', tipo_logradouro: 'Rua' } },
  { json: { telefone1: '11912345678', nome_fantasia: 'Inapta Shop', razao_social: 'INAPTA SHOP LTDA', situacao_cadastral: 'INAPTA', cnpj: '11111111000100', municipio: 'São Paulo', uf: 'SP', logradouro: 'Rua C', numero: '3', bairro: 'Vila', tipo_logradouro: 'Rua' } },
  { json: { telefone1: '11987654321', nome_fantasia: 'Duplicada', razao_social: 'DUPLICADA LTDA', situacao_cadastral: 'ATIVA', cnpj: '12345678000100', municipio: 'São Paulo', uf: 'SP', logradouro: 'Rua D', numero: '4', bairro: 'Jardim', tipo_logradouro: 'Rua' } },
];

const mapearOutput = {
  approvedCategories: ['artigos esportivos','material esportivo'],
  deniedCategories: ['academia','gym'],
  tipo_loja: 'Lojas de artigos esportivos',
  cidade: 'São Paulo',
  estado: 'SP',
};

const filtrarNode = d.nodes.find(n => n.name === 'filtrar_categoria');
const mockN8nFiltrar = {
  'mapear_tipo_loja': { first: () => ({ json: mapearOutput }), all: () => [{ json: mapearOutput }] },
};

try {
  const fn = new Function('$input', '$', '$env', '$json', '$node',
    `"use strict";\n${filtrarNode.parameters.jsCode}`
  );
  const result = fn(
    { first: () => rfItems[0], all: () => rfItems },
    (nome) => mockN8nFiltrar[nome] || { first: () => ({ json: {} }), all: () => [] },
    {}, {}, {}
  );

  console.log(`Entrada: ${rfItems.length} itens (1 válido, 1 sem tel, 1 INAPTA, 1 duplicado)`);
  console.log(`Saída: ${result.length} item(s)`);
  console.log('Esperado: 1 (só Sports Zone — ATIVA, com tel, sem duplicata)');

  if (result.length === 1 && result[0].json.title === 'Sports Zone') {
    ok.push('filtrar_categoria: descartou sem-tel, INAPTA e duplicado corretamente');
    console.log('✓ Resultado correto: Sports Zone apenas');
  } else if (result[0]?.json?._sem_resultado) {
    erros.push('filtrar_categoria: retornou _sem_resultado quando havia item válido');
    console.log('✗ Retornou _sem_resultado incorretamente');
  } else {
    avisos.push(`filtrar_categoria: resultado inesperado: ${JSON.stringify(result.map(r => r.json.title))}`);
    console.log('⚠ Resultado diferente do esperado:', result.map(r => r.json.title));
  }
} catch(e) {
  erros.push(`EXECUÇÃO filtrar_categoria: ${e.message}`);
  console.log('✗ ERRO:', e.message);
}

// ─── 5. Simular finalizar_busca ────────────────────────────────────────────

console.log('\n=== 5. SIMULAÇÃO: finalizar_busca ===');

const finalizarItems = [
  { json: { title: 'Loja A', phoneUnformatted: '11999990001', _cnpj: '11111111000101' } },
  { json: { title: 'Loja B', phoneUnformatted: '11999990002', _cnpj: '22222222000101' } },
  { json: { title: 'Loja C', phoneUnformatted: '11999990003', _cnpj: '33333333000101' } },
];

const mapearOutputFinal = {
  _quantidade_pedida: 20,
  _reserva_count: 5,
  tipo_loja: 'Lojas de artigos esportivos',
};

const finalizarNode = d.nodes.find(n => n.name === 'finalizar_busca');
const mockN8nFinalizar = {
  'mapear_tipo_loja': { first: () => ({ json: mapearOutputFinal }) },
};

try {
  const fn = new Function('$input', '$', '$env', '$json', '$node',
    `"use strict";\n${finalizarNode.parameters.jsCode}`
  );
  const result = fn(
    { all: () => finalizarItems },
    (nome) => mockN8nFinalizar[nome] || { first: () => ({ json: {} }), all: () => [] },
    {}, {}, {}
  );

  console.log(`Saída: ${result.length} item(s)`);
  console.log('_status_final[0]:', result[0]?.json?._status_final);
  console.log('_total_entregue[0]:', result[0]?.json?._total_entregue);
  console.log('_tipo_loja[0]:', result[0]?.json?._tipo_loja);

  const semMeta = result.every(r => !r.json._meta_bruta && !r.json._meta_filtrada);
  if (semMeta) {
    ok.push('finalizar_busca: _meta_bruta/_meta_filtrada removidos corretamente');
    console.log('✓ _meta_bruta/_meta_filtrada removidos');
  } else {
    avisos.push('finalizar_busca: _meta_* não foram removidos');
  }

  if (result[0]?.json?._tipo_loja === 'Lojas de artigos esportivos') {
    ok.push('finalizar_busca: _tipo_loja propagado');
    console.log('✓ _tipo_loja propagado');
  }
} catch(e) {
  erros.push(`EXECUÇÃO finalizar_busca: ${e.message}`);
  console.log('✗ ERRO:', e.message);
}

// ─── 6. Integridade das conexões ───────────────────────────────────────────

console.log('\n=== 6. INTEGRIDADE DAS CONEXÕES ===');
for (const [from, conns] of Object.entries(d.connections)) {
  if (!nomes.includes(from)) {
    erros.push(`Conexão de origem inexistente: "${from}"`);
    console.log(`✗ Origem inexistente: "${from}"`);
    continue;
  }
  for (const output of conns.main || []) {
    for (const dest of output || []) {
      if (!nomes.includes(dest.node)) {
        erros.push(`Conexão para destino inexistente: "${from}" → "${dest.node}"`);
        console.log(`✗ Destino inexistente: "${from}" → "${dest.node}"`);
      }
    }
  }
}
console.log('✓ Todas as conexões têm origem e destino válidos');

// ─── Resultado Final ────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════');
console.log('RESULTADO FINAL');
console.log('═══════════════════════════════════════');
console.log(`✓ OK:     ${ok.length} verificações passaram`);
console.log(`⚠ Avisos: ${avisos.length}`);
avisos.forEach(a => console.log('  ⚠', a));
console.log(`✗ Erros:  ${erros.length}`);
erros.forEach(e => console.log('  ✗', e));

if (erros.length === 0) {
  console.log('\n✅ APROVADO — seguro para importar no n8n');
} else {
  console.log('\n❌ REPROVADO — não importar ainda');
  process.exit(1);
}
