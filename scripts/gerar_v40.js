const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v39_simplificado.json', 'utf8'));

// === v40: Substitui Apify por busca via OpenAI Responses API (web_search) ===
// REMOVE: Run an Actor and get dataset1 (Apify Google Maps)
// ADICIONA: buscar_por_ia (HTTP Request → OpenAI Responses API com web_search_preview)
// ADICIONA: parsear_resposta_ia (Code → converte resposta da IA em itens compatíveis)

const OPENAI_PLACEHOLDER = 'SUA_OPENAI_KEY_AQUI';

// -------------------------------------------------------
// 1. Montar prompt da OpenAI como expressão n8n
// -------------------------------------------------------
const promptSistema = [
  'Você é um especialista em prospecção B2B para a loja 4G, uma loja de variedades localizada no Brasil.',
  'A loja 4G vende: brinquedos infantis, artigos esportivos (patins, skate, beach tennis, bolas, mochilas),',
  'produtos de 1,99 e utilidades domésticas.',
  'Seu objetivo é encontrar lojas físicas que possam comprar esses produtos no atacado.',
  '',
  'REGRAS ABSOLUTAS:',
  '- Retorne APENAS empresas que existem de verdade e têm telefone confirmado',
  '- NÃO invente empresas, endereços ou telefones',
  '- NÃO inclua academias, restaurantes, serviços, clínicas ou qualquer negócio que não seja uma loja física',
  '- Inclua apenas lojas que possam ser clientes da 4G (revendedores/atacado)',
  '- Retorne SOMENTE o JSON, sem nenhum texto antes ou depois',
].join('\n');

const promptUsuario = `={{
  'Busque ' + $('definir_termos').first().json.quantidade + ' empresas do tipo "' + $('definir_termos').first().json.tipo_loja + '" na cidade de ' + $('definir_termos').first().json.cidade + ', ' + $('definir_termos').first().json.estado + ', Brasil.' +
  ' Retorne SOMENTE um JSON array válido neste formato:\\n' +
  '[\\n' +
  '  {\\n' +
  '    \\"title\\": \\"Nome da Empresa\\",\\n' +
  '    \\"phone\\": \\"(62) 99999-9999\\",\\n' +
  '    \\"address\\": \\"Rua X, 123 - Bairro - Cidade\\",\\n' +
  '    \\"categoryName\\": \\"tipo de negócio\\"\\n' +
  '  }\\n' +
  ']\\n' +
  'OBRIGATÓRIO: inclua apenas empresas com telefone real. Não invente dados.'
}}`;

const corpoOpenAI = `={{ JSON.stringify({
  model: 'gpt-4o',
  tools: [{ type: 'web_search_preview' }],
  input: [
    { role: 'system', content: ${JSON.stringify(promptSistema)} },
    { role: 'user', content: 'Busque ' + $('definir_termos').first().json.quantidade + ' empresas do tipo "' + $('definir_termos').first().json.tipo_loja + '" na cidade de ' + $('definir_termos').first().json.cidade + ', ' + $('definir_termos').first().json.estado + ', Brasil. Retorne SOMENTE um JSON array com campos: title, phone, address, categoryName. Inclua apenas empresas com telefone real confirmado.' }
  ]
}) }}`;

// -------------------------------------------------------
// 2. Remover nó Apify e adicionar buscar_por_ia
// -------------------------------------------------------
d.nodes = d.nodes.filter(n => n.name !== 'Run an Actor and get dataset1');
delete d.connections['Run an Actor and get dataset1'];

d.nodes.push({
  id: 'buscar-por-ia-v40',
  name: 'buscar_por_ia',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [11568, 10480],
  continueOnFail: false,
  parameters: {
    method: 'POST',
    url: 'https://api.openai.com/v1/responses',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Authorization', value: `Bearer ${OPENAI_PLACEHOLDER}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: corpoOpenAI,
    options: { timeout: 120000 },
  },
});
console.log('✓ buscar_por_ia adicionado (OpenAI Responses API)');

