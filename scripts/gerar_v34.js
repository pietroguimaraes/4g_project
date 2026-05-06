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

// 14. baixar_audio — descriptografa o áudio via uazapi
//     Envia os 6 campos de content do webhook, retorna Base64.
//     ⚠️ Endpoint confirmado pelo padrão wuzapi/whatsmeow; verifique na
//        sua instância uazapi se o path é idêntico (/chat/downloadaudio).
const nodeBaixarAudio = {
  id: 'baixar-audio-v34',
  name: 'baixar_audio',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [12100, 11300],
  continueOnFail: true,
  parameters: {
    method: 'POST',
    url: `${UAZAPI_URL.replace('/send/text', '')}/chat/downloadaudio`,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'token', value: UAZAPI_TOKEN }],
    },
    sendBody: true,
    contentType: 'json',
    body: `={{ JSON.stringify({
  Url:          $json.body.message.content.URL,
  Mimetype:     $json.body.message.content.mimetype,
  FileSHA256:   $json.body.message.content.fileSHA256,
  FileLength:   $json.body.message.content.fileLength,
  MediaKey:     $json.body.message.content.mediaKey,
  FileEncSHA256:$json.body.message.content.fileEncSHA256
}) }}`,
  },
};

// 14b. converter_audio — converte Base64 (resposta uazapi) → binário (para Whisper)
//      A resposta do uazapi vem como { Data: "<base64>" }
const nodeConverterAudio = {
  id: 'converter-audio-v34',
  name: 'converter_audio',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [12200, 11300],
  continueOnFail: true,
  parameters: {
    jsCode: `const base64 = $json.Data || $json.data || $json.base64;
if (!base64) {
  // Áudio não pôde ser baixado — passa item vazio para o Whisper tratar com continueOnFail
  return [{ json: { _audio_error: true } }];
}
const buffer = Buffer.from(base64, 'base64');
const binary = await this.helpers.prepareBinaryData(buffer, 'audio.ogg', 'audio/ogg');
return [{ json: {}, binary: { data: binary } }];`,
  },
};

// 15. transcrever_whisper — envia o áudio (binário) para OpenAI Whisper
const nodeTranscreverWhisper = {
  id: 'transcrever-whisper-v34',
  name: 'transcrever_whisper',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [12300, 11300],
  continueOnFail: true,
  parameters: {
    method: 'POST',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'Authorization', value: "={{ 'Bearer ' + $env.OPENAI_API_KEY }}" }],
    },
    sendBody: true,
    contentType: 'multipart-form-data',
    bodyParameters: {
      parameters: [
        { name: 'model', value: 'whisper-1' },
        { name: 'language', value: 'pt' },
        { name: 'file', value: '', parameterType: 'formBinaryData', inputDataFieldName: 'data' },
      ],
    },
  },
};

