const fs = require('fs');

const UAZAPI_URL = 'https://secondbrain.uazapi.com/send/text';
const UAZAPI_TOKEN = '6781e300-9cfe-4d72-9195-aff89f807be2';
const ANDERSON_NUMBER = '556291386776';

const fluxo = {
  name: 'Fluxo_4g — Notificar Transferência para Anderson',
  nodes: [
    // 1. Webhook trigger
    {
      id: 'webhook-transferir',
      name: 'receber_transferencia',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [200, 300],
      webhookId: 'transferir-anderson-4g',
      parameters: {
        httpMethod: 'POST',
        path: 'transferir-anderson',
        responseMode: 'responseNode',
        options: {}
      }
    },

    // 2. Responde webhook imediatamente (não bloqueia o dashboard)
    {
      id: 'respond-webhook',
      name: 'responder_ok',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [420, 300],
      parameters: {
        respondWith: 'json',
        responseBody: '={ "ok": true }',
        options: {}
      }
    },

    // 3. IF: pequeno?
    {
      id: 'check-pequeno',
      name: 'cliente_pequeno?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [620, 300],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
          conditions: [{
            id: 'check-pequeno-001',
            leftValue: '={{ $json.body.pequeno }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' }
          }],
          combinator: 'and'
        },
        options: {}
      }
    },

    // 4a. Mensagem para Anderson — Cliente PEQUENO (TRUE)
    {
      id: 'msg-anderson-pequeno',
      name: 'avisar_anderson_pequeno',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.3,
      position: [840, 200],
      parameters: {
        method: 'POST',
        url: UAZAPI_URL,
        sendHeaders: true,
        headerParameters: { parameters: [{ name: 'token', value: UAZAPI_TOKEN }] },
        sendBody: true,
        bodyParameters: {
          parameters: [
            { name: 'number', value: ANDERSON_NUMBER },
            {
              name: 'text',
              value: "=🟡 *Cliente Pequeno* — pedido abaixo de R$3.000\n\n🏪 *Empresa:* {{ $('receber_transferencia').first().json.body.empresa }}\n📱 *Telefone:* {{ $('receber_transferencia').first().json.body.telefone }}\n\nEle demonstrou interesse mas tem capacidade de compra menor. Fica a seu critério atender!"
            }
          ]
        },
        options: { allowUnauthorizedCerts: false }
      },
      onError: 'continueRegularOutput'
    },

    // 4b. Mensagem para Anderson — Transferência NORMAL (FALSE)
    {
      id: 'msg-anderson-normal',
      name: 'avisar_anderson_normal',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.3,
      position: [840, 400],
      parameters: {
        method: 'POST',
        url: UAZAPI_URL,
        sendHeaders: true,
        headerParameters: { parameters: [{ name: 'token', value: UAZAPI_TOKEN }] },
        sendBody: true,
        bodyParameters: {
          parameters: [
            { name: 'number', value: ANDERSON_NUMBER },
            {
              name: 'text',
              value: "=🔔 *Lead qualificado para transferência!*\n\n🏪 *Empresa:* {{ $('receber_transferencia').first().json.body.empresa }}\n📱 *Telefone:* {{ $('receber_transferencia').first().json.body.telefone }}\n\nEle demonstrou interesse e está pronto para ser atendido!"
            }
          ]
        },
        options: { allowUnauthorizedCerts: false }
      },
      onError: 'continueRegularOutput'
    }
  ],

  connections: {
    'receber_transferencia': {
      main: [[
        { node: 'responder_ok', type: 'main', index: 0 },
        { node: 'cliente_pequeno?', type: 'main', index: 0 }
      ]]
    },
    'cliente_pequeno?': {
      main: [
        [{ node: 'avisar_anderson_pequeno', type: 'main', index: 0 }],  // TRUE
        [{ node: 'avisar_anderson_normal', type: 'main', index: 0 }]    // FALSE
      ]
    }
  },

  settings: { executionOrder: 'v1' },
  pinData: {}
};

fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_transferir_anderson.json', JSON.stringify(fluxo, null, 2));
console.log('✓ Fluxo_4g_transferir_anderson.json salvo em Downloads');
console.log('');
console.log('=== APÓS IMPORTAR NO N8N ===');
console.log('1. Ative o fluxo');
console.log('2. Copie a URL do webhook: algo como https://seu-n8n.com/webhook/transferir-anderson');
console.log('3. Cole essa URL na variável N8N_TRANSFERIR_URL no Vercel');
