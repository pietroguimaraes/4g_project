const fs = require('fs');
const aplicarBase = require('./_base_v3x');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v23_salva_todos.json', 'utf8'));

// =============================================================
// v34 — Máxima Performance
//
// Melhorias aplicadas:
// 1. perSearch mínimo: 2 → 4 (mais resultados por termo de busca)
// 2. Apify continueOnFail=true (falha do actor não trava o fluxo)
// 3. verificar_resultado IF: sem leads → marcar busca como ERRO
// 4. marcar_busca_erro PATCH: registra erro no dashboard
// 5. horario_comercial IF: IA só responde entre 8h e 20h
// 6. msg_fora_horario: avisa o lead fora do horário comercial
// 7. Anderson: número via $env.ANDERSON_WHATSAPP (sem hardcode)
// 8. Catálogo: URL via $env.CATALOGO_URL (sem hardcode)
// =============================================================

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNjkyODc2My1iOGQ5LTQ5YTAtYmY3Yy0wNGIzMmFjMmNhNTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2MjgzNjUxfQ.gc_mgxaHzURxlIs5W0iR2RH2yIQ4BV7pEbyueJ95nGU';
const UAZAPI_TOKEN = '6781e300-9cfe-4d72-9195-aff89f807be2';
const UAZAPI_URL = 'https://secondbrain.uazapi.com/send/text';
const API_BASE = 'https://4g-project.vercel.app/api';

const { apifyNode } = aplicarBase(d, 'v34');

// ─────────────────────────────────────────────────────────────
// 1. mapear_tipo_loja — v33 com perSearch min=4
// ─────────────────────────────────────────────────────────────
const mapearNode = d.nodes.find(n => n.name === 'mapear_tipo_loja');
mapearNode.parameters.jsCode = `const body = $input.first().json.body;
const tipoLoja = body.tipo_loja || '';
const cidade = body.cidade || '';
const estado = body.estado || '';
const quantidade = parseInt(body.quantidade) || 30;

const SEARCH_STRINGS = {
  'Lojas de artigos esportivos': [
    'loja de artigos esportivos','loja de bicicletas','loja de pesca esportiva',
    'artigos de futebol loja','loja de roupas esportivas','loja de surf skate',
    'loja de material esportivo',
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
  'Lojas de Variedades/1,99/miudezas/bazares': ['variedades','variety store','bazar','bazaar','armarinho','utilidades domésticas','home goods','utilidades','casa e cozinha','cozinha e lar','kitchen','presentes','gift shop','importados','import store','1,99','dollar store','miudezas','loja geral','general store','quinquilharias','bijuterias','bijuteria','loja de desconto','discount store'],
};
const DENIED_GLOBAL = [
  // Academias e esporte não-loja
  'academia','gym','fitness','crossfit','pilates','yoga','clube','club',
  'arena esportiva','complexo esportivo','sports complex',
  // Alimentação
  'restaurante','restaurant','lanchonete','padaria','confeitaria','bar ',
  'supermercado','hipermercado','atacado de alimentos',
  'hortifruti','quitanda','frutaria','sorveteria','sorvete','ice cream',
  // Saúde
  'farmácia','drogaria','pharmacy','clínica','médico','dentista','hospital',
  'fisioterapia','acupuntura','quiropraxia','physical therapist',
  // Educação
  'escola de ','escola infantil','educação infantil','colégio','creche',
  // Eventos/alimentação fora
  'buffet',
  // Construção
  'construtora','construção','empreiteira','construction',
  // Serviços técnicos
  'assistência técnica','conserto','manutenção','reparo',
  // Imóveis
  'imobiliária','real estate',
  // Beleza e cosméticos
  'salão de beleza','cabeleireiro','barbearia','hair salon','estética','spa','beauty salon',
  'maquiagem','cosméticos','cosmético','perfumaria','cosmetics store','beauty supply',
  // Óptica
  'ótica','óptica','optical store','optician',
  // Joalheria (não incluir 'jewelry store' — pegaria bijuterias que são legítimas)
  'joalheria','relojoaria',
  // Agro/alimentação
  'agropecuária','veterinário','feed store','alimentos','mercearia','açougue','food manufacturer',
  // Têxtil
  'tecidos','costura',
  // Flores
  'floricultura','flower shop','florist',
  // Lavanderia
  'lavanderia','laundry',
  // Gráfica
  'gráfica','print shop',
  // Automotivo (serviços, não lojas)
  'funilaria','borracharia','lava rápido','auto body','car wash',
  // Tatuagem
  'tatuagem','tattoo','piercing',
  // Financeiro
  'lotérica','lottery',
  // Hospedagem
  'hotel','pousada','hostel',
  // Serviços residenciais
  'desentupidora','encanador','encanamento',
  // Religioso
  'igreja','templo','paróquia','church',
];

const searchStringsArray = SEARCH_STRINGS[tipoLoja] || SEARCH_STRINGS['Lojas de Variedades/1,99/miudezas/bazares'];
const approvedCategories = APPROVED[tipoLoja] || APPROVED['Lojas de Variedades/1,99/miudezas/bazares'];
const locationQuery = cidade + ', ' + estado + ', Brasil';

const maxResults = quantidade;
// v34: mínimo 4 por termo (era 2) — mais resultados por busca sem explodir o volume total
const perSearch = Math.max(Math.ceil(maxResults / searchStringsArray.length), 4);

return [{ json: {
  searchStringsArray, approvedCategories, deniedCategories: DENIED_GLOBAL,
  locationQuery, quantidade, maxResults, perSearch,
  tipo_loja: tipoLoja, cidade, estado, ...body,
} }];`;

