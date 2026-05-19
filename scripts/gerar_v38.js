const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v36_sem_horario.json', 'utf8'));

// === v38: Memória persistente via tabela `messages` (já existente) ===
// O histórico já é salvo por salvar_msg_lead e salvar_msg_lucas.
// Faltava apenas BUSCAR o histórico antes do AI Agent e injetá-lo no prompt.
// Solução: 2 novos nós entre mapear_catalogo e AI Agent1.

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNjkyODc2My1iOGQ5LTQ5YTAtYmY3Yy0wNGIzMmFjMmNhNTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2MjgzNjUxfQ.gc_mgxaHzURxlIs5W0iR2RH2yIQ4BV7pEbyueJ95nGU';

// --- 1. Remover Simple Memory (volátil, sem uso agora) ---
const antesMem = d.nodes.length;
d.nodes = d.nodes.filter(n => n.name !== 'Simple Memory');
delete d.connections['Simple Memory'];
console.log(`✓ Simple Memory removido (${antesMem - d.nodes.length} nó)`);

// --- 2. Adicionar nó buscar_historico (HTTP GET) ---
const urlTelefone = `={{ 'https://4g-project.vercel.app/api/leads/' + (() => { const raw = $('recebe_msg_do_lead').item.json.body.chat.wa_chatid.replace(/\\D/g, ''); return raw.length === 12 ? raw.substring(0,4)+'9'+raw.substring(4) : raw; })() + '/messages' }}`;

d.nodes.push({
  id: 'buscar-historico-v38',
  name: 'buscar_historico',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position: [12500, 10800],
  continueOnFail: true,
  parameters: {
    method: 'GET',
    url: urlTelefone,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: 'x-api-key', value: N8N_API_KEY }],
    },
    options: {},
  },
});
console.log('✓ buscar_historico adicionado');

// --- 3. Adicionar nó formatar_historico (Code) ---
const codigoFormatar = `const resposta = $input.first().json;
const catalogo = $('mapear_catalogo').first().json;

// API retorna array de {role, conteudo} ou objeto de erro
const messages = Array.isArray(resposta) ? resposta : [];

// Últimas 40 mensagens (20 trocas)
const ultimas = messages.slice(-40);

const historicoTexto = ultimas.length > 0
  ? '[Histórico da conversa]\\n' +
    ultimas.map(m => (m.role === 'lead' ? 'Cliente' : 'Lucas') + ': ' + m.conteudo).join('\\n') +
    '\\n\\n[Mensagem atual]\\n'
  : '';

return [{
  json: {
    mensagem: historicoTexto + catalogo.mensagem,
    catalogoSemPreco: catalogo.catalogoSemPreco,
    catalogoComPreco: catalogo.catalogoComPreco,
  }
}];`;

d.nodes.push({
  id: 'formatar-historico-v38',
  name: 'formatar_historico',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [12750, 10800],
  parameters: { jsCode: codigoFormatar },
});
console.log('✓ formatar_historico adicionado');

// --- 4. Atualizar conexões ---

// mapear_catalogo → buscar_historico (era → AI Agent1)
d.connections['mapear_catalogo'].main[0] = [{ node: 'buscar_historico', type: 'main', index: 0 }];
console.log('✓ mapear_catalogo[0] → buscar_historico');

// buscar_historico → formatar_historico
d.connections['buscar_historico'] = {
  main: [[{ node: 'formatar_historico', type: 'main', index: 0 }]],
};
console.log('✓ buscar_historico → formatar_historico');

// formatar_historico → AI Agent1
d.connections['formatar_historico'] = {
  main: [[{ node: 'AI Agent1', type: 'main', index: 0 }]],
};
console.log('✓ formatar_historico → AI Agent1');

// --- Salvar ---
d.name = 'Fluxo_4g — Dashboard v2 (v38 memoria-persistente)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v38_memoria_persistente.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v38_memoria_persistente.json salvo em Downloads');

// --- Verificação ---
const temSimpleMem = d.nodes.some(n => n.name === 'Simple Memory');
const temBuscar = d.nodes.some(n => n.name === 'buscar_historico');
const temFormatar = d.nodes.some(n => n.name === 'formatar_historico');
const conexMapa = d.connections['mapear_catalogo']?.main?.[0]?.[0]?.node;
const conexBuscar = d.connections['buscar_historico']?.main?.[0]?.[0]?.node;
const conexFormatar = d.connections['formatar_historico']?.main?.[0]?.[0]?.node;

console.log('\n=== VERIFICAÇÃO ===');
console.log('Simple Memory removido:', !temSimpleMem ? '✓' : '✗');
console.log('buscar_historico adicionado:', temBuscar ? '✓' : '✗');
console.log('formatar_historico adicionado:', temFormatar ? '✓' : '✗');
console.log('mapear_catalogo → buscar_historico:', conexMapa === 'buscar_historico' ? '✓' : `✗ (${conexMapa})`);
console.log('buscar_historico → formatar_historico:', conexBuscar === 'formatar_historico' ? '✓' : `✗ (${conexBuscar})`);
console.log('formatar_historico → AI Agent1:', conexFormatar === 'AI Agent1' ? '✓' : `✗ (${conexFormatar})`);
