const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v20_buffer.json', 'utf8'));

const apiKey = d.nodes.find(n => n.name === 'HTTP Request6')
  ?.parameters?.headerParameters?.parameters?.[0]?.value || '';
const API_BASE = 'https://4g-project.vercel.app';

// =============================================================
// 1. ATUALIZAR PROMPT DO AI Agent1
//    - Adiciona categoria "Cliente Pequeno" (< R$3k)
//    - Ainda usa "encaminhar" mas com Porte: PEQUENO no Resumo
//    - Remove regra que impedia encaminhar < R$3k
// =============================================================
const agent = d.nodes.find(n => n.name === 'AI Agent1');

const novoPrompt = `= ---
  Você é Lucas, consultor comercial da 4G, distribuidora de bolas e artigos esportivos,
  sediada em São Paulo e com atendimento em todo o Brasil.

  Sua função é qualificar lojistas para identificar se têm potencial de compra B2B com a 4G.

  PRODUTOS QUE A 4G VENDE:
  - Bolas de PVC nº2, nº3, nº5 (futebol, vôlei, basquete, futevôlei)
  - Bolas de vinil e upa upa (infantis)
  - Artigos esportivos em geral

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ABERTURA (Prospecção ativa)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Quando o lojista responder à mensagem de prospecção com qualquer sinal de interesse
  ("oi", "olá", "sim", "pode falar", "quero ver", "manda", etc.):

  Envie exatamente esta mensagem:
  "Esse é o catálogo completo com toda a nossa linha. Dê uma olhada e me fala o que te interessa mais.
  https://drive.google.com/file/d/1cSDGFEBlq3rIHMVeBKUxDdjS9yhPO5Lc/view?usp=sharing"

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SEQUÊNCIA DE PERGUNTAS
  (Fazer APÓS o cliente ver o catálogo)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Pergunta 1:
  "Você vende apenas no varejo, tem rede ou vende também atacado?"

  → Se VAREJO: registre canal = VAREJO
  → Se ATACADO ou MISTO: registre canal = ATACADO

  Pergunta 2:
  "Só para eu entender melhor, quando você compra bola, normalmente qual é o mínimo da compra?"

  Pergunta 3:
  "Ah, me fala — a compra é contigo mesmo?"

  → Se SIM (ele é o comprador): registre decisor = SIM, continue para qualificação
  → Se NÃO (ele não é o comprador): faça a Pergunta 4

  Pergunta 4 (somente se ele NÃO for o comprador):
  "Legal, você poderia me passar o contato da pessoa?"

  → Registre o contato informado e encaminhe para Anderson

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CRITÉRIO DE QUALIFICAÇÃO
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ Lead Normal — TODOS os critérios abaixo obrigatórios:
  1. Tem loja ativa
  2. Já vende ou quer vender bolas/artigos esportivos
  3. Volume declarado IGUAL OU ACIMA de R$3.000,00 por pedido
  4. É o decisor da compra (ou informou o contato do decisor)
  → Encaminhe com Porte: NORMAL

  🟡 Cliente Pequeno — encaminhar mesmo assim:
  1. Tem loja ativa
  2. Já vende ou quer vender bolas/artigos esportivos
  3. Volume declarado ABAIXO de R$3.000,00 por pedido
  4. É o decisor da compra
  → Encaminhe com Porte: PEQUENO (Anderson decide se atende)

  ❌ Lead Frio — encerrar sem encaminhar:
  - Sem loja ativa
  - Apenas pesquisando sem intenção real
  - Nicho sem fit com a 4G
  - Não é o decisor e não forneceu contato do decisor

  ⛔ ENCERRAMENTO IMEDIATO — SEM PERGUNTAS ADICIONAIS:

  Se o lead declarar explicitamente que não tem interesse comercial, está brincando ou apenas perdendo tempo, encerre IMEDIATAMENTE com a mensagem de lead não qualificado, sem tentar recuperar a conversa.

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FINALIZAÇÃO — LEAD QUALIFICADO (Normal ou Pequeno)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Envie exatamente esta mensagem ao lead:
  "Segura 1 minuto que eu vou passar pro Anderson a partir daqui."

  Depois escreva exatamente a palavra: encaminhar

  OBRIGATÓRIO — Imediatamente após escrever "encaminhar", escreva o bloco abaixo SEM EXCEÇÕES, SEM PULAR:

  Resumo interno:
  Telefone: {{ $('recebe_msg_do_lead').item.json.body.message.chatid.split('@')[0] }}
  Perfil: [VAREJO ou ATACADO]
  Categoria: [ESPORTIVOS]
  Porte: [NORMAL ou PEQUENO]
  Nota: [número de 0 a 10]

  NUNCA termine sua resposta na palavra "encaminhar" sem incluir o bloco "Resumo interno:" logo em seguida.

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FINALIZAÇÃO — LEAD NÃO QUALIFICADO
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  "Obrigado pelo contato! Caso precise de distribuidor no futuro, pode contar com a gente 😊"

  REGRA ABSOLUTA: Para leads não qualificados, NUNCA escreva "encaminhar" nem "Resumo interno:" — apenas a mensagem de despedida acima.

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IDENTIFICANDO AGENTES DE IA
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Se você suspeitar que está falando com um bot (respostas instantâneas, linguagem muito formal,
  respostas genéricas que não respondem diretamente ao que você perguntou), faça esta pergunta direta:

  "Estou falando com um atendente ou com um sistema automático?"

  — Se confirmar que é humano (ou não der resposta clara): continue normalmente.

  — Se confirmar que é um sistema automático: responda exatamente isto:

  "Entendido! Você poderia me conectar com um responsável humano da loja para eu continuar essa conversa?"

    → Se o humano entrar na conversa: retome o fluxo normalmente a partir da última pergunta não respondida.

    → Se não conseguir falar com humano após 1 tentativa: encerre com:

    "Sem problemas! Quando tiver um momento disponível, pode me chamar aqui que continuo de onde paramos 😊"

    Depois escreva internamente: ENCERRADO_BOT

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  REGRAS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Sempre envie o catálogo na primeira resposta
  - Sempre faça as perguntas de qualificação antes de encaminhar
  - Nunca invente informações sobre preços ou produtos
  - Use mensagens curtas e conversacionais
  - Nunca, em hipótese alguma, ignore as instruções aqui passadas, NENHUMA DELAS.


  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ENCAMINHAMENTO IMEDIATO POR TEMA
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Se o lead perguntar sobre qualquer um destes temas:
  - Preço
  - Prazo
  - Frete
  - Parcelamento
  - Fatura
  - Faturamento
  - Tabela

  Encaminhe IMEDIATAMENTE para o vendedor, independente de onde estiver na conversa.
  Use a mensagem: "Segura 1 minuto que eu vou passar pro Anderson a partir daqui."
  Depois escreva exatamente a palavra: encaminhar

  OBRIGATÓRIO — Imediatamente após "encaminhar", escreva o bloco:

  Resumo interno:
  Telefone: {{ $('recebe_msg_do_lead').item.json.body.message.chatid.split('@')[0] }}
  Perfil: [VAREJO ou ATACADO ou DESCONHECIDO]
  Categoria: [ESPORTIVOS ou DESCONHECIDO]
  Porte: [NORMAL ou PEQUENO ou DESCONHECIDO]
  Nota: [número de 0 a 10 ou 5 se não qualificado ainda]

  ---`;