// ─────────────────────────────────────────────────────────────
// 2. Apify: continueOnFail=true
//    Se o actor travar/falhar, o fluxo continua e _sem_resultado
//    captura o erro no verificar_resultado logo depois.
// ─────────────────────────────────────────────────────────────
apifyNode.continueOnFail = true;

// ─────────────────────────────────────────────────────────────
// 3. Novo node: verificar_resultado (IF)
//    Posição: após finalizar_busca [12188, 10480]
// ─────────────────────────────────────────────────────────────
const nodeVerificarResultado = {
  id: 'verificar-resultado-v34',
  name: 'verificar_resultado',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [12400, 10480],
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'check-sem-resultado',
        leftValue: '={{ $json._sem_resultado }}',
        rightValue: true,
        operator: { type: 'boolean', operation: 'equals' },
      }],
      combinator: 'and',
    },
    options: {},
  },
};

// ─────────────────────────────────────────────────────────────
// 4. Novo node: marcar_busca_erro (PATCH)
//    Registra status=ERRO no banco para avisar o Anderson
// ─────────────────────────────────────────────────────────────
const nodeMarcarErro = {
  id: 'marcar-busca-erro-v34',
  name: 'marcar_busca_erro',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [12620, 10380],
  parameters: {
    method: 'PATCH',
    url: "={{ 'https://4g-project.vercel.app/api/searches/' + $('receber_busca_dashboard').first().json.body.search_id }}",
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'x-api-key', value: N8N_API_KEY },
        { name: 'Content-Type', value: 'application/json' },
      ],
    },
    sendBody: true,
    contentType: 'json',
    body: '={{ JSON.stringify({ status: \'ERRO\' }) }}',
  },
};

// ─────────────────────────────────────────────────────────────
// 5. Novo node: horario_comercial (IF)
//    Só deixa a IA responder entre 8h e 20h (horário de Brasília)
// ─────────────────────────────────────────────────────────────
const nodeHorario = {
  id: 'horario-comercial-v34',
  name: 'horario_comercial',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [11720, 10896],
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'check-horario',
        leftValue: '={{ (() => { const h = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).replace(/\\D/g,""); const hora = parseInt(h); return hora >= 8 && hora < 20; })() }}',
        rightValue: true,
        operator: { type: 'boolean', operation: 'equals' },
      }],
      combinator: 'and',
    },
    options: {},
  },
};

