const fs = require('fs');

// === v53: Corrige parâmetro do nó de vídeo (media → file) ===
// UazAPI espera o campo "file", não "media"

const INPUT  = 'C:/Users/guima/Downloads/Fluxo_4g_v52_mensagem_video.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_4g_v53_fix_video.json';

const d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

const videoNode = d.nodes.find(n => n.name === 'enviar_video_prospecao');
const params = videoNode.parameters.bodyParameters.parameters;

// Renomeia "media" → "file"
const mediaParam = params.find(p => p.name === 'media');
mediaParam.name = 'file';

// Remove "filename" — UazAPI não usa esse campo para /send/media
const filenameIdx = params.findIndex(p => p.name === 'filename');
if (filenameIdx !== -1) params.splice(filenameIdx, 1);

console.log('v enviar_video_prospecao: "media" → "file", "filename" removido');
console.log('Parâmetros finais:', params.map(p => p.name + ': ' + p.value.substring(0, 50)));

d.name = 'Fluxo_4g — Dashboard v2 (v53 fix-video-param)';
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('v Arquivo salvo:', OUTPUT);
