const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/Users/guima/Downloads/Fluxo_4g_v39_simplificado.json', 'utf8'));

// === v42: Enriquecimento de leads via website ===
// Problema: ~60% dos leads do Apify não têm telefone no Google Maps.
// Solução: para leads SEM telefone mas COM website, visitar o site e extrair
//          número de WhatsApp (wa.me/) ou padrão de telefone brasileiro.
//
// REMOVE: sistema de reserva (verificar_reserva, calcular_estrategia, reserva_suficiente, ativar_reserva, patch_reserva_concluida)
// SUBSTITUI: filtrar_whatsapp → enriquecer_leads (Code node com $helpers.httpRequest)
//
// Lógica do enriquecer_leads:
//   - tem telefone → passa direto
//   - sem telefone + tem website → busca wa.me/ ou padrão de telefone no HTML
//   - sem telefone + sem website → descarta

// -------------------------------------------------------
// 1. Remover sistema de reserva
// -------------------------------------------------------
const NOS_RESERVA = ['verificar_reserva','calcular_estrategia','reserva_suficiente','ativar_reserva','patch_reserva_concluida'];
const antesDe = d.nodes.length;
d.nodes = d.nodes.filter(n => !NOS_RESERVA.includes(n.name));
for (const nome of NOS_RESERVA) delete d.connections[nome];
console.log(`✓ ${antesDe - d.nodes.length} nós de reserva removidos`);

// -------------------------------------------------------
// 2. receber_busca_dashboard → definir_termos (direto)
// -------------------------------------------------------
d.connections['receber_busca_dashboard'].main[0] = [{ node: 'definir_termos', type: 'main', index: 0 }];
console.log('✓ receber_busca_dashboard → definir_termos (direto)');

// -------------------------------------------------------
// 3. Substituir filtrar_whatsapp → enriquecer_leads
// -------------------------------------------------------
const codigoEnriquecimento = `// v42 — enriquecer_leads
// Para cada lead do Apify:
//   ✓ tem telefone → passa direto
//   ✓ sem telefone + tem website → busca wa.me/ ou telefone no HTML
//   ✗ sem telefone + sem website → descarta

const allItems = $input.all();
const quantidade_bruta = allItems.length;
const resultado = [];

for (const item of allItems) {
  const rawTel = (item.json.phone || item.json.phoneUnformatted || '').replace(/\\D/g, '');
  const hasPhone = rawTel.length >= 10;
  const website = item.json.website || '';

  // Já tem telefone — passa direto
  if (hasPhone) {
    resultado.push(item);
    continue;
  }

  // Sem telefone e sem website — descarta
  if (!website) continue;

  // Tem website — tenta extrair telefone/WhatsApp do HTML
  try {
    const response = await $helpers.httpRequest({
      method: 'GET',
      url: website,
      timeout: 8000,
    });

    const html = (typeof response === 'string') ? response : (response.body || response.data || JSON.stringify(response));

    // 1. Procura link wa.me/ (WhatsApp direto)
    const waMatch = html.match(/wa\\.me\\/(\\d{10,15})/);
    if (waMatch) {
      let tel = waMatch[1];
      if (tel.startsWith('55') && tel.length >= 12) tel = tel.substring(2);
      if (tel.length >= 10 && tel.length <= 11) {
        resultado.push({ json: Object.assign({}, item.json, {
          phoneUnformatted: tel,
          phone: tel,
          _fonte_telefone: 'website_wame',
        })});
        continue;
      }
    }

    // 2. Procura padrão de telefone brasileiro no HTML
    const telPatterns = html.match(/\\(?\\d{2}\\)?\\s*9?\\d{4}[-\\s]?\\d{4}/g) || [];
    for (const pat of telPatterns) {
      const tel = pat.replace(/\\D/g, '');
      if (tel.length >= 10 && tel.length <= 11) {
        resultado.push({ json: Object.assign({}, item.json, {
          phoneUnformatted: tel,
          phone: tel,
          _fonte_telefone: 'website_html',
        })});
        break;
      }
    }
    // Se não achou nada, descarta este lead

  } catch(e) {
    // Site inacessível — descarta
  }
}

if (resultado.length === 0) {
  return [{ json: { _sem_resultado: true, _meta_bruta: quantidade_bruta, _meta_filtrada: 0 } }];
}

return resultado.map((item, idx) => ({
  json: Object.assign({}, item.json, {
    _meta_bruta: idx === 0 ? quantidade_bruta : undefined,
    _meta_filtrada: idx === 0 ? resultado.length : undefined,
  })
}));`;

