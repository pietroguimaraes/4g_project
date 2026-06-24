const fs = require('fs');

// === v52: Atualiza mensagem de prospecção + adiciona nó de vídeo ===
//
// 1. set_prospectar_dados → adiciona campo "cidade" (necessário para a nova mensagem)
// 2. enviar_prospecao_webhook → nova mensagem do Anderson (PRÓ Importadora)
// 3. Novo nó: enviar_video_prospecao → envia o vídeo do showroom via UazAPI /send/media
//
// ATENÇÃO: O campo "media" do nó de vídeo precisa de uma URL pública do arquivo.
// Arquivo local: C:\Users\guima\Downloads\WhatsApp Video 2026-06-23 at 11.25.39.mp4
// Hospedar no Google Drive (com link direto) e colar a URL na constante VIDEO_URL abaixo.

const VIDEO_URL = 'VIDEO_URL_AQUI'; // <- substitua pela URL pública do vídeo

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_4g_v51_termos_anderson.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_4g_v52_mensagem_video.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── 1. set_prospectar_dados: adicionar campo cidade ─────────────────────────
const nodeSet = d.nodes.find(n => n.name === 'set_prospectar_dados');
nodeSet.parameters.assignments.assignments.push({
  id: 'map-cidade-001',
  name: 'cidade',
  value: '={{ $json.body.cidade }}',
  type: 'string',
});
console.log('v set_prospectar_dados: campo "cidade" adicionado');

// ─── 2. enviar_prospecao_webhook: atualizar mensagem ─────────────────────────
const nodeEnviar = d.nodes.find(n => n.name === 'enviar_prospecao_webhook');
const paramText = nodeEnviar.parameters.bodyParameters.parameters.find(p => p.name === 'text');
paramText.value = `=Passando pra falar com o responsável pela {{ $json.Empresa }}, aí em {{ $json.cidade }} — é exatamente o perfil de loja que eu atendo. Sou o Anderson, da PRÓ, importadora de bolas e itens de variedade, um dos três maiores do país no segmento de bolas.

Nesse vídeo você vê parte do nosso showroom com os itens de maior saída: bola de PVC em vários tamanhos, vinil, upa-upa e linha de variedades.

Como importamos direto da China, o preço chega na sua loja sem intermediário no caminho — o que abre uma margem melhor pra revenda.

Deixo meu contato à disposição. Se quiser conhecer a tabela e as condições, é só me retornar.`;
console.log('v enviar_prospecao_webhook: mensagem atualizada');

// ─── 3. Novo nó: enviar_video_prospecao ──────────────────────────────────────
// Referencia set_prospectar_dados para pegar o número (já que o output do nó
// de texto é a resposta da UazAPI, não os dados do lead)
const novoNo = {
  parameters: {
    method: 'POST',
    url: 'https://secondbrain.uazapi.com/send/media',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: 'token',
          value: '6781e300-9cfe-4d72-9195-aff89f807be2',
        },
      ],
    },
    sendBody: true,
    bodyParameters: {
      parameters: [
        {
          name: 'number',
          value: "={{ $('set_prospectar_dados').first().json.query }}",
        },
        {
          name: 'mediatype',
          value: 'video',
        },
        {
          name: 'media',
          value: VIDEO_URL,
        },
        {
          name: 'filename',
          value: 'showroom_pro.mp4',
        },
      ],
    },
    options: {},
  },
  id: 'enviar-video-prospecao-001',
  name: 'enviar_video_prospecao',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [13400, 10200],
};

d.nodes.push(novoNo);
console.log('v enviar_video_prospecao: nó criado');

// ─── 4. Conectar enviar_prospecao_webhook → enviar_video_prospecao ───────────
d.connections['enviar_prospecao_webhook'] = {
  main: [
    [
      {
        node: 'enviar_video_prospecao',
        type: 'main',
        index: 0,
      },
    ],
  ],
};
console.log('v conexão: enviar_prospecao_webhook → enviar_video_prospecao');

// ─── Salva ────────────────────────────────────────────────────────────────────
d.name = 'Fluxo_4g — Dashboard v2 (v52 mensagem-video-anderson)';
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('v Arquivo salvo:', OUTPUT);

// ─── Verificação ─────────────────────────────────────────────────────────────
console.log('\n=== VERIFICACAO ===');
const setNode    = d.nodes.find(n => n.name === 'set_prospectar_dados');
const envNode    = d.nodes.find(n => n.name === 'enviar_prospecao_webhook');
const videoNode  = d.nodes.find(n => n.name === 'enviar_video_prospecao');
const conn       = d.connections['enviar_prospecao_webhook']?.main?.[0]?.[0]?.node;

console.log('set_prospectar_dados tem cidade:', setNode.parameters.assignments.assignments.some(a => a.name === 'cidade') ? 'v' : 'x');
console.log('mensagem tem "PRO":', envNode.parameters.bodyParameters.parameters.find(p => p.name === 'text')?.value.includes('PRÓ') ? 'v' : 'x');
console.log('mensagem tem {{ $json.cidade }}:', envNode.parameters.bodyParameters.parameters.find(p => p.name === 'text')?.value.includes('$json.cidade') ? 'v' : 'x');
console.log('nó video existe:', videoNode ? 'v' : 'x');
console.log('endpoint video:', videoNode?.parameters?.url);
console.log('conexao texto→video:', conn === 'enviar_video_prospecao' ? 'v' : 'x ' + conn);
console.log('VIDEO_URL preenchida:', VIDEO_URL !== 'VIDEO_URL_AQUI' ? 'v' : 'x PENDENTE — preencher antes de importar!');
