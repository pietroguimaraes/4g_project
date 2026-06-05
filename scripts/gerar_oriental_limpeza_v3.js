const fs = require('fs');

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v2.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_oriental_limpeza_v3.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── Atualizar definir_termos — novos termos de busca sem concorrentes ────────
const defTermos = d.nodes.find(n => n.name === 'definir_termos');
if (!defTermos) { console.error('✗ nó definir_termos não encontrado!'); process.exit(1); }

const termosAntigo = `const TERMOS = {
  'Supermercados': [
    'supermercado',
    'mercado supermercado',
    'rede supermercadista',
    'hipermercado',
    'supermercado atacarejo',
  ],
  'Atacadistas e atacarejos': [
    'atacadista',
    'atacarejo',
    'atacado distribuidor',
    'cash and carry',
    'distribuidora atacado',
  ],
  'Distribuidoras': [
    'distribuidora',
    'distribuidora produtos limpeza',
    'distribuidora higiene limpeza',
    'atacado distribuidora',
    'distribuidora higiene',
  ],
};`;

// Novos termos:
// - Supermercados: adiciona minimercado, mercadinho, mercearia (clientes reais de distribuidora)
// - Atacadistas: remove genérico "atacadista", foca em atacarejo/atacadão (quem revende ao varejo)
// - Distribuidoras: troca limpeza/higiene (concorrentes) por alimentos/bebidas (clientes potenciais)
const termosNovo = `const TERMOS = {
  'Supermercados': [
    'supermercado',
    'minimercado',
    'mercadinho',
    'mercearia',
    'mercado supermercado',
  ],
  'Atacadistas e atacarejos': [
    'atacarejo',
    'atacadão',
    'cash and carry',
    'atacadista alimentos',
    'atacado varejo',
  ],
  'Distribuidoras': [
    'distribuidora de alimentos',
    'distribuidora bebidas',
    'distribuidora descartaveis',
    'distribuidora alimentos bebidas',
    'distribuidora de produtos alimenticios',
  ],
};`;

if (!defTermos.parameters.jsCode.includes("'distribuidora produtos limpeza'")) {
  console.error('✗ TERMOS antigos não encontrados no código — verifique o texto de busca');
  process.exit(1);
}

defTermos.parameters.jsCode = defTermos.parameters.jsCode.replace(termosAntigo, termosNovo);

if (defTermos.parameters.jsCode.includes("'distribuidora produtos limpeza'")) {
  console.error('✗ Substituição falhou — TERMOS antigos ainda presentes');
  process.exit(1);
}

console.log('✓ TERMOS atualizados: supermercado/minimercado/mercadinho/mercearia + atacarejo/atacadão + distribuidora alimentos/bebidas');

// ─── Renomear fluxo ───────────────────────────────────────────────────────────
d.name = 'Fluxo Oriental Limpeza v3 — termos ICP corrigidos';
console.log('✓ Nome do fluxo atualizado para v3');

// ─── Salvar ───────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\n✓ Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICAÇÃO ===');
const json = JSON.stringify(d);
console.log("Contém 'minimercado':",               json.includes('minimercado') ? '✓' : '✗');
console.log("Contém 'mercadinho':",                json.includes('mercadinho') ? '✓' : '✗');
console.log("Contém 'mercearia':",                 json.includes('mercearia') ? '✓' : '✗');
console.log("Contém 'atacarejo':",                 json.includes('atacarejo') ? '✓' : '✗');
console.log("Contém 'distribuidora de alimentos':", json.includes('distribuidora de alimentos') ? '✓' : '✗');
console.log("Contém 'distribuidora bebidas':",     json.includes('distribuidora bebidas') ? '✓' : '✗');
console.log("NÃO contém 'distribuidora produtos limpeza':", !json.includes('distribuidora produtos limpeza') ? '✓' : '✗ PROBLEMA!');
console.log("NÃO contém 'distribuidora higiene limpeza':",  !json.includes('distribuidora higiene limpeza') ? '✓' : '✗ PROBLEMA!');
console.log('Contém "dono, diretor":',             json.includes('dono, diretor') ? '✓' : '✗');
console.log('Contém Instagram:',                   json.includes('Instagram') ? '✓' : '✗');
console.log('Contém distribuidora-b2b-nu:',        json.includes('distribuidora-b2b-nu.vercel.app') ? '✓' : '✗');
console.log('Contém 4g-project.vercel.app:',       json.includes('4g-project.vercel.app') ? '✗ PROBLEMA!' : '✓ Não encontrado');
