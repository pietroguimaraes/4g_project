const fs = require('fs');
const aplicarBase = require('./_base_v3x');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v23_salva_todos.json', 'utf8'));

// =============================================================
// v33 — Malha fina: searchStrings 3x mais ampla + cidade exata
//
// Estratégia: o ator atual pode estar PERDENDO lojas porque
// usa só 7 termos de busca. Muitas lojas têm nomes que não
// batem com "loja de artigos esportivos" mas batem com outros
// termos como "esportes", "sport", "bola", "decathlon" etc.
//
// v33 expande o searchStringsArray para ~20 termos por categoria,
// capturando lojas que os 7 termos originais não encontravam.
// locationQuery mantém a cidade exata (sem ruído do estado).
// =============================================================

const { apifyNode } = aplicarBase(d, 'v33');

const mapearNode = d.nodes.find(n => n.name === 'mapear_tipo_loja');
mapearNode.parameters.jsCode = `const body = $input.first().json.body;
const tipoLoja = body.tipo_loja || '';
const cidade = body.cidade || '';
const estado = body.estado || '';
const quantidade = parseInt(body.quantidade) || 30;

// ESTRATÉGIA v33: malha fina — 3x mais termos de busca
// Captura lojas com nomes que os 7 termos originais não encontravam
const SEARCH_STRINGS = {
  'Lojas de artigos esportivos': [
    // Termos originais
    'loja de artigos esportivos','loja de bicicletas','loja de pesca esportiva',
    'artigos de futebol loja','loja de roupas esportivas','loja de surf skate',
    'loja de material esportivo',
    // Termos novos — capturam lojas não encontradas pelos originais
    'esportes loja','sport shop','loja esportiva','equipamentos esportivos',
    'loja de corrida','loja de natação','loja de musculação equipamentos',
    'bola esportiva loja','loja de tênis raquete','loja de camping outdoor',
    'loja de patins rolimã','loja de artes marciais',
    'decathlon','centauro','loja multiesportes',
  ],
  'Lojas de brinquedos': [
    'loja de brinquedos','loja de artigos infantis','loja de jogos infantis','loja de hobby',
    'toy store','brinquedos loja','loja de bonecas','loja de jogos de tabuleiro',
    'loja de LEGO','loja de action figure','loja de games infantis',
    'loja de fantasias infantis','ri happy','loja de kits escolares brinquedo',
  ],
  'Eletroportáteis/eletrônicos': [
    'loja de eletrônicos','loja de eletrodomésticos','loja de celulares','loja de informática',
    'loja de games','loja de videogame','eletrodomésticos loja','loja de geladeira fogão',
    'magazine luiza','loja americanas','loja de ar condicionado',
    'loja de câmeras fotográficas','loja de som automotivo',
  ],
  'Papelaria': [
    'papelaria','loja de material escolar',
    'papelaria e livraria','livraria loja','loja de escritório',
    'material de escritório loja','loja de encadernação','loja de carimbo',
    'loja de arte e desenho','loja de molduras quadros',
  ],
  'Lojas de Variedades/1,99/miudezas/bazares': [
    'loja de variedades','bazar','armarinho','utilidades domésticas loja',
    'casa e cozinha loja','loja 1,99','loja de presentes',
    'loja de utilidades','loja de importados','miudezas loja',
    'quinquilharias loja','loja de bijuterias','loja de desconto',
    'dollar store','variety shop','loja de bugigangas',
    'loja de decoração e presentes','loja de embalagens',
  ],
};

const APPROVED = {
  'Lojas de artigos esportivos': ['artigos esportivos','material esportivo','equipamentos esportivos','sporting goods','loja esportiva','bicicletas','ciclismo','bicycle','pesca esportiva','loja de pesca','fishing store','artigos de pesca','surf','skate','skateboard','roupas esportivas','sportswear','sports clothing','corrida','running','futebol','artigos de futebol','football store','tênis esportivo','calçados esportivos','sport','esporte','outdoor','camping'],
  'Lojas de brinquedos': ['brinquedos','toy store','hobby','jogos infantis','loja de jogos','brinquedo','artigos infantis','loja infantil','kids','bonecas','boneca','action figure','lego','games infantis'],
  'Eletroportáteis/eletrônicos': ['eletrônicos','electronics','eletrodomésticos','home appliance','celulares','cell phone','informática','computer store','eletroportáteis','appliance store','eletroeletrônicos','games','video game','fotografia','câmera'],
  'Papelaria': ['papelaria','stationery','material escolar','office supply','livraria','material de escritório','arte e desenho','moldura'],
  'Lojas de Variedades/1,99/miudezas/bazares': ['variedades','variety store','bazar','bazaar','armarinho','utilidades domésticas','home goods','utilidades','casa e cozinha','cozinha e lar','kitchen','presentes','gift shop','importados','import store','1,99','dollar store','miudezas','loja geral','general store','quinquilharias','bijuterias','bijuteria','loja de desconto','discount store'],
};
const DENIED_GLOBAL = ['academia','gym','fitness','crossfit','pilates','yoga','clube','club','arena esportiva','complexo esportivo','sports complex','restaurante','restaurant','lanchonete','padaria','confeitaria','bar ','supermercado','hipermercado','atacado de alimentos','farmácia','drogaria','pharmacy','clínica','médico','dentista','hospital','escola de ','escola infantil','educação infantil','colégio','creche','buffet','construtora','construção','empreiteira','construction','assistência técnica','conserto','manutenção','reparo','imobiliária','real estate','salão de beleza','cabeleireiro','barbearia','hair salon','estética','spa','beauty salon','agropecuária','veterinário','feed store','alimentos','mercearia','açougue','food manufacturer','tecidos','costura'];

const searchStringsArray = SEARCH_STRINGS[tipoLoja] || SEARCH_STRINGS['Lojas de Variedades/1,99/miudezas/bazares'];
const approvedCategories = APPROVED[tipoLoja] || APPROVED['Lojas de Variedades/1,99/miudezas/bazares'];
const locationQuery = cidade + ', ' + estado + ', Brasil';

// perSearch baixo (2-3) porque há muitos termos — qualidade > quantidade por termo
const maxResults = quantidade;
const perSearch = Math.max(Math.ceil(maxResults / searchStringsArray.length), 2);

return [{ json: {
  searchStringsArray, approvedCategories, deniedCategories: DENIED_GLOBAL,
  locationQuery, quantidade, maxResults, perSearch,
  tipo_loja: tipoLoja, cidade, estado, ...body,
} }];`;

apifyNode.parameters.customBody = "={{ JSON.stringify({\n  searchStringsArray: $('mapear_tipo_loja').item.json.searchStringsArray,\n  maxCrawledPlacesPerSearch: $('mapear_tipo_loja').item.json.perSearch,\n  maxResults: $('mapear_tipo_loja').item.json.maxResults,\n  language: 'pt-PT',\n  locationQuery: $('mapear_tipo_loja').item.json.locationQuery\n}) }}";

console.log('✓ v33: searchStringsArray expandido (~15 termos), locationQuery cidade exata');

d.name = 'Fluxo_4g — Dashboard v2 (v33 malha-fina-search)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v33_malha_fina.json', output);
console.log('✓ Fluxo_4g_v33_malha_fina.json salvo —', (output.length / 1024).toFixed(1), 'KB');
