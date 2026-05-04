const fs = require('fs');
const aplicarBase = require('./_base_v3x');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v23_salva_todos.json', 'utf8'));

// =============================================================
// v31 — Região Metropolitana como locationQuery
//
// Estratégia: em vez de buscar só "{cidade}, {estado}",
// busca "Grande {cidade}, {estado}" — cobre municípios vizinhos
// que pertencem à mesma região metropolitana.
// Exemplo: "Grande São Paulo" inclui Guarulhos, Santo André,
// São Bernardo, Osasco etc.
//
// Sem multiplicador (v30 mostrou que 6 sem mult > 5 com mult).
// =============================================================

const { apifyNode } = aplicarBase(d, 'v31');

// ---- mapear_tipo_loja ----
const mapearNode = d.nodes.find(n => n.name === 'mapear_tipo_loja');
mapearNode.parameters.jsCode = `const body = $input.first().json.body;
const tipoLoja = body.tipo_loja || '';
const cidade = body.cidade || '';
const estado = body.estado || '';
const quantidade = parseInt(body.quantidade) || 30;

const SEARCH_STRINGS = {
  'Lojas de artigos esportivos': ['loja de artigos esportivos','loja de bicicletas','loja de pesca esportiva','artigos de futebol loja','loja de roupas esportivas','loja de surf skate','loja de material esportivo'],
  'Lojas de brinquedos': ['loja de brinquedos','loja de artigos infantis','loja de jogos infantis','loja de hobby'],
  'Eletroportáteis/eletrônicos': ['loja de eletrônicos','loja de eletrodomésticos','loja de celulares','loja de informática'],
  'Papelaria': ['papelaria','loja de material escolar'],
  'Lojas de Variedades/1,99/miudezas/bazares': ['loja de variedades','bazar','armarinho','utilidades domésticas loja','casa e cozinha loja','loja 1,99','loja de presentes'],
};
const APPROVED = {
  'Lojas de artigos esportivos': ['artigos esportivos','material esportivo','equipamentos esportivos','sporting goods','loja esportiva','bicicletas','ciclismo','bicycle','pesca esportiva','loja de pesca','fishing store','artigos de pesca','surf','skate','skateboard','roupas esportivas','sportswear','sports clothing','corrida','running','futebol','artigos de futebol','football store','tênis esportivo','calçados esportivos'],
  'Lojas de brinquedos': ['brinquedos','toy store','hobby','jogos infantis','loja de jogos','brinquedo','artigos infantis','loja infantil','kids','bonecas','boneca'],
  'Eletroportáteis/eletrônicos': ['eletrônicos','electronics','eletrodomésticos','home appliance','celulares','cell phone','informática','computer store','eletroportáteis','appliance store','eletroeletrônicos','games','video game'],
  'Papelaria': ['papelaria','stationery','material escolar','office supply','livraria','material de escritório'],
  'Lojas de Variedades/1,99/miudezas/bazares': ['variedades','variety store','bazar','bazaar','armarinho','utilidades domésticas','home goods','utilidades','casa e cozinha','cozinha e lar','kitchen','presentes','gift shop','importados','import store','1,99','dollar store','miudezas','loja geral','general store','quinquilharias','bijuterias','bijuteria','loja de desconto','discount store'],
};
const DENIED_GLOBAL = ['academia','gym','fitness','crossfit','pilates','yoga','clube','club','arena esportiva','complexo esportivo','sports complex','restaurante','restaurant','lanchonete','padaria','confeitaria','bar ','supermercado','hipermercado','atacado de alimentos','farmácia','drogaria','pharmacy','clínica','médico','dentista','hospital','escola de ','escola infantil','educação infantil','colégio','creche','buffet','construtora','construção','empreiteira','construction','assistência técnica','conserto','manutenção','reparo','imobiliária','real estate','salão de beleza','cabeleireiro','barbearia','hair salon','estética','spa','beauty salon','agropecuária','veterinário','feed store','alimentos','mercearia','açougue','food manufacturer','tecidos','costura'];

const searchStringsArray = SEARCH_STRINGS[tipoLoja] || SEARCH_STRINGS['Lojas de Variedades/1,99/miudezas/bazares'];
const approvedCategories = APPROVED[tipoLoja] || APPROVED['Lojas de Variedades/1,99/miudezas/bazares'];

// ESTRATÉGIA v31: região metropolitana — termo oficial IBGE
// "Região Metropolitana de X" é reconhecido pelo Google Maps para ~70 cidades BR
const locationQuery = 'Região Metropolitana de ' + cidade + ', ' + estado + ', Brasil';

const maxResults = quantidade;
const perSearch = Math.max(Math.ceil(maxResults / searchStringsArray.length), 5);

return [{ json: {
  searchStringsArray, approvedCategories, deniedCategories: DENIED_GLOBAL,
  locationQuery, quantidade, maxResults, perSearch,
  tipo_loja: tipoLoja, cidade, estado, ...body,
} }];`;

// Apify customBody
apifyNode.parameters.customBody = "={{ JSON.stringify({\n  searchStringsArray: $('mapear_tipo_loja').item.json.searchStringsArray,\n  maxCrawledPlacesPerSearch: $('mapear_tipo_loja').item.json.perSearch,\n  maxResults: $('mapear_tipo_loja').item.json.maxResults,\n  language: 'pt-PT',\n  locationQuery: $('mapear_tipo_loja').item.json.locationQuery\n}) }}";

console.log('✓ v31: locationQuery = "Região Metropolitana de {cidade}, {estado}, Brasil"');

d.name = 'Fluxo_4g — Dashboard v2 (v31b regiao-metropolitana-fix)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v31_regiao_metro.json', output);
console.log('✓ Fluxo_4g_v31_regiao_metro.json salvo —', (output.length / 1024).toFixed(1), 'KB');
