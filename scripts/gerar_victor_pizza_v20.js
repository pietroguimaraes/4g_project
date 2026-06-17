const fs = require('fs');
const crypto = require('crypto');

// v20: adiciona nodes de email (Webhook + Gmail) DENTRO do fluxo principal
// Um workflow unico com 2 sub-fluxos independentes — n8n aceita isso normalmente
const INPUT  = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v19.json';
const OUTPUT = 'C:/Users/guima/Downloads/Fluxo_victor_pizza_v20.json';

var d = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
d.name = 'Fluxo Victor Pizza v20 - busca CNPJa + envio de email';
console.log('OK Fluxo principal carregado');

// ── Posiciona os novos nodes abaixo do fluxo principal ────────────────────────
var emailY = 600;
var emailX = 400;

// Node 1: Webhook que recebe a chamada do dashboard quando lead e aprovado
var webhookEmail = {
  id: crypto.randomUUID(),
  name: 'webhook_enviar_email',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [emailX, emailY],
  parameters: {
    httpMethod: 'POST',
    path: 'enviar-email-prospecao',
    responseMode: 'immediately',
    responseData: 'noData'
  },
  webhookId: crypto.randomUUID()
};

// Node 2: Gmail — envia o email de prospeccao
var gmailNode = {
  id: crypto.randomUUID(),
  name: 'enviar_email_gmail',
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2,
  position: [emailX + 240, emailY],
  parameters: {
    sendTo:    '={{ $json.email }}',
    subject:   "={{ 'Proposta de parceria \u2014 ' + $json.empresa }}",
    emailType: 'html',
    message:   buildEmailHtml(),
    options:   {}
  },
  credentials: {
    gmailOAuth2: { id: '1', name: 'Gmail account' }
  }
};

// Adiciona os novos nodes ao workflow existente
d.nodes.push(webhookEmail);
d.nodes.push(gmailNode);
console.log('OK Nodes webhook_enviar_email e enviar_email_gmail adicionados');

// Conecta: webhook_enviar_email -> enviar_email_gmail
d.connections['webhook_enviar_email'] = {
  main: [[{ node: 'enviar_email_gmail', type: 'main', index: 0 }]]
};
console.log('OK Conexao: webhook_enviar_email -> enviar_email_gmail');

// Salva
fs.writeFileSync(OUTPUT, JSON.stringify(d, null, 2));
console.log('\nOK Arquivo salvo: ' + OUTPUT);

// Verificacao
var json = JSON.stringify(d);
console.log('\n=== VERIFICACAO FINAL ===');
[
  ['Nome v20',                  json.includes('Victor Pizza v20')],
  ['webhook_enviar_email',      json.includes('"webhook_enviar_email"')],
  ['enviar_email_gmail',        json.includes('"enviar_email_gmail"')],
  ['Gmail node',                json.includes('n8n-nodes-base.gmail')],
  ['Proposta de parceria',      json.includes('Proposta de parceria')],
  ['$json.email',               json.includes('$json.email')],
  ['$json.empresa',             json.includes('$json.empresa')],
  ['processar_leads',           json.includes('"processar_leads"')],
  ['api.cnpja.com',             json.includes('api.cnpja.com')],
  ['email no HTTP Request6',    json.includes('"email"')],
].forEach(function(c) { console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]); });

console.log('\n=== INSTRUCOES POS-IMPORT ===');
console.log('1. Importa Fluxo_victor_pizza_v20.json no n8n');
console.log('2. No workflow, clica no node "enviar_email_gmail"');
console.log('3. Seleciona sua conta Google no campo Credential');
console.log('4. Clica em "webhook_enviar_email" e copia a URL de producao');
console.log('5. Vercel -> N8N_EMAIL_URL = URL copiada');
console.log('6. Ativa o workflow e testa aprovando um lead no dashboard');

// ── Template HTML do email ────────────────────────────────────────────────────
function buildEmailHtml() {
  var L = [];
  L.push('=<!DOCTYPE html>');
  L.push('<html>');
  L.push('<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">');
  L.push('  <div style="border-left:4px solid #c0392b;padding-left:16px;margin-bottom:24px;">');
  L.push('    <h2 style="margin:0;color:#c0392b;">Proposta de parceria</h2>');
  L.push('    <p style="margin:4px 0 0;color:#888;font-size:14px;">Distribuidora de Pizza Victor</p>');
  L.push('  </div>');
  L.push('  <p>Ol&aacute;, equipe da <strong>{{ $json.empresa }}</strong>!</p>');
  L.push('  <p>Meu nome &eacute; Victor e represento uma distribuidora especializada em');
  L.push('  <strong>pizzas congeladas e resfriadas</strong> com atua&ccedil;&atilde;o em SP, PR, RS e SC.</p>');
  L.push('  <p>Gostar&iacute;amos de apresentar nossa linha de produtos e condi&ccedil;&otilde;es');
  L.push('  comerciais exclusivas para redes e supermercados.</p>');
  L.push('  <p><strong>O que oferecemos:</strong></p>');
  L.push('  <ul>');
  L.push('    <li>Pizzas congeladas e resfriadas em m&uacute;ltiplos sabores e tamanhos</li>');
  L.push('    <li>Entregas programadas com pontualidade garantida</li>');
  L.push('    <li>Alta margem de lucro para o ponto de venda</li>');
  L.push('    <li>Condi&ccedil;&otilde;es especiais para redes</li>');
  L.push('  </ul>');
  L.push('  <p>Pode responder este email para agendarmos uma conversa r&aacute;pida.</p>');
  L.push('  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;">');
  L.push('    <p style="margin:0;"><strong>Victor</strong></p>');
  L.push('    <p style="margin:4px 0 0;color:#888;font-size:13px;">Distribuidora de Pizza | SP, PR, RS, SC</p>');
  L.push('  </div>');
  L.push('</body>');
  L.push('</html>');
  return L.join('\n');
}