// 16. horario_audio — mesma verificação de horário comercial para áudio
const nodeHorarioAudio = {
  id: 'horario-audio-v34',
  name: 'horario_audio',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [12500, 11300],
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

// 17. set_texto_audio — prepara mensagem transcrita no formato do fluxo
const nodeSetTextoAudio = {
  id: 'set-texto-audio-v34',
  name: 'set_texto_audio',
  type: 'n8n-nodes-base.set',
  typeVersion: 3.4,
  position: [12700, 11300],
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

d.nodes.push(nodeVerificarResultado, nodeMarcarErro, nodeHorario, nodeForaHorario, nodeSalvarLead, nodeSalvarLucas, nodeBuscarTipo, nodeMapearCatalogo, nodeDetectarAudio, nodeBaixarAudio, nodeConverterAudio, nodeTranscreverWhisper, nodeHorarioAudio, nodeSetTextoAudio);

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

// baixar_audio → converter_audio (Base64→binário) → transcrever_whisper → horario_audio
d.connections['baixar_audio'] = {
  main: [[{ node: 'converter_audio', type: 'main', index: 0 }]],
};
d.connections['converter_audio'] = {
  main: [[{ node: 'transcrever_whisper', type: 'main', index: 0 }]],
};
d.connections['transcrever_whisper'] = {
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
// 8. Catálogos dinâmicos por categoria
//    mapear_catalogo fornece $json.catalogoSemPreco e $json.catalogoComPreco
//    para o AI Agent, baseado no tipo_loja do lead.
//
//    Regras do system message:
//    - Abertura: envia catalogoSemPreco
//    - Cliente pede preço/tabela: envia catalogoComPreco, continua conversa
//    - Após catálogo com preços, qualquer follow-up → encaminhar
// ─────────────────────────────────────────────────────────────
const aiNode = d.nodes.find(n => n.name === 'AI Agent1');
let sm = aiNode.parameters.options.systemMessage;

// 1. Substituir URL hardcoded do catálogo sem preços por referência dinâmica
sm = sm.replace(
  'https://drive.google.com/file/d/1cSDGFEBlq3rIHMVeBKUxDdjS9yhPO5Lc/view?usp=sharing',
  '{{ $json.catalogoSemPreco }}'
);

// 2. Remover Preço e Tabela da lista de encaminhamento imediato
sm = sm.replace('  - Preço\n', '').replace('  - Tabela\n', '');

// 3. Inserir seção CATÁLOGO COM PREÇOS imediatamente antes de ENCAMINHAMENTO IMEDIATO
const SECAO_PRECO = `  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CATÁLOGO COM PREÇOS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Se o lead perguntar sobre PREÇO ou TABELA:
  → NÃO encaminhe ainda.
  → Envie exatamente esta mensagem:
    "Claro! Aqui está nosso catálogo com os preços. Dê uma olhada e me fala o que achar!
    {{ $json.catalogoComPreco }}"
  → Continue a conversa normalmente após enviar.
  → Se APÓS este catálogo com preços o lead fizer qualquer nova pergunta
    (sobre produtos, prazo, frete, parcelamento, etc.) → ENCAMINHE imediatamente.

  `;
sm = sm.replace(
  '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n  ENCAMINHAMENTO IMEDIATO POR TEMA',
  SECAO_PRECO + '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n  ENCAMINHAMENTO IMEDIATO POR TEMA'
);

// 4. ABERTURA: substituir instrução engessada por guia conversacional
sm = sm.replace(
  '  Envie exatamente esta mensagem:\n  "Esse é o catálogo completo com toda a nossa linha. Dê uma olhada e me fala o que te interessa mais.\n  {{ $json.catalogoSemPreco }}"',
  `  Responda de forma natural, espelhando o tom do cliente. Se ele disse só "oi" ou "olá",
  cumprimente de volta ANTES de enviar o catálogo. Nunca inicie direto com o catálogo sem
  ao menos uma palavra de resposta ao cumprimento.

  Exemplos:
  — Cliente disse "oi" ou "olá":
    "Oi! Tudo bem? Já mando nosso catálogo completo pra você dar uma olhada 😊
    {{ $json.catalogoSemPreco }}"

  — Cliente disse "pode mandar" ou "quero ver":
    "Claro! Segue o catálogo com toda a nossa linha:
    {{ $json.catalogoSemPreco }}"

  — Cliente disse algo mais detalhado:
    Responda ao que ele disse e inclua o catálogo de forma natural na mesma mensagem.`
);

// 5. REGRAS: adicionar regra de linguagem humana (anti-bot)
sm = sm.replace(
  '  - Nunca invente informações sobre preços ou produtos',
  '  - Nunca invente informações sobre preços ou produtos\n  - Seja sempre natural e humano. Nunca use frases de bot ("parece que houve um problema", "vou tentar novamente", "ocorreu um erro", etc.). Se o cliente não conseguir abrir o catálogo, reenvie de forma descontraída, como um consultor faria.'
);

// 6. RESUMO INTERNO (encaminhamento imediato): adicionar campo Contexto
sm = sm.replace(
  '  Nota: [número de 0 a 10 ou 5 se não qualificado ainda]\n\n  ---',
  '  Nota: [número de 0 a 10 ou 5 se não qualificado ainda]\n  Contexto: [descreva em 1-2 frases o que foi discutido e por que está encaminhando agora]\n\n  ---'
);

aiNode.parameters.options.systemMessage = sm;

// ─────────────────────────────────────────────────────────────
// apifyNode customBody (mantém igual ao v33)
// ─────────────────────────────────────────────────────────────
apifyNode.parameters.customBody = "={{ JSON.stringify({\n  searchStringsArray: $('mapear_tipo_loja').item.json.searchStringsArray,\n  maxCrawledPlacesPerSearch: $('mapear_tipo_loja').item.json.perSearch,\n  maxResults: $('mapear_tipo_loja').item.json.maxResults,\n  language: 'pt-PT',\n  locationQuery: $('mapear_tipo_loja').item.json.locationQuery\n}) }}";

console.log('v34: perSearch min=4, continueOnFail, verificar_resultado, marcar_busca_erro, horario_comercial, msg_fora_horario, catálogos dinâmicos por categoria');

d.name = 'Fluxo_4g — Dashboard v2 (v34 maxima-performance)';
const output = JSON.stringify(d, null, 2);
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v34_maxima_performance.json', output);
console.log('Fluxo_4g_v34_maxima_performance.json salvo —', (output.length / 1024).toFixed(1), 'KB');