// -------------------------------------------------------
// 3. Adicionar parsear_resposta_ia
// -------------------------------------------------------
const codigoParsear = `const resp = $input.first().json;

// Extrair texto da resposta da OpenAI Responses API
const outputItems = resp.output || [];
const messageItem = outputItems.find(o => o.type === 'message');
const textContent = messageItem?.content?.find(c => c.type === 'output_text');
const rawText = textContent?.text || '';

// Extrair JSON do texto (pode vir dentro de \`\`\`json ... \`\`\` ou diretamente)
let businesses = [];
try {
  const jsonMatch = rawText.match(/\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\`/) || rawText.match(/(\\[[\\s\\S]*\\])/);
  const jsonStr = jsonMatch ? jsonMatch[1] : rawText.trim();
  businesses = JSON.parse(jsonStr);
} catch(e) {
  console.log('Erro ao parsear JSON da IA:', e.message);
  console.log('Texto bruto recebido:', rawText.substring(0, 500));
  return [{ json: { _sem_resultado: true, _meta_bruta: 0, _meta_filtrada: 0 } }];
}

if (!Array.isArray(businesses) || businesses.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: 0, _meta_filtrada: 0 } }];
}

// Converter para formato compatível com o restante do fluxo (igual ao Apify)
return businesses.map(b => ({
  json: {
    title: b.title || b.nome || b.empresa || '',
    phone: b.phone || b.telefone || '',
    phoneUnformatted: (b.phone || b.telefone || '').replace(/\\D/g, ''),
    address: b.address || b.endereco || '',
    city: b.city || b.cidade || '',
    state: b.state || b.estado || '',
    categoryName: b.categoryName || b.categoria || b.tipo || '',
    categories: b.categories || [b.categoryName || b.categoria || ''],
    website: b.website || b.site || null,
    totalScore: null,
    _fonte: 'openai_web_search',
  }
}));`;

d.nodes.push({
  id: 'parsear-resposta-ia-v40',
  name: 'parsear_resposta_ia',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [11788, 10480],
  parameters: { jsCode: codigoParsear },
});
console.log('✓ parsear_resposta_ia adicionado');

// -------------------------------------------------------
// 4. Atualizar conexões
// -------------------------------------------------------

// definir_termos → buscar_por_ia (era → Run an Actor)
d.connections['definir_termos'].main[0] = [{ node: 'buscar_por_ia', type: 'main', index: 0 }];
console.log('✓ definir_termos → buscar_por_ia');

// buscar_por_ia → parsear_resposta_ia
d.connections['buscar_por_ia'] = {
  main: [[{ node: 'parsear_resposta_ia', type: 'main', index: 0 }]],
};
console.log('✓ buscar_por_ia → parsear_resposta_ia');

// parsear_resposta_ia → filtrar_whatsapp
d.connections['parsear_resposta_ia'] = {
  main: [[{ node: 'filtrar_whatsapp', type: 'main', index: 0 }]],
};
console.log('✓ parsear_resposta_ia → filtrar_whatsapp');

// -------------------------------------------------------
// Salvar
// -------------------------------------------------------
d.name = 'Fluxo_4g — Dashboard v2 (v40 buscar-por-ia)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v40_buscar_por_ia.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v40_buscar_por_ia.json salvo em Downloads');

// -------------------------------------------------------
// Verificação
// -------------------------------------------------------
const temBuscarIA    = d.nodes.some(n => n.name === 'buscar_por_ia');
const temParsear     = d.nodes.some(n => n.name === 'parsear_resposta_ia');
const temApify       = d.nodes.some(n => n.name === 'Run an Actor and get dataset1');
const conexDT        = d.connections['definir_termos']?.main?.[0]?.[0]?.node;
const conexBIA       = d.connections['buscar_por_ia']?.main?.[0]?.[0]?.node;
const conexParsear   = d.connections['parsear_resposta_ia']?.main?.[0]?.[0]?.node;

console.log('\n=== VERIFICACAO ===');
console.log('buscar_por_ia existe:',        temBuscarIA  ? '✓' : '✗');
console.log('parsear_resposta_ia existe:',  temParsear   ? '✓' : '✗');
console.log('Apify removido:',              !temApify    ? '✓' : '✗ (ainda existe!)');
console.log('definir_termos → buscar_por_ia:', conexDT === 'buscar_por_ia' ? '✓' : `✗ (${conexDT})`);
console.log('buscar_por_ia → parsear_resposta_ia:', conexBIA === 'parsear_resposta_ia' ? '✓' : `✗ (${conexBIA})`);
console.log('parsear_resposta_ia → filtrar_whatsapp:', conexParsear === 'filtrar_whatsapp' ? '✓' : `✗ (${conexParsear})`);

console.log('\n⚠️  ATENÇÃO: Substitua "SUA_OPENAI_KEY_AQUI" pela sua chave real no nó buscar_por_ia');