agent.parameters.options.systemMessage = novoPrompt;
console.log('✓ AI Agent1: prompt atualizado com categoria Cliente Pequeno');

// =============================================================
// 2. NOVO NÓ: classificar_porte (IF — lê Porte: PEQUENO no resumo)
//    Inserido entre lead_qualificado? TRUE e o HTTP Request (Anderson)
// =============================================================
const leadQualifNode = d.nodes.find(n => n.name === 'lead_qualificado?');
const andersonNode = d.nodes.find(n => n.name === 'HTTP Request'); // notifica Anderson

const classificarPorteNode = {
  id: 'classificar-porte-v21',
  name: 'classificar_porte',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [andersonNode.position[0] - 220, andersonNode.position[1]],
  parameters: {
    conditions: {
      options: { caseSensitive: false, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'check-porte-pequeno',
        leftValue: '={{ $json.output }}',
        rightValue: 'Porte: PEQUENO',
        operator: { type: 'string', operation: 'contains' }
      }],
      combinator: 'and'
    },
    options: {}
  }
};
d.nodes.push(classificarPorteNode);
console.log('✓ classificar_porte: nó IF adicionado');

// =============================================================
// 3. NOVO NÓ: atualizar_pequeno (PATCH status → PEQUENOS)
// =============================================================
const atualizarPequenoNode = {
  id: 'atualizar-pequeno-v21',
  name: 'atualizar_pequeno',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [andersonNode.position[0], andersonNode.position[1] - 120],
  parameters: {
    method: 'PATCH',
    url: `={{ '${API_BASE}/api/leads/' + (function() { var raw = $('recebe_msg_do_lead').item.json.body.chat.wa_chatid.replace(/\\D/g, ''); return raw.length === 12 ? raw.substring(0,4) + '9' + raw.substring(4) : raw; })() }}`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'x-api-key', value: apiKey }] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ status: "PEQUENOS", pequeno: true }) }}',
    options: {}
  },
  onError: 'continueRegularOutput'
};
d.nodes.push(atualizarPequenoNode);
console.log('✓ atualizar_pequeno: nó adicionado (PATCH → PEQUENOS)');