// ─────────────────────────────────────────────────────────────
// 6. Novo node: msg_fora_horario (HTTP POST → uazapi)
//    Envia aviso ao lead quando a mensagem chega fora do horário
// ─────────────────────────────────────────────────────────────
const nodeForaHorario = {
  id: 'msg-fora-horario-v34',
  name: 'msg_fora_horario',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [11720, 11000],
  parameters: {
    method: 'POST',
    url: UAZAPI_URL,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'token', value: UAZAPI_TOKEN }],
    },
    sendBody: true,
    bodyParameters: {
      parameters: [
        {
          name: 'number',
          value: '={{ $json.body.chat.wa_chatid.replace(/\\D/g, \'\') }}',
        },
        {
          name: 'text',
          value: 'Recebi sua mensagem! Nosso atendimento funciona de seg a sex, das 8h às 20h. Respondo logo no início do próximo horário comercial.',
        },
      ],
    },
  },
};

// ─────────────────────────────────────────────────────────────
// 9. Novo node: salvar_msg_lead (HTTP POST)
//    Salva a mensagem do lead no Supabase via API do dashboard.
//    Inserido entre set_texto_mensagem1 e AI Agent1.
// ─────────────────────────────────────────────────────────────
const PHONE_EXPR = "{{ (() => { const raw = $('recebe_msg_do_lead').item.json.body.chat.wa_chatid.replace(/\\\\D/g, ''); return raw.length === 12 ? raw.substring(0,4)+'9'+raw.substring(4) : raw; })() }}";

const nodeSalvarLead = {
  id: 'salvar-msg-lead-v34',
  name: 'salvar_msg_lead',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [11870, 10800],
  continueOnFail: true,
  parameters: {
    method: 'POST',
    url: `={{ '${API_BASE}/leads/' + (() => { const raw = $('recebe_msg_do_lead').item.json.body.chat.wa_chatid.replace(/\\D/g, ''); return raw.length === 12 ? raw.substring(0,4)+'9'+raw.substring(4) : raw; })() + '/messages' }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'x-api-key', value: N8N_API_KEY }],
    },
    sendBody: true,
    contentType: 'json',
    body: "={{ JSON.stringify({ role: 'lead', conteudo: $json.mensagem }) }}",
  },
};

// ─────────────────────────────────────────────────────────────
// 10. Novo node: salvar_msg_lucas (HTTP POST)
//     Salva a resposta do Lucas (sem "encaminhar" e sem resumo).
//     Roda em paralelo com If3 a partir de response_to_whebhook.
// ─────────────────────────────────────────────────────────────
const nodeSalvarLucas = {
  id: 'salvar-msg-lucas-v34',
  name: 'salvar_msg_lucas',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [12368, 11040],
  continueOnFail: true,
  parameters: {
    method: 'POST',
    url: `={{ '${API_BASE}/leads/' + (() => { const raw = $('recebe_msg_do_lead').item.json.body.chat.wa_chatid.replace(/\\D/g, ''); return raw.length === 12 ? raw.substring(0,4)+'9'+raw.substring(4) : raw; })() + '/messages' }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'x-api-key', value: N8N_API_KEY }],
    },
    sendBody: true,
    contentType: 'json',
    body: "={{ JSON.stringify({ role: 'lucas', conteudo: (() => { let o = $json.output; if (o.toLowerCase().includes('encaminhar')) o = o.split(/encaminhar/i)[0]; if (o.includes('Resumo interno:')) o = o.split('Resumo interno:')[0]; return o.trim(); })() }) }}",
  },
};

d.nodes.push(nodeVerificarResultado, nodeMarcarErro, nodeHorario, nodeForaHorario, nodeSalvarLead, nodeSalvarLucas);

// ─────────────────────────────────────────────────────────────
// Atualizar conexões — Busca
// ─────────────────────────────────────────────────────────────

