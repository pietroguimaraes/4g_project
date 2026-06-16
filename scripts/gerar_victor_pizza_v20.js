const fs = require('fs');
const crypto = require('crypto');

// v20: fluxo principal (v19) + mini-fluxo de envio de email via Gmail
// Importar o JSON gerado no n8n — ele cria os 2 workflows de uma vez
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v19.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v20.json';

// ── 1. Fluxo principal (baseado no v19) ───────────────────────────────────────
var mainFlow = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
mainFlow.name = 'Fluxo Victor Pizza v20 - busca CNPJa';
console.log('OK Fluxo principal carregado');

// ── 2. Mini-fluxo de envio de email ───────────────────────────────────────────
var posWh    = [400, 300];
var posGmail = [640, 300];

var webhookNode = {
  id: crypto.randomUUID(),
  name: 'webhook_enviar_email',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: posWh,
  parameters: {
    httpMethod: 'POST',
    path: 'enviar-email-prospecao',
    responseMode: 'immediately',
    responseData: 'noData'
  },
  webhookId: crypto.randomUUID()
};

var gmailNode = {
  id: crypto.randomUUID(),
  name: 'Gmail',
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2,
  position: posGmail,
  parameters: {
    sendTo: '={{ $json.email }}',
    subject: "={{ 'Proposta de parceria — ' + $json.empresa }}",
    emailType: 'html',
    message: buildEmailHtml(),
    options: {}
  },
  credentials: {
    gmailOAuth2: {
      id: '1',
      name: 'Gmail account'
    }
  }
};

var emailFlow = {
  id: crypto.randomUUID(),
  name: 'Victor Pizza - Enviar Email de Prospeccao',
  nodes: [webhookNode, gmailNode],
  connections: {
    'webhook_enviar_email': {
      main: [[{ node: 'Gmail', type: 'main', index: 0 }]]
    }
  },
  active: false,
  settings: { executionOrder: 'v1' },
  versionId: crypto.randomUUID()
};

console.log('OK Mini-fluxo de email criado');

// ── 3. Exporta os 2 fluxos num unico arquivo ──────────────────────────────────
// n8n aceita array de workflows no Import from File
var output = [mainFlow, emailFlow];
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// ── Verificacao ───────────────────────────────────────────────────────────────
var json = JSON.stringify(output);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Fluxo principal v20',        json.includes('Victor Pizza v20')],
  ['Mini-fluxo email',           json.includes('Enviar Email')],
  ['webhook_enviar_email',       json.includes('webhook_enviar_email')],
  ['Gmail node',                 json.includes('n8n-nodes-base.gmail')],
  ['email no subject',           json.includes('Proposta de parceria')],
  ['expressao $json.empresa',    json.includes('$json.empresa')],
  ['expressao $json.email',      json.includes('$json.email')],
  ['HTTP Request6 com email',    json.includes('"email"')],
  ['processar_leads',            json.includes('"processar_leads"')],
  ['api.cnpja.com',              json.includes('api.cnpja.com')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== INSTRUCOES ===');
console.log('1. n8n -> Import from File -> seleciona Fluxo_victor_pizza_v20.json');
console.log('2. n8n importa os 2 workflows automaticamente');
console.log('3. Abre "Victor Pizza - Enviar Email de Prospeccao"');
console.log('4. Clica no node Gmail -> seleciona sua conta Google -> salva');
console.log('5. Copia a URL do webhook_enviar_email (ex: .../webhook/enviar-email-prospecao)');
console.log('6. Vercel -> N8N_EMAIL_URL = URL copiada acima');

// ── Template do email ─────────────────────────────────────────────────────────
function buildEmailHtml() {
  var L = [];
  L.push('=<!DOCTYPE html>');
  L.push('<html>');
  L.push('<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">');
  L.push('');
  L.push('  <div style="border-left: 4px solid #c0392b; padding-left: 16px; margin-bottom: 24px;">');
  L.push('    <h2 style="margin: 0; color: #c0392b;">Proposta de parceria</h2>');
  L.push('    <p style="margin: 4px 0 0; color: #888; font-size: 14px;">Distribuidora de Pizza Victor</p>');
  L.push('  </div>');
  L.push('');
  L.push('  <p>Ol&aacute;, equipe da <strong>{{ $json.empresa }}</strong>!</p>');
  L.push('');
  L.push('  <p>Meu nome &eacute; Victor e represento uma distribuidora especializada em');
  L.push('  <strong>pizzas congeladas e resfriadas</strong> com atua&ccedil;&atilde;o em SP, PR, RS e SC.</p>');
  L.push('');
  L.push('  <p>Trabalhamos com grandes redes e supermercados e gostar&iacute;amos de apresentar');
  L.push('  nossa linha de produtos para voc&ecirc;s.</p>');
  L.push('');
  L.push('  <p><strong>O que oferecemos:</strong></p>');
  L.push('  <ul>');
  L.push('    <li>Pizzas congeladas e resfriadas em m&uacute;ltiplos sabores e tamanhos</li>');
  L.push('    <li>Entregas programadas com pontualidade garantida</li>');
  L.push('    <li>Condi&ccedil;&otilde;es comerciais especiais para redes e supermercados</li>');
  L.push('    <li>Alta margem de lucro para o ponto de venda</li>');
  L.push('  </ul>');
  L.push('');
  L.push('  <p>Gostaria de agendar uma conversa r&aacute;pida para apresentar nosso cat&aacute;logo.');
  L.push('  Pode responder este email ou entrar em contato diretamente.</p>');
  L.push('');
  L.push('  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee;">');
  L.push('    <p style="margin: 0;"><strong>Victor</strong></p>');
  L.push('    <p style="margin: 4px 0 0; color: #888; font-size: 13px;">Distribuidora de Pizza | SP, PR, RS, SC</p>');
  L.push('  </div>');
  L.push('');
  L.push('</body>');
  L.push('</html>');
  return L.join('\n');
}
