const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v6.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v7.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── 1. definir_termos: troca Atacadistas genéricos por termos de produto ─────
const defTermos = d.nodes.find(n => n.name === 'definir_termos');
if (!defTermos) { console.error('✗ nó definir_termos não encontrado!'); process.exit(1); }

// Termos v4/v6 para Atacadistas (genéricos — trazem qualquer tipo de atacadão)
const atacadistasAntigo =
  "  'Atacadistas e atacarejos': [\n" +
  "    'atacarejo',\n" +
  "    'atacadão',\n" +
  "    'cash and carry',\n" +
  "    'atacadista alimentos',\n" +
  "    'atacado varejo',\n" +
  "  ],";

// Termos v7: qualificados por produto ou termos NE clássicos de alimentação
const atacadistasNovo =
  "  'Atacadistas e atacarejos': [\n" +
  "    'secos e molhados',\n" +
  "    'atacado alimentos',\n" +
  "    'atacadista de alimentos',\n" +
  "    'armazém',\n" +
  "    'empório',\n" +
  "  ],";

if (!defTermos.parameters.jsCode.includes(atacadistasAntigo)) {
  console.error('✗ TERMOS Atacadistas v4 não encontrados em definir_termos');
  process.exit(1);
}
defTermos.parameters.jsCode = defTermos.parameters.jsCode.replace(atacadistasAntigo, atacadistasNovo);
if (defTermos.parameters.jsCode.includes("'atacarejo',")) {
  console.error('✗ Substituição de TERMOS falhou — atacarejo ainda presente');
  process.exit(1);
}
console.log('✓ TERMOS v7: Atacadistas trocados por termos qualificados (secos e molhados, atacado alimentos, armazém, empório)');

// ─── 2. enriquecer_leads: adiciona blacklist ICP antes de enriquecer ───────────
const enriquece = d.nodes.find(n => n.name === 'enriquecer_leads');
if (!enriquece) { console.error('✗ nó enriquecer_leads não encontrado!'); process.exit(1); }

// Insere blacklist logo após a declaração da variável 'end' (antes do Etapa 1)
const insertAfterStr = "  const end     = item.json.address || item.json.endereco || '';";
const insertIdx = enriquece.parameters.jsCode.indexOf(insertAfterStr);
if (insertIdx === -1) {
  console.error('✗ Ponto de inserção da blacklist não encontrado em enriquecer_leads');
  process.exit(1);
}

const blacklistInsertion =
  "\n\n  // \u2500\u2500 Filtro ICP: descarta leads de setores fora do alvo \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n" +
  "  const _nomeLC = nome.toLowerCase();\n" +
  "  const _blacklist = [\n" +
  "    'bolsa', 'modas', 'vestuário', 'vestuario', 'calçado', 'calcado', 'sapato', 'roupa', 'fashion', 'confecção',\n" +
  "    'óculos', 'oculos', 'ótica', 'otica', 'joias', 'jóias', 'bijuteria',\n" +
  "    'celular', 'eletrônic', 'eletromóv', 'eletrodom', 'informática', 'informatica', 'computador', 'smartphone',\n" +
  "    'piso', 'cerâmica', 'ceramica', 'ferragem', 'tinta ', 'tintas',\n" +
  "    'suplemento', 'academia', 'fitness', 'musculação', 'musculacao',\n" +
  "    'maquiagem', 'beauty', 'cosmétic', 'cosmetic', 'cabeleireiro', 'estética', 'estetica',\n" +
  "    'planta ', 'plantas', 'jardim', 'flores', 'floricultura',\n" +
  "    'alfaiataria', 'cogumelo',\n" +
  "    'móveis', 'moveis', 'colchão', 'colchao', 'sofá', 'sofa', 'decoração',\n" +
  "    'autopeça', 'autopeças', 'veículo', 'veiculo', 'automóvel',\n" +
  "    'pizzaria', 'lanchonete', 'hamburgu', 'churrascaria',\n" +
  "    'farmácia', 'farmacia',\n" +
  "    'depósito de bebida', 'deposito de bebida',\n" +
  "    'na brasa',\n" +
  "  ];\n" +
  "  if (_blacklist.some(p => _nomeLC.includes(p))) continue;";

const insertAt = insertIdx + insertAfterStr.length;
enriquece.parameters.jsCode =
  enriquece.parameters.jsCode.slice(0, insertAt) +
  blacklistInsertion +
  enriquece.parameters.jsCode.slice(insertAt);

if (!enriquece.parameters.jsCode.includes('_blacklist')) {
  console.error('✗ Blacklist não foi inserida no enriquecer_leads');
  process.exit(1);
}
console.log('✓ Blacklist ICP adicionada ao enriquecer_leads (bolsa, moda, óculos, eletrônico, piso, suplemento, beleza, plantas, alfaiataria, móveis, auto peças, restaurantes, farmácia, depósito de bebida)');

// ─── 3. Renomear fluxo ────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v7 — termos qualificados + blacklist ICP';
console.log('✓ Nome do fluxo atualizado para v7');

// ─── 4. Salvar ────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── 5. Verificação ───────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');
const json = JSON.stringify(d);
// TERMOS
console.log("NÃO tem 'atacarejo',: ", !json.includes("'atacarejo',") ? '✓' : '✗ PROBLEMA!');
console.log("NÃO tem 'atacadão',: ", !json.includes("'atacad\\u00e3o',") && !json.includes("'atacadão',") ? '✓' : '✗ PROBLEMA!');
console.log("Tem 'secos e molhados': ", json.includes('secos e molhados') ? '✓' : '✗');
console.log("Tem 'atacado alimentos': ", json.includes('atacado alimentos') ? '✓' : '✗');
console.log("Tem 'armazém': ", json.includes('armazém') || json.includes('armaz') ? '✓' : '✗');
console.log("Tem 'empório': ", json.includes('empório') || json.includes('emp') ? '✓' : '✗');
// Blacklist
console.log("Tem _blacklist no enriquecer: ", json.includes('_blacklist') ? '✓' : '✗ PROBLEMA!');
console.log("Tem filtro 'bolsa': ", json.includes("'bolsa'") ? '✓' : '✗');
console.log("Tem filtro 'óculos': ", json.includes('culos') ? '✓' : '✗');
// Integridade
console.log("Tem OPENAI_KEY (fix v6): ", json.includes('OPENAI_KEY') ? '✓' : '✗ PROBLEMA!');
console.log("NÃO tem openaiKey: ", !json.includes('${openaiKey}') ? '✓' : '✗ PROBLEMA!');
console.log("Tem maps_fallback: ", json.includes('maps_fallback') ? '✓' : '✗');
console.log("Tem promptA (2-stage AI): ", json.includes('promptA') ? '✓' : '✗');
console.log("Contém distribuidora-b2b-nu: ", json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
console.log("NÃO tem 4g-project: ", !json.includes('4g-project.vercel.app') ? '✓' : '✗ PROBLEMA!');
