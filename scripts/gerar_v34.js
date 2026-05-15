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
// 2. Apify: continueOnFail=true + timeout aumentado
//    Se o actor travar/falhar, o fluxo continua e _sem_resultado
//    captura o erro no verificar_resultado logo depois.
//
//    timeout: 300s (5min) — evita que o actor pare cedo em cidades menores
// ─────────────────────────────────────────────────────────────
apifyNode.continueOnFail = true;
apifyNode.parameters.options = apifyNode.parameters.options || {};
apifyNode.parameters.options.timeout = 300000;

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
      ],
    },
    sendBody: true,
    contentType: 'json',
    specifyBody: 'keypair',
    bodyParameters: {
      parameters: [
        { name: 'status', value: 'ERRO' },
        { name: 'quantidade_entregue', value: '={{ $json._total_entregue || 0 }}' },
      ],
    },
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
          // Usa referência ao webhook — funciona tanto no fluxo de texto quanto de áudio
          name: 'number',
          value: "={{ $('recebe_msg_do_lead').item.json.body.chat.wa_chatid.replace(/\\D/g, '') }}",
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

// ─────────────────────────────────────────────────────────────
// 11. Novo node: buscar_lead_tipo (HTTP GET)
//     Busca tipo_loja do lead para selecionar o catálogo correto.
//     continueOnFail=true: se lead não encontrado, mapear_catalogo usa o padrão.
// ─────────────────────────────────────────────────────────────
const nodeBuscarTipo = {
  id: 'buscar-lead-tipo-v34',
  name: 'buscar_lead_tipo',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [12050, 10800],
  continueOnFail: true,
  parameters: {
    method: 'GET',
    url: `={{ '${API_BASE}/leads/' + (() => { const raw = $('recebe_msg_do_lead').item.json.body.chat.wa_chatid.replace(/\\D/g, ''); return raw.length === 12 ? raw.substring(0,4)+'9'+raw.substring(4) : raw; })() }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'x-api-key', value: N8N_API_KEY }],
    },
  },
};

// ─────────────────────────────────────────────────────────────
// 12. Novo node: mapear_catalogo (Code)
//     Mapeia tipo_loja → catalogoSemPreco + catalogoComPreco.
//     Passa mensagem adiante para o AI Agent.
//
//     Variedades/Brinquedos → mesmo catálogo (ambas as versões)
//     Esportes              → catálogo próprio (ambas as versões)
// ─────────────────────────────────────────────────────────────
const nodeMapearCatalogo = {
  id: 'mapear-catalogo-v34',
  name: 'mapear_catalogo',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [12250, 10800],
  parameters: {
    jsCode: `const lead = $input.first().json;
const tipoLoja = (lead && !lead.error) ? (lead.tipo_loja || '') : '';
// Tenta set_texto_mensagem1 (fluxo texto) ou set_texto_audio (fluxo áudio)
let mensagem = '';
try { mensagem = $('set_texto_mensagem1').item.json.mensagem || ''; } catch(e) {}
if (!mensagem) { try { mensagem = $('set_texto_audio').item.json.mensagem || ''; } catch(e) {} }

const MAP_SEM = {
  'Lojas de artigos esportivos':          'https://drive.google.com/file/d/1XH_2HgbwUr1xiNg-YwlTtV24KsjwYzWz/view?usp=sharing',
  'Lojas de Variedades/1,99/miudezas/bazares': 'https://drive.google.com/file/d/11YiyZcIzNFdT3TwIvza86RwHe9bnbxJ8/view?usp=sharing',
  'Lojas de brinquedos':                  'https://drive.google.com/file/d/11YiyZcIzNFdT3TwIvza86RwHe9bnbxJ8/view?usp=sharing',
};
const MAP_COM = {
  'Lojas de artigos esportivos':          'https://drive.google.com/file/d/1AoW1MJ2SqJ0rIVv4JPRgNQi0G24VMCeS/view?usp=sharing',
  'Lojas de Variedades/1,99/miudezas/bazares': 'https://drive.google.com/file/d/1pty9brYjkVj6HKKdOW5_VFsESA2pEGmA/view?usp=sharing',
  'Lojas de brinquedos':                  'https://drive.google.com/file/d/1pty9brYjkVj6HKKdOW5_VFsESA2pEGmA/view?usp=sharing',
};
const DEFAULT_SEM = 'https://drive.google.com/file/d/11YiyZcIzNFdT3TwIvza86RwHe9bnbxJ8/view?usp=sharing';
const DEFAULT_COM = 'https://drive.google.com/file/d/1pty9brYjkVj6HKKdOW5_VFsESA2pEGmA/view?usp=sharing';

return [{ json: {
  mensagem,
  catalogoSemPreco: MAP_SEM[tipoLoja] || DEFAULT_SEM,
  catalogoComPreco: MAP_COM[tipoLoja] || DEFAULT_COM,
} }];`,
  },
};

// ─────────────────────────────────────────────────────────────
// ÁUDIO: transcrição via OpenAI Whisper
// Fluxo: detectar_audio → baixar_audio → transcrever_whisper
//        → horario_audio → set_texto_audio → [salvar_msg_lead, buscar_lead_tipo]
//
// ⚠️  VARIÁVEL NECESSÁRIA: OPENAI_API_KEY em n8n Settings → Variables
// ⚠️  VERIFICAR: se o endpoint uazapi /message/downloadMedia não funcionar,
//     consulte a documentação da sua instância para o endpoint correto.
// ─────────────────────────────────────────────────────────────

// 13. detectar_audio — verifica se a mensagem é áudio/PTT
const nodeDetectarAudio = {
  id: 'detectar-audio-v34',
  name: 'detectar_audio',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [11900, 11300],
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'check-audio',
        leftValue: '={{ $json.body.chat.wa_lastMessageType }}',
        rightValue: 'AudioMessage',
        operator: { type: 'string', operation: 'equals' },
      }],
      combinator: 'and',
    },
    options: {},
  },
};

// 14. baixar_audio — uazapi baixa o arquivo e retorna base64
const nodeBaixarAudio = {
  id: 'baixar-audio-v34',
  name: 'baixar_audio',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [12100, 11300],
  continueOnFail: true,
  parameters: {
    method: 'POST',
    url: `${UAZAPI_URL.replace('/send/text', '')}/message/download`,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'token', value: UAZAPI_TOKEN }],
    },
    sendBody: true,
    contentType: 'json',
    body: '={{ JSON.stringify({ id: $json.body.message.messageid, return_base64: true, generate_mp3: false }) }}',
  },
};

// 15. converter_base64 — converte base64 → binário para o nó OpenAI
const nodeConverterBase64 = {
  id: 'converter-base64-v34',
  name: 'converter_base64',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [12300, 11300],
  parameters: {
    jsCode: `const base64Data = $input.first().json.base64;
const mimeType = $input.first().json.mimetype || 'audio/ogg';
const binaryData = await this.helpers.prepareBinaryData(
  Buffer.from(base64Data, 'base64'),
  'audio.ogg',
  mimeType
);
return [{ json: {}, binary: { data: binaryData } }];`,
  },
};

// 16. transcrever_audio — nó nativo OpenAI Whisper (usa credencial do n8n)
//     Ao importar o workflow, n8n pedirá para mapear a credencial OpenAI.
const nodeTranscreverAudio = {
  id: 'transcrever-audio-v34',
  name: 'transcrever_audio',
  type: '@n8n/n8n-nodes-langchain.openAi',
  typeVersion: 1.7,
  position: [12500, 11300],
  parameters: {
    resource: 'audio',
    operation: 'transcribe',
    options: {},
  },
  credentials: {
    openAiApi: {
      id: 'OPENAI_CRED',
      name: 'OpenAI account',
    },
  },
};

// 17. horario_audio — mesma verificação de horário comercial para áudio
const nodeHorarioAudio = {
  id: 'horario-audio-v34',
  name: 'horario_audio',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [12750, 11300],
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'check-horario-audio',
        leftValue: '={{ (() => { const h = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).replace(/\\D/g,""); return parseInt(h) >= 8 && parseInt(h) < 20; })() }}',
        rightValue: true,
        operator: { type: 'boolean', operation: 'equals' },
      }],
      combinator: 'and',
    },
    options: {},
  },
};

// 18. set_texto_audio — prepara mensagem transcrita no formato do fluxo
const nodeSetTextoAudio = {
  id: 'set-texto-audio-v34',
  name: 'set_texto_audio',
  type: 'n8n-nodes-base.set',
  typeVersion: 3.4,
  position: [12950, 11300],
  parameters: {
    assignments: {
      assignments: [
        {
          id: 'set-mensagem-audio',
          name: 'mensagem',
          value: '={{ $json.text }}',
          type: 'string',
        },
        {
          id: 'set-sender-audio',
          name: 'sender',
          value: "={{ $('recebe_msg_do_lead').item.json.body.chat.wa_name }}",
          type: 'string',
        },
      ],
    },
    options: {},
  },
};

d.nodes.push(nodeVerificarResultado, nodeMarcarErro, nodeHorario, nodeForaHorario, nodeSalvarLead, nodeSalvarLucas, nodeBuscarTipo, nodeMapearCatalogo, nodeDetectarAudio, nodeBaixarAudio, nodeConverterBase64, nodeTranscreverAudio, nodeHorarioAudio, nodeSetTextoAudio);

// ─────────────────────────────────────────────────────────────
// FIX BUG 1 + BUG 2 — Dedup robusto por messageId
//
// PROBLEMA ORIGINAL:
//   registrar_mensagem sobrescrevia staticData[chatId] = ts com o mesmo valor
//   quando o uazapi enviava 2 webhooks do mesmo evento (duplicata comum).
//   verificar_mensagem via staticData[chatId] === ts passava as DUAS execuções,
//   pois o ts era idêntico em ambas.
//
// CONSEQUÊNCIA:
//   BUG 1 — msg_fora_horario disparava 2x (uma por execução duplicada)
//   BUG 2 — AI Agent1 recebia 2–3 chamadas (uma por execução que chegava a mapear_catalogo)
//
// CORREÇÃO (mínima):
//   registrar_mensagem: bloqueia imediatamente se staticData[msgId] já existe
//   (interrompe a duplicata antes mesmo do wait_debounce — sem mudar a lógica de debounce)
//   Continua salvando staticData[chatId] = ts para o debounce anti-rafaga funcionar.
//   verificar_mensagem: inalterado (debounce por chatId continua funcionando).
// ─────────────────────────────────────────────────────────────
const nodeRegistrarMensagem = d.nodes.find(n => n.name === 'registrar_mensagem');
if (nodeRegistrarMensagem) {
  nodeRegistrarMensagem.parameters.jsCode = `const staticData = $getWorkflowStaticData('global');
const chatId = $json.body.chat.wa_chatid || 'default';
const timestamp = $json.body.message.messageTimestamp || Date.now();
const msgId = $json.body.message.messageid || '';

// Dedup robusto por messageId: bloqueia duplicatas do uazapi antes do debounce
if (msgId && staticData['_seen_' + msgId]) {
  return [];
}
if (msgId) {
  staticData['_seen_' + msgId] = true;
  // Limpar entradas antigas (mantém apenas os últimos 200 messageIds para não crescer indefinidamente)
  const keys = Object.keys(staticData).filter(k => k.startsWith('_seen_'));
  if (keys.length > 200) {
    keys.slice(0, keys.length - 200).forEach(k => delete staticData[k]);
  }
}

// Debounce anti-rafaga por chatId (lógica original preservada)
staticData[chatId] = timestamp;
return [{ json: { ...$json, _ts: timestamp, _chatId: chatId } }];`;
}

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

// set_texto_mensagem1 → [salvar_msg_lead (paralelo, dead-end)] + [buscar_lead_tipo → mapear_catalogo → AI Agent1]
d.connections['set_texto_mensagem1'].main[0] = [
  { node: 'salvar_msg_lead', type: 'main', index: 0 },
  { node: 'buscar_lead_tipo', type: 'main', index: 0 },
];
// salvar_msg_lead é dead-end (sem saída) — apenas persiste a mensagem do lead
delete d.connections['salvar_msg_lead'];

// buscar_lead_tipo → mapear_catalogo → AI Agent1
d.connections['buscar_lead_tipo'] = {
  main: [[{ node: 'mapear_catalogo', type: 'main', index: 0 }]],
};
d.connections['mapear_catalogo'] = {
  main: [[{ node: 'AI Agent1', type: 'main', index: 0 }]],
};

// ─────────────────────────────────────────────────────────────
// Conexões — Áudio
// ─────────────────────────────────────────────────────────────

// tipo_mensagem1[1] (sem texto) → detectar_audio (era → HTTP Request4 direto)
d.connections['tipo_mensagem1'].main[1] = [
  { node: 'detectar_audio', type: 'main', index: 0 },
];

// detectar_audio → [0] baixar_audio | [1] HTTP Request4 (formato inválido)
d.connections['detectar_audio'] = {
  main: [
    [{ node: 'baixar_audio', type: 'main', index: 0 }],
    [{ node: 'HTTP Request4', type: 'main', index: 0 }],
  ],
};

// baixar_audio → converter_base64 → transcrever_audio → horario_audio
d.connections['baixar_audio'] = {
  main: [[{ node: 'converter_base64', type: 'main', index: 0 }]],
};
d.connections['converter_base64'] = {
  main: [[{ node: 'transcrever_audio', type: 'main', index: 0 }]],
};
d.connections['transcrever_audio'] = {
  main: [[{ node: 'horario_audio', type: 'main', index: 0 }]],
};

// horario_audio → [0] set_texto_audio | [1] msg_fora_horario (mesmo node do fluxo de texto)
d.connections['horario_audio'] = {
  main: [
    [{ node: 'set_texto_audio', type: 'main', index: 0 }],
    [{ node: 'msg_fora_horario', type: 'main', index: 0 }],
  ],
};

// set_texto_audio → [salvar_msg_lead (paralelo), buscar_lead_tipo (série)] — mesmo padrão do set_texto_mensagem1
d.connections['set_texto_audio'] = {
  main: [[
    { node: 'salvar_msg_lead', type: 'main', index: 0 },
    { node: 'buscar_lead_tipo', type: 'main', index: 0 },
  ]],
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
// 7b. Mensagem de prospecção (aprovada pelo Anderson)
// ─────────────────────────────────────────────────────────────
const prospecaoNode = d.nodes.find(n => n.name === 'enviar_prospecao_webhook');
if (prospecaoNode) {
  const bodyParam = prospecaoNode.parameters?.bodyParameters?.parameters?.find(p => p.name === 'text');
  if (bodyParam) {
    bodyParam.value = '=Olá, {{ $json.Empresa }}! Somos a 4G, importadores de bolas recreativas — bolas de PVC em diversos tamanhos, nº2, nº3, nº5, bolas de vinil, upa upa. Temos também uma linha de brinquedos e itens de variedades.\nNossos produtos são importados da China e ficamos em São Paulo. Se tiver interesse, posso mandar o catálogo — dá uma olhada e nos chama que a gente entra em detalhes.';
  }
}

// ─────────────────────────────────────────────────────────────
// 8. AI Agent — modelo, inteligência e prompt
//
//    Modelo:      gpt-4o (era gpt-4o-mini — melhor raciocínio contextual)
//    Temperature: 0.3    (era padrão 1.0 — mais consistente no seguimento de instruções)
//    MaxTokens:   1000   (suficiente para resposta + resumo interno)
//    Memória:     20 turns (era padrão 5 — cobre conversas longas de qualificação)
//    Prompt:      setado diretamente (não mais via patches frágeis)
// ─────────────────────────────────────────────────────────────

// Modelo: gpt-4o-mini → gpt-4o
const llmNode = d.nodes.find(n => n.name === 'llm_open-ai');
llmNode.parameters.model = { __rl: true, mode: 'list', value: 'gpt-4o' };
llmNode.parameters.options = {
  temperature: 0.3,
  maxTokens: 1000,
};

// Memória: janela de 20 turns (40 mensagens) para cobrir conversas longas
const memNode = d.nodes.find(n => n.name === 'Simple Memory');
memNode.parameters.contextWindowLength = 20;

// Prompt: setado diretamente
const aiNode = d.nodes.find(n => n.name === 'AI Agent1');
const SYSTEM_MESSAGE = `Você é Lucas, consultor comercial da 4G, distribuidora de artigos esportivos, brinquedos e produtos domésticos, sediada em São Paulo com atendimento em todo o Brasil.

PRODUTOS QUE A 4G DISTRIBUI:
Bolas (futebol, futevôlei, vôlei, basquete, borracha infantil), raquetes, patinetes, patins, guarda-sol, cadeira de praia, boias, colete infantil, piscina de bolinhas, baralho, dominó.

SUA MISSÃO:
Qualificar lojistas para identificar potencial de compra B2B. Leads qualificados são encaminhados para o Anderson fechar a venda.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO INICIAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cada lead recebeu previamente esta mensagem de prospecção da 4G:
"Olá, [nome da empresa]! Somos a 4G, importadores de bolas recreativas — bolas de PVC em diversos tamanhos, nº2, nº3, nº5, bolas de vinil, upa upa. Temos também uma linha de brinquedos e itens de variedades. Nossos produtos são importados da China e ficamos em São Paulo. Se tiver interesse, posso mandar o catálogo — dá uma olhada e nos chama que a gente entra em detalhes."

A PRIMEIRA mensagem que você receber de qualquer lead é sempre uma resposta a essa prospecção. Trate como continuação dessa conversa — o lead já sabe quem somos e o que vendemos. Nunca se apresente como se fosse o primeiro contato. (Isso não significa que você deve mencionar a prospecção — nunca diga coisas como "vi que você recebeu nossa mensagem" ou "já que você recebeu nossa prospecção". Apenas responda de forma natural, como se a conversa já estivesse em andamento.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABERTURA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando o lojista responder com qualquer sinal de interesse ("oi", "olá", "sim", "pode falar", "quero ver", "manda", etc.):

Responda de forma natural, espelhando o tom do cliente. Se ele disse só "oi" ou "olá", cumprimente de volta ANTES de enviar o catálogo. Nunca inicie direto com o catálogo sem ao menos uma palavra de resposta ao cumprimento.

Exemplos:
— Cliente disse "oi" ou "olá":
  "Oi! Tudo bem? Já mando nosso catálogo completo pra você dar uma olhada 😊
  {{ $json.catalogoSemPreco }}"

— Cliente disse "pode mandar" ou "quero ver":
  "Claro! Segue o catálogo com toda a nossa linha:
  {{ $json.catalogoSemPreco }}"

— Cliente disse algo mais detalhado:
  Responda ao que ele disse e inclua o catálogo de forma natural na mesma mensagem.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIT CHECK
(Avaliar antes de iniciar as perguntas de qualificação)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Enquanto conversa, identifique se há fit com os produtos da 4G.

SEM FIT — encerre educadamente se o lojista indicar:
- Trabalha exclusivamente com produtos que a 4G não distribui (ex: roupas, alimentos, farmácia, construção, móveis, cosméticos)
- Produz artesanalmente (ex: brinquedos de MDF, artesanato próprio)
- Nicho completamente incompatível mesmo após ver o catálogo

Mensagem para sem-fit:
"Entendido! Nosso foco é em esportivos, brinquedos e domésticos, então pode não ser o match certo pro seu negócio agora. Mas se precisar de distribuidor no futuro, pode contar com a gente! 😊"

IMPORTANTE: Não feche precipitadamente. Se há qualquer dúvida sobre fit, continue qualificando. Só encerre quando o sem-fit for explícito.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATÁLOGO COM PREÇOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se o lead perguntar sobre PREÇO ou TABELA:
→ NÃO encaminhe ainda.
→ Envie exatamente esta mensagem:
  "Claro! Aqui está nosso catálogo com os preços. Dê uma olhada e me fala o que achar!
  {{ $json.catalogoComPreco }}"
→ Continue a conversa normalmente após enviar.
→ Se APÓS este catálogo com preços o lead fizer qualquer nova pergunta (sobre produtos, prazo, frete, parcelamento, etc.) → ENCAMINHE imediatamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEQUÊNCIA DE PERGUNTAS
(Fazer APÓS o cliente ver o catálogo e demonstrar interesse)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pergunta 1:
"Você vende apenas no varejo, tem rede ou vende também atacado?"

→ Se VAREJO: registre canal = VAREJO
→ Se ATACADO ou MISTO: registre canal = ATACADO

Pergunta 2:
"Só para eu entender melhor, quando você compra, normalmente qual é o mínimo da compra?"

Pergunta 3:
"Ah, me fala — a compra é contigo mesmo?"

→ Se SIM: registre decisor = SIM, continue para qualificação
→ Se NÃO: faça a Pergunta 4

Pergunta 4 (somente se ele NÃO for o comprador):
"Legal, você poderia me passar o contato da pessoa?"

→ Registre o contato e encaminhe para Anderson

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENCAMINHAMENTO IMEDIATO POR TEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se o lead perguntar sobre qualquer um destes temas:
- Prazo
- Frete
- Parcelamento
- Fatura
- Faturamento

Encaminhe IMEDIATAMENTE, independente de onde estiver na conversa.
Use: "Segura 1 minuto que eu vou passar pro Anderson a partir daqui."
Depois escreva exatamente: encaminhar

OBRIGATÓRIO — logo após "encaminhar":

Resumo interno:
Telefone: {{ $('recebe_msg_do_lead').item.json.body.message.chatid.split('@')[0] }}
Perfil: [VAREJO ou ATACADO ou DESCONHECIDO]
Categoria: [ESPORTIVOS ou DOMÉSTICOS ou MISTO ou DESCONHECIDO]
Porte: [NORMAL ou PEQUENO ou DESCONHECIDO]
Nota: [0 a 10, ou 5 se ainda não qualificado]
Contexto: [1-2 frases sobre o que foi discutido e por que está encaminhando]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITÉRIO DE QUALIFICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Lead Normal — TODOS obrigatórios:
1. Tem loja ativa
2. Vende ou quer vender produtos compatíveis com a 4G
3. Volume IGUAL OU ACIMA de R$3.000 por pedido
4. É o decisor (ou forneceu contato do decisor)
→ Porte: NORMAL

🟡 Cliente Pequeno — encaminhar mesmo assim:
1. Tem loja ativa
2. Vende ou quer vender produtos compatíveis com a 4G
3. Volume ABAIXO de R$3.000 por pedido
4. É o decisor
→ Porte: PEQUENO (Anderson decide se atende)

❌ Lead Frio — encerrar sem encaminhar:
- Sem loja ativa
- Apenas pesquisando, sem intenção real
- Sem fit com a 4G
- Não é o decisor e não forneceu contato

⛔ ENCERRAMENTO IMEDIATO:
Se o lead declarar explicitamente que não tem interesse comercial, encerre sem tentar recuperar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINALIZAÇÃO — LEAD QUALIFICADO (Normal ou Pequeno)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Envie ao lead:
"Segura 1 minuto que eu vou passar pro Anderson a partir daqui."

Depois escreva exatamente: encaminhar

OBRIGATÓRIO — logo após "encaminhar", sem exceções:

Resumo interno:
Telefone: {{ $('recebe_msg_do_lead').item.json.body.message.chatid.split('@')[0] }}
Perfil: [VAREJO ou ATACADO]
Categoria: [ESPORTIVOS se vende artigos esportivos / DOMÉSTICOS se vende brinquedos, variedades ou domésticos / MISTO se vende ambos]
Porte: [NORMAL ou PEQUENO]
Nota: [0 a 10]

NUNCA termine na palavra "encaminhar" sem o bloco "Resumo interno:" logo em seguida.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINALIZAÇÃO — LEAD NÃO QUALIFICADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Obrigado pelo contato! Caso precise de distribuidor no futuro, pode contar com a gente 😊"

REGRA ABSOLUTA: Para leads não qualificados, NUNCA escreva "encaminhar" nem "Resumo interno:".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIFICANDO AGENTES DE IA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se suspeitar que está falando com um bot (respostas instantâneas, linguagem muito formal, respostas genéricas que não respondem ao que você perguntou), pergunte diretamente:

"Estou falando com um atendente ou com um sistema automático?"

— Se confirmar humano (ou resposta não clara): continue normalmente.

— Se confirmar sistema automático:
  "Entendido! Você poderia me conectar com um responsável humano para eu continuar essa conversa?"

  → Se humano entrar: retome o fluxo normalmente.
  → Se não conseguir após 1 tentativa:
    "Sem problemas! Quando tiver um momento, pode me chamar aqui que continuo de onde paramos 😊"
    Depois escreva internamente: ENCERRADO_BOT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Sempre envie o catálogo na primeira resposta
- Sempre faça as perguntas de qualificação antes de encaminhar
- Nunca invente informações sobre preços ou produtos
- Seja sempre natural e humano. Nunca use frases de bot ("parece que houve um problema", "vou tentar novamente", "ocorreu um erro"). Se o cliente não conseguir abrir o catálogo, reenvie de forma descontraída, como um consultor faria.
- Use mensagens curtas e conversacionais
- Nunca ignore nenhuma instrução deste prompt`;

aiNode.parameters.options = aiNode.parameters.options || {};
aiNode.parameters.options.systemMessage = SYSTEM_MESSAGE;

// ─────────────────────────────────────────────────────────────
// apifyNode customBody (mantém igual ao v33)
// ─────────────────────────────────────────────────────────────
apifyNode.parameters.customBody = "={{ JSON.stringify({\n  searchStringsArray: $('mapear_tipo_loja').item.json.searchStringsArray,\n  maxCrawledPlacesPerSearch: $('mapear_tipo_loja').item.json.perSearch,\n  maxResults: $('mapear_tipo_loja').item.json.maxResults,\n  language: 'pt-PT',\n  locationQuery: $('mapear_tipo_loja').item.json.locationQuery\n}) }}";

console.log('v34: perSearch min=4, continueOnFail, verificar_resultado, marcar_busca_erro, horario_comercial, msg_fora_horario, catálogos dinâmicos por categoria');

d.name = 'Fluxo_4g — Dashboard v2 (v34 maxima-performance)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v34_maxima_performance.json', output);
console.log('Fluxo_4g_v34_maxima_performance.json salvo —', (output.length / 1024).toFixed(1), 'KB');