const nodeFW = d.nodes.find(n => n.name === 'filtrar_whatsapp');
nodeFW.name = 'enriquecer_leads';
nodeFW.parameters.jsCode = codigoEnriquecimento;
console.log('✓ filtrar_whatsapp substituído por enriquecer_leads');

// -------------------------------------------------------
// 4. Atualizar chave de conexão e referências
// -------------------------------------------------------
d.connections['enriquecer_leads'] = d.connections['filtrar_whatsapp'];
delete d.connections['filtrar_whatsapp'];

// Atualizar qualquer target que apontava para filtrar_whatsapp
for (const conn of Object.values(d.connections)) {
  for (const outputs of (conn.main || [])) {
    for (const dest of (outputs || [])) {
      if (dest.node === 'filtrar_whatsapp') dest.node = 'enriquecer_leads';
    }
  }
}
console.log('✓ Conexões de filtrar_whatsapp → enriquecer_leads atualizadas');

// -------------------------------------------------------
// 5. Atualizar patch_busca_concluida (referencia filtrar_whatsapp)
// -------------------------------------------------------
const nodePatch = d.nodes.find(n => n.name === 'patch_busca_concluida');
if (nodePatch?.parameters?.jsonBody) {
  nodePatch.parameters.jsonBody = nodePatch.parameters.jsonBody.replaceAll('filtrar_whatsapp', 'enriquecer_leads');
  console.log('✓ patch_busca_concluida atualizado para enriquecer_leads');
}

// -------------------------------------------------------
// Salvar
// -------------------------------------------------------
d.name = 'Fluxo_4g — Dashboard v2 (v42 enriquecimento-website)';
fs.writeFileSync('C:/Users/guima/Downloads/Fluxo_4g_v42_enriquecimento.json', JSON.stringify(d, null, 2));
console.log('\n✓ Fluxo_4g_v42_enriquecimento.json salvo em Downloads');

// -------------------------------------------------------
// Verificação
// -------------------------------------------------------
const temReserva   = NOS_RESERVA.some(n => d.nodes.find(no => no.name === n));
const temEnriquece = d.nodes.some(n => n.name === 'enriquecer_leads');
const temFiltroAntigo = d.nodes.some(n => n.name === 'filtrar_whatsapp');
const conexDB      = d.connections['receber_busca_dashboard']?.main?.[0]?.[0]?.node;
const conexApify   = d.connections['definir_termos']?.main?.[0]?.[0]?.node;
const conexEnriq   = d.connections['enriquecer_leads']?.main?.[0]?.[0]?.node;
const patchRef     = nodePatch?.parameters?.jsonBody || '';

console.log('\n=== VERIFICACAO ===');
console.log('Reserva removida:',                     !temReserva       ? '✓' : '✗');
console.log('enriquecer_leads existe:',               temEnriquece      ? '✓' : '✗');
console.log('filtrar_whatsapp removido:',             !temFiltroAntigo  ? '✓' : '✗');
console.log('receber_busca_dashboard → definir_termos:', conexDB === 'definir_termos' ? '✓' : `✗ (${conexDB})`);
console.log('definir_termos → Run an Actor:',         conexApify === 'Run an Actor and get dataset1' ? '✓' : `✗ (${conexApify})`);
console.log('enriquecer_leads → finalizar_busca:',    conexEnriq === 'finalizar_busca' ? '✓' : `✗ (${conexEnriq})`);
console.log('patch sem ref filtrar_whatsapp:',        !patchRef.includes('filtrar_whatsapp') ? '✓' : '✗');

console.log('\nFluxo:');
console.log('receber_busca_dashboard → definir_termos → Run an Actor → enriquecer_leads → finalizar_busca → ...');
console.log('\nenriquecer_leads (lógica):');
console.log('  tem telefone → passa direto');
console.log('  sem fone + website → $helpers.httpRequest → extrai wa.me/ ou padrão BR');
console.log('  sem fone + sem website → descarta');