// finalizar_busca → verificar_resultado (era → code_in_java)
d.connections['finalizar_busca'].main[0] = [
  { node: 'verificar_resultado', type: 'main', index: 0 },
];

// verificar_resultado → [0] marcar_busca_erro | [1] code_in_java
d.connections['verificar_resultado'] = {
  main: [
    [{ node: 'marcar_busca_erro', type: 'main', index: 0 }],
    [{ node: 'code_in_java', type: 'main', index: 0 }],
  ],
};

// ─────────────────────────────────────────────────────────────
// Atualizar conexões — Mensagens
// ─────────────────────────────────────────────────────────────

// tipo_mensagem1 → horario_comercial (era → set_texto_mensagem1)
d.connections['tipo_mensagem1'].main[0] = [
  { node: 'horario_comercial', type: 'main', index: 0 },
];

// horario_comercial → [0] set_texto_mensagem1 (dentro) | [1] msg_fora_horario (fora)
d.connections['horario_comercial'] = {
  main: [
    [{ node: 'set_texto_mensagem1', type: 'main', index: 0 }],
    [{ node: 'msg_fora_horario', type: 'main', index: 0 }],
  ],
};

// set_texto_mensagem1 → salvar_msg_lead → AI Agent1
d.connections['set_texto_mensagem1'].main[0] = [
  { node: 'salvar_msg_lead', type: 'main', index: 0 },
];
d.connections['salvar_msg_lead'] = {
  main: [[{ node: 'AI Agent1', type: 'main', index: 0 }]],
};

// response_to_whebhook → If3 + salvar_msg_lucas (paralelo)
d.connections['response_to_whebhook'].main[0] = [
  { node: 'If3', type: 'main', index: 0 },
  { node: 'salvar_msg_lucas', type: 'main', index: 0 },
];

// ─────────────────────────────────────────────────────────────
// 7. Número do Anderson via variável de ambiente
//    Configure em n8n: Settings → Variables → ANDERSON_WHATSAPP
// ─────────────────────────────────────────────────────────────
const andersonNode = d.nodes.find(n => n.name === 'HTTP Request');
andersonNode.parameters.bodyParameters.parameters[0].value =
  "={{ $env.ANDERSON_WHATSAPP || '556291386776' }}";

// ─────────────────────────────────────────────────────────────
// 8. Link do catálogo via variável de ambiente
//    Configure em n8n: Settings → Variables → CATALOGO_URL
// ─────────────────────────────────────────────────────────────
const aiNode = d.nodes.find(n => n.name === 'AI Agent1');
aiNode.parameters.options.systemMessage = aiNode.parameters.options.systemMessage.replace(
  'https://drive.google.com/file/d/1cSDGFEBlq3rIHMVeBKUxDdjS9yhPO5Lc/view?usp=sharing',
  "{{ $env.CATALOGO_URL || 'https://drive.google.com/file/d/1cSDGFEBlq3rIHMVeBKUxDdjS9yhPO5Lc/view?usp=sharing' }}"
);

// ─────────────────────────────────────────────────────────────
// apifyNode customBody (mantém igual ao v33)
// ─────────────────────────────────────────────────────────────
apifyNode.parameters.customBody = "={{ JSON.stringify({\n  searchStringsArray: $('mapear_tipo_loja').item.json.searchStringsArray,\n  maxCrawledPlacesPerSearch: $('mapear_tipo_loja').item.json.perSearch,\n  maxResults: $('mapear_tipo_loja').item.json.maxResults,\n  language: 'pt-PT',\n  locationQuery: $('mapear_tipo_loja').item.json.locationQuery\n}) }}";

console.log('v34: perSearch min=4, continueOnFail, verificar_resultado, marcar_busca_erro, horario_comercial, msg_fora_horario, env vars');

d.name = 'Fluxo_4g — Dashboard v2 (v34 maxima-performance)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v34_maxima_performance.json', output);
console.log('Fluxo_4g_v34_maxima_performance.json salvo —', (output.length / 1024).toFixed(1), 'KB');