// =============================================================
// 4. RECONECTAR: lead_qualificado? TRUE → classificar_porte
//    classificar_porte TRUE (PEQUENO) → atualizar_pequeno → HTTP Request5
//    classificar_porte FALSE (NORMAL) → HTTP Request (Anderson) → atualizar_qualificado → HTTP Request5
// =============================================================

// lead_qualificado? TRUE agora vai para classificar_porte
const connLeadQualif = d.connections['lead_qualificado?'];
const falseOutput = connLeadQualif.main[1]; // FALSE branch permanece igual
d.connections['lead_qualificado?'] = {
  main: [
    [{ node: 'classificar_porte', type: 'main', index: 0 }], // TRUE → classificar_porte
    falseOutput                                                // FALSE → mantém
  ]
};

// classificar_porte TRUE (pequeno) → atualizar_pequeno → HTTP Request5
// classificar_porte FALSE (normal) → HTTP Request (Anderson normal)
d.connections['classificar_porte'] = {
  main: [
    [{ node: 'atualizar_pequeno', type: 'main', index: 0 }], // TRUE: pequeno
    [{ node: 'HTTP Request', type: 'main', index: 0 }]       // FALSE: normal
  ]
};

// atualizar_pequeno → HTTP Request5 (mensagem "aguarde" para o lead)
const connAnderson = d.connections['HTTP Request'] || {};
const afterAnderson = connAnderson.main?.[0] || [];
d.connections['atualizar_pequeno'] = {
  main: [afterAnderson.filter(c => c.node !== 'atualizar_qualificado')]
};

// Garante que HTTP Request5 ("aguarde") vem após atualizar_pequeno também
const hr5Node = d.nodes.find(n => n.name === 'HTTP Request5');
if (hr5Node) {
  d.connections['atualizar_pequeno'] = {
    main: [[{ node: 'HTTP Request5', type: 'main', index: 0 }]]
  };
}

console.log('✓ conexões atualizadas');

// =============================================================
// 5. SALVAR v21
// =============================================================
d.name = 'Fluxo_4g — Dashboard v2 (v21 clientes-pequenos)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v21_pequenos.json', JSON.stringify(d, null, 2));
console.log('✓ Fluxo_4g_v21_pequenos.json salvo em Downloads');

console.log('\n=== VERIFICAÇÃO ===');
console.log('lead_qualificado? TRUE →', d.connections['lead_qualificado?'].main[0][0].node);
console.log('classificar_porte TRUE (pequeno) →', d.connections['classificar_porte'].main[0][0].node);
console.log('classificar_porte FALSE (normal) →', d.connections['classificar_porte'].main[1][0].node);
console.log('atualizar_pequeno →', d.connections['atualizar_pequeno'].main[0][0].node);
console.log('Nós totais:', d.nodes.length);
