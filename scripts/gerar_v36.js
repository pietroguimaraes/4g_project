const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v35_filtro_catalogo.json', 'utf8'));

// === v36: Remove horario_comercial, horario_audio e msg_fora_horario ===
// O agente deve responder no horário que o cliente enviar a mensagem.

// --- 1. Remover os 3 nós ---
const nodosRemover = ['horario_comercial', 'horario_audio', 'msg_fora_horario'];
const antes = d.nodes.length;
d.nodes = d.nodes.filter(n => !nodosRemover.includes(n.name));
const depois = d.nodes.length;
console.log(`✓ Nós removidos: ${antes - depois} (${nodosRemover.join(', ')})`);

// --- 2. tipo_mensagem1 [output 0]: horario_comercial → set_texto_mensagem1 ---
if (d.connections['tipo_mensagem1']?.main?.[0]) {
  d.connections['tipo_mensagem1'].main[0] = [{ node: 'set_texto_mensagem1', type: 'main', index: 0 }];
  console.log('✓ tipo_mensagem1[0]: redirecionado para set_texto_mensagem1');
} else {
  console.error('ERRO: conexão tipo_mensagem1[0] não encontrada');
  process.exit(1);
}

// --- 3. transcrever_audio: horario_audio → set_texto_audio ---
if (d.connections['transcrever_audio']?.main?.[0]) {
  d.connections['transcrever_audio'].main[0] = [{ node: 'set_texto_audio', type: 'main', index: 0 }];
  console.log('✓ transcrever_audio[0]: redirecionado para set_texto_audio');
} else {
  console.error('ERRO: conexão transcrever_audio[0] não encontrada');
  process.exit(1);
}

// --- 4. Remover entradas de conexão dos nós deletados ---
for (const nome of nodosRemover) {
  if (d.connections[nome]) {
    delete d.connections[nome];
    console.log(`✓ Conexões de "${nome}" removidas`);
  }
}

// --- Salvar ---
d.name = 'Fluxo_4g — Dashboard v2 (v36 sem-horario)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v36_sem_horario.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v36_sem_horario.json salvo em Downloads');

// --- Verificação ---
const temHorario = d.nodes.some(n => nodosRemover.includes(n.name));
const conexaoTexto = d.connections['tipo_mensagem1']?.main?.[0]?.[0]?.node;
const conexaoAudio = d.connections['transcrever_audio']?.main?.[0]?.[0]?.node;
console.log('\n=== VERIFICAÇÃO ===');
console.log('Nós de horário removidos:', !temHorario ? '✓' : '✗ AINDA PRESENTES');
console.log('tipo_mensagem1[0] → set_texto_mensagem1:', conexaoTexto === 'set_texto_mensagem1' ? '✓' : `✗ aponta para "${conexaoTexto}"`);
console.log('transcrever_audio[0] → set_texto_audio:', conexaoAudio === 'set_texto_audio' ? '✓' : `✗ aponta para "${conexaoAudio}"`);
