const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v36_sem_horario.json', 'utf8'));

// === v37: Troca Simple Memory (volátil) por Postgres Memory (persistente) ===
// memoryBufferWindow some ao reiniciar o n8n.
// memoryPostgres salva o histórico direto no Supabase — persiste para sempre.

const memNode = d.nodes.find(n => n.name === 'Simple Memory');
if (!memNode) {
  console.error('ERRO: nó Simple Memory não encontrado');
  process.exit(1);
}

// Trocar tipo e parâmetros — manter nome, id e posição (conexões ficam intactas)
memNode.type = '@n8n/n8n-nodes-langchain.memoryPostgres';
memNode.typeVersion = 1.1;
memNode.parameters = {
  sessionIdType: 'customKey',
  sessionKey: "={{ $('recebe_msg_do_lead').item.json.body.chat.phone }}",
  contextWindowLength: 30,
  tableName: 'n8n_chat_histories',
};
memNode.credentials = {
  postgres: {
    // ATENÇÃO: Substituir pelo ID/nome real da credencial PostgreSQL no n8n
    // Configurar em: n8n → Settings → Credentials → New → Postgres
    // Host: db.<seu-projeto>.supabase.co | Port: 5432 | Database: postgres
    // User: postgres | Password: sua senha do Supabase
    id: 'SUPABASE_POSTGRES_CREDENTIAL_ID',
    name: 'Supabase Postgres',
  },
};

console.log('✓ Simple Memory → Postgres Memory (persistente)');
console.log('  sessionKey: telefone do lead');
console.log('  contextWindowLength: 30 mensagens');
console.log('  tableName: n8n_chat_histories');

// --- Salvar ---
d.name = 'Fluxo_4g — Dashboard v2 (v37 memoria-persistente)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v37_memoria_persistente.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v37_memoria_persistente.json salvo em Downloads');

// --- Verificação ---
const memAtualizado = d.nodes.find(n => n.name === 'Simple Memory');
console.log('\n=== VERIFICAÇÃO ===');
console.log('Tipo atualizado para Postgres:', memAtualizado.type === '@n8n/n8n-nodes-langchain.memoryPostgres' ? '✓' : '✗');
console.log('contextWindowLength = 30:', memAtualizado.parameters.contextWindowLength === 30 ? '✓' : '✗');
console.log('Conexão ai_memory intacta (nome não mudou):', d.connections['Simple Memory']?.ai_memory?.[0]?.[0]?.node === 'AI Agent1' ? '✓' : '✗');
console.log('\n⚠️  AÇÃO NECESSÁRIA: Configurar credencial PostgreSQL no n8n antes de importar.');
console.log('   n8n → Settings → Credentials → New Credential → Postgres');
console.log('   Dados do Supabase: Settings → Database → Connection string');
