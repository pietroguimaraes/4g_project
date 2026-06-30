const fs = require('fs');

// ─── v2: troca Apollo por Apify HarvestAPI linkedin-profile-search
//
// MUDANÇAS vs v1:
//   FONTE: Apollo mixed_people/search → Apify HarvestAPI (linkedin-profile-search)
//   MODO:  Full + email search (busca email + verifica SMTP embutido)
//   EMAIL: não envia para leads — acumula lista → UM email para o Victor
//   SYNC:  usa endpoint run-sync-gets-dataset-items (bloqueia até completar)
//
// PIPELINE v2:
//   schedule/webhook → calcular_semana → buscar_empresa (Supabase)
//   → montar_harvestapi (monta input com URL LinkedIn da empresa)
//   → buscar_harvestapi_sync (Apify — bloqueia até terminar, retorna items)
//   → processar_leads (valida email corporativo + domínio)
//   → loop_lead (1x1) → checar_dedup → if novo:
//       → salvar_lead (Supabase) → registrar_enviado
//       → loop back
//   → fim_loop → buscar_leads_salvos (Supabase) → montar_lista → enviar_victor (Gmail)
//
// CUSTO ESTIMADO (Claudinho):
//   ~US$0.014/perfil processado | ~40-70% taxa de email encontrado
//   Meta 50 leads/dia → processar ~72-125 perfis/dia → ~US$1-1.75/dia

const SUPABASE_URL  = 'https://tuctjosvxdzbfnyvvodc.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1Y3Rqb3N2eGR6YmZueXZ2b2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTk3MzYsImV4cCI6MjA5NDY5NTczNn0.jPjPQz18lsEdpQLSxQCz2kP0uObAQ1XTs1Kj5qANcko';
const APIFY_TOKEN   = 'APIFY_TOKEN_AQUI';
const APIFY_ACTOR   = 'harvestapi~linkedin-profile-search';
const VICTOR_EMAIL  = 'paradavictor904@gmail.com';
const OUTPUT        = 'C:/Users/guima/Downloads/Fluxo_victor_selfe_v2.json';

const SB_HEADERS = [
  { name: 'apikey',        value: SUPABASE_KEY },
  { name: 'Authorization', value: 'Bearer ' + SUPABASE_KEY },
  { name: 'Content-Type',  value: 'application/json' },
  { name: 'Prefer',        value: 'return=representation' }
];

// ─── Código dos nodes ──────────────────────────────────────────────────────────

const CODE_CALCULAR_SEMANA = `
var hoje = new Date();
var dia  = hoje.getDate();
var semana = dia <= 7 ? 1 : dia <= 14 ? 2 : dia <= 21 ? 3 : 4;

var isWebhook = false;
var user_id   = '';
try {
  var wh = $('webhook_dashboard');
  if (wh && wh.isExecuted) {
    isWebhook = true;
    var body = wh.first().json.body || wh.first().json;
    user_id = body.user_id || '';
  }
} catch(e) {}

console.log('Semana:', semana, '| Dia:', dia, '| Source:', isWebhook ? 'webhook' : 'schedule');
return [{ json: { semana_rotacao: semana, user_id, _source: isWebhook ? 'webhook' : 'schedule' } }];
`.trim();

const CODE_VERIFICAR_EMPRESA = `
var items = $input.all();
var empresa = null;
for (var i = 0; i < items.length; i++) {
  if (items[i].json && items[i].json.id) { empresa = items[i].json; break; }
}
if (!empresa) {
  console.log('Sem empresa ativa para semana', $('calcular_semana').first().json.semana_rotacao);
  return [{ json: { _sem_empresa: true } }];
}
console.log('Empresa ativa:', empresa.nome, '| Meta/dia:', empresa.max_leads_dia);
return [{ json: { ...empresa, _sem_empresa: false } }];
`.trim();

const CODE_MONTAR_HARVESTAPI = `
// Monta input para Apify HarvestAPI linkedin-profile-search
// Usa os filtros nativos do actor (cargos + regioes da tabela victor_empresas)
var empresa = $('verificar_empresa').first().json;

var cargos  = empresa.cargos  || [];
var regioes = empresa.regioes || ['Brasil'];
var metaDia = empresa.max_leads_dia    || 14;
var buffer  = empresa.buffer_multiplo  || 2.5;
var maxItems = Math.ceil(metaDia * buffer);

// Mapeia siglas e nomes de estado/país para o formato do actor
var ESTADO_MAP = {
  'Brasil': 'Brazil', 'Nacional': 'Brazil',
  'SP': 'Sao Paulo, Brazil', 'São Paulo': 'Sao Paulo, Brazil',
  'RJ': 'Rio de Janeiro, Brazil',
  'RS': 'Rio Grande do Sul, Brazil',
  'PR': 'Parana, Brazil',
  'SC': 'Santa Catarina, Brazil',
  'MG': 'Minas Gerais, Brazil',
  'BA': 'Bahia, Brazil',
  'SE': 'Sergipe, Brazil',
  'Santo André': 'Santo Andre, Sao Paulo, Brazil',
  'São Bernardo do Campo': 'Sao Bernardo do Campo, Sao Paulo, Brazil',
  'São Caetano do Sul': 'Sao Caetano do Sul, Sao Paulo, Brazil',
  'Diadema': 'Diadema, Sao Paulo, Brazil',
  'Mauá': 'Maua, Sao Paulo, Brazil',
  'Ribeirão Pires': 'Ribeirao Pires, Sao Paulo, Brazil',
  'Rio Grande da Serra': 'Rio Grande da Serra, Sao Paulo, Brazil'
};

var locationsFilter = regioes.map(function(r) {
  return ESTADO_MAP[r] || r;
});

// Selfe Corp: filtra por empresas com 1000+ funcionários
var companyHeadcountFilter = [];
if ((empresa.min_funcionarios || 0) >= 1000) {
  companyHeadcountFilter = ['1001-5000', '5001-10000', '10001+'];
}

console.log('Empresa:', empresa.nome);
console.log('Cargos:', cargos);
console.log('Localidades:', locationsFilter);
console.log('Max itens:', maxItems, '(buffer', buffer, 'x meta', metaDia, ')');
if (companyHeadcountFilter.length) console.log('Headcount filter:', companyHeadcountFilter);

if (!cargos.length) {
  console.error('ERRO: cargos vazio para empresa', empresa.nome);
  return [{ json: { _erro: 'sem_cargos', empresa_nome: empresa.nome } }];
}

var harvestapiInput = {
  profileScraperMode: 'Full + email search',
  searchQuery:        cargos.join(' OR '),
  locationsFilter:    locationsFilter,
  maxItems:           maxItems,
  proxyConfiguration: { useApifyProxy: true }
};

if (companyHeadcountFilter.length) {
  harvestapiInput.companyHeadcountFilter = companyHeadcountFilter;
}

return [{ json: {
  empresa_id:        empresa.id,
  empresa_nome:      empresa.nome,
  template_email:    empresa.template_email,
  max_leads_dia:     metaDia,
  _harvestapi_input: harvestapiInput,
  _max_items:        maxItems,
  _meta_dia:         metaDia
} }];
`.trim();

const CODE_PROCESSAR_LEADS = `
// Processa perfis retornados pelo HarvestAPI:
//   1. Verifica se tem email
//   2. Filtra domínios pessoais (gmail, hotmail etc.)
//   3. Formata para salvar
// NOTA: sem validação de domínio — Victor quer emails de compradores em OUTRAS empresas

var DOMINIOS_PESSOAIS = [
  'gmail.com','hotmail.com','yahoo.com','outlook.com',
  'uol.com.br','bol.com.br','terra.com.br','ig.com.br',
  'yahoo.com.br','live.com','msn.com','icloud.com',
  'me.com','globomail.com','r7.com','oi.com.br'
];

var input  = $input.all();
var perfis = [];

input.forEach(function(i) {
  var d = i.json;
  if (Array.isArray(d)) { perfis = perfis.concat(d); }
  else if (d.items && Array.isArray(d.items)) { perfis = perfis.concat(d.items); }
  else if (d.id || d.firstName || d.linkedin_url || d.linkedinUrl) { perfis.push(d); }
});

var meta = $('montar_harvestapi').first().json;
console.log('Perfis recebidos do HarvestAPI:', perfis.length);

if (perfis.length === 0) {
  return [{ json: { _sem_resultados: true, empresa_nome: meta.empresa_nome } }];
}

var leads = [];
var desc  = { sem_email: 0, pessoal: 0 };

perfis.forEach(function(p) {
  var email = p.email || p.workEmail || p.personalEmail ||
    (Array.isArray(p.emails) && p.emails.length > 0 ? p.emails[0] : null) || '';

  email = (email || '').toLowerCase().trim();

  if (!email) { desc.sem_email++; return; }

  var dominioEmail = email.split('@')[1] || '';

  if (DOMINIOS_PESSOAIS.indexOf(dominioEmail) !== -1) {
    desc.pessoal++;
    console.log('Pessoal descartado:', email);
    return;
  }

  var nome = ((p.firstName||p.first_name||'') + ' ' + (p.lastName||p.last_name||'')).trim()
    || p.name || p.fullName || '';
  var cargo       = p.jobTitle || p.headline || p.title || p.currentPosition || '';
  var empresa_lead = p.companyName || p.currentCompany || p.company || '';

  leads.push({ json: {
    email,
    nome,
    cargo,
    empresa_nome_lead: empresa_lead,
    linkedin_url:      p.linkedinUrl || p.linkedin_url || p.profileUrl || '',
    empresa_id:        meta.empresa_id,
    empresa_nome:      meta.empresa_nome,
    template_email:    meta.template_email,
    _dominio_email:    dominioEmail
  } });
});

console.log('Leads válidos:', leads.length, '| Sem email:', desc.sem_email, '| Pessoal:', desc.pessoal);
if (leads.length === 0) {
  return [{ json: { _sem_resultados: true, empresa_nome: meta.empresa_nome, _desc: desc } }];
}
return leads;
`.trim();

const CODE_VERIFICAR_DEDUP = `
var items = $input.all();
var jaEnviado = items.some(function(i) { return i.json && i.json.email; });
var lead = $('loop_lead').item.json;
console.log(jaEnviado ? 'DEDUP: duplicado →' : 'DEDUP: novo →', lead.email);
return [{ json: { ...lead, _ja_enviado: jaEnviado } }];
`.trim();

const CODE_MONTAR_LISTA = [
  '// Apos o loop terminar, recebe leads do Supabase e monta lista para Victor.',
  'var items = $input.all();',
  'var leads = [];',
  'items.forEach(function(i) {',
  '  var d = i.json;',
  '  if (d && d.email) leads.push(d);',
  '});',
  '',
  'var empresa_nome = "";',
  'try { empresa_nome = $("verificar_empresa").first().json.nome || ""; } catch(e) {}',
  '',
  'console.log("Leads para Victor:", leads.length, "| Empresa:", empresa_nome);',
  '',
  'if (leads.length === 0) {',
  '  return [{ json: {',
  '    _sem_leads: true,',
  '    _assunto: "Victor - sem leads hoje (" + empresa_nome + ")",',
  '    _corpo: "Nenhum lead com email corporativo valido encontrado hoje para " + empresa_nome + ".\\n\\nO sistema processou perfis do LinkedIn mas nenhum passou nos filtros.\\n\\nAmanha o sistema roda novamente as 8h.",',
  '    _total: 0',
  '  } }];',
  '}',
  '',
  'var linhas = leads.map(function(l, i) {',
  '  return (i+1) + ". " + (l.nome || l.empresa || "") + " - " + (l.cargo_encontrado || l.cargo || "") + " @ " + (l.empresa_encontrada || l.empresa_nome_lead || "") +',
  '    "\\n   Email: " + l.email +',
  '    (l.linkedin_url ? "\\n   LinkedIn: " + l.linkedin_url : "");',
  '});',
  '',
  'var hoje = new Date().toLocaleDateString("pt-BR");',
  'var corpo = "Victor, seguem os leads de hoje (" + hoje + ") para " + empresa_nome + ":\\n\\n" +',
  '  linhas.join("\\n\\n") +',
  '  "\\n\\n---\\nTotal: " + leads.length + " leads com email corporativo verificado." +',
  '  "\\nFonte: LinkedIn (HarvestAPI) - emails verificados por SMTP." +',
  '  "\\nSistema rodara novamente amanha as 8h.";',
  '',
  'return [{ json: {',
  '  _assunto:    "Victor - " + leads.length + " leads hoje: " + empresa_nome,',
  '  _corpo:      corpo,',
  '  _total:      leads.length,',
  '  empresa_nome: empresa_nome',
  '} }];'
].join('\n');

// ─── Nodes ────────────────────────────────────────────────────────────────────

var nodes = [
  {
    id: 'n-sched', name: 'schedule_diario',
    type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
    position: [0, 200],
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * 1-5' }] }
    }
  },
  {
    id: 'n-webhook', name: 'webhook_dashboard',
    type: 'n8n-nodes-base.webhook', typeVersion: 2,
    position: [0, 400],
    parameters: {
      httpMethod: 'POST', path: 'busca-victor-selfe',
      responseMode: 'lastNode', options: {}
    },
    webhookId: 'victor-selfe-v2'
  },
  {
    id: 'n-calc', name: 'calcular_semana',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [260, 300],
    parameters: { jsCode: CODE_CALCULAR_SEMANA, mode: 'runOnceForAllItems' }
  },
  {
    id: 'n-get-emp', name: 'buscar_empresa_supabase',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [500, 300], continueOnFail: true,
    parameters: {
      method: 'GET',
      url: '=' + SUPABASE_URL + '/rest/v1/victor_empresas?semana_rotacao=eq.{{ $json.semana_rotacao }}&ativo=eq.true&select=*&limit=2',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS.filter(function(h){ return h.name !== 'Prefer'; }) },
      options: {}
    }
  },
  {
    id: 'n-verif-emp', name: 'verificar_empresa',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [740, 300],
    parameters: { jsCode: CODE_VERIFICAR_EMPRESA, mode: 'runOnceForAllItems' }
  },
  {
    id: 'n-if-emp', name: 'if_empresa_ativa',
    type: 'n8n-nodes-base.if', typeVersion: 2,
    position: [980, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'c1', leftValue: '={{ $json._sem_empresa }}', rightValue: false, operator: { type: 'boolean', operation: 'equals' } }],
        combinator: 'and'
      }
    }
  },
  {
    id: 'n-search', name: 'criar_search',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [1220, 180], continueOnFail: true,
    parameters: {
      method: 'POST',
      url: SUPABASE_URL + '/rest/v1/searches',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS },
      sendBody: true, contentType: 'raw', rawContentType: 'application/json',
      body: '={{ JSON.stringify({ pais: "Brasil", estado: ($json.regioes && $json.regioes[0]) || "Nacional", cidade: "Nacional", quantidade: Math.min($json.max_leads_dia || 14, 100), status: "PENDENTE", tipo_loja: $json.nome, fonte: "linkedin", empresa_id: $json.id }) }}'
    }
  },
  {
    id: 'n-harvest-inp', name: 'montar_harvestapi',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [1460, 180],
    parameters: { jsCode: CODE_MONTAR_HARVESTAPI, mode: 'runOnceForAllItems' }
  },
  {
    // Node 1/3: inicia o run no Apify e retorna runId + defaultDatasetId
    id: 'n-harvest-start', name: 'iniciar_run_apify',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [1700, 180], continueOnFail: true,
    parameters: {
      method: 'POST',
      url: 'https://api.apify.com/v2/acts/' + APIFY_ACTOR + '/runs?token=' + APIFY_TOKEN,
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'Content-Type', value: 'application/json' }]
      },
      sendBody: true, contentType: 'raw', rawContentType: 'application/json',
      body: '={{ JSON.stringify($json._harvestapi_input) }}',
      options: {}
    }
  },
  {
    // Node 2/3: aguarda 5 minutos para o run completar
    // Para runs maiores, aumentar o tempo aqui
    id: 'n-harvest-wait', name: 'aguardar_run_apify',
    type: 'n8n-nodes-base.wait', typeVersion: 1.1,
    position: [1940, 180],
    parameters: { unit: 'minutes', amount: 15 }
  },
  {
    // Node 3/3: busca os itens do dataset do último run
    id: 'n-harvest-data', name: 'buscar_dataset_apify',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [2180, 180], continueOnFail: true,
    parameters: {
      method: 'GET',
      url: 'https://api.apify.com/v2/acts/' + APIFY_ACTOR + '/runs/last/dataset/items?token=' + APIFY_TOKEN + '&clean=true&format=json',
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'Content-Type', value: 'application/json' }]
      },
      options: {}
    }
  },
  {
    id: 'n-proc', name: 'processar_leads',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [1940, 180],
    parameters: { jsCode: CODE_PROCESSAR_LEADS, mode: 'runOnceForAllItems' }
  },
  {
    id: 'n-if-res', name: 'if_tem_leads',
    type: 'n8n-nodes-base.if', typeVersion: 2,
    position: [2180, 180],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ id: 'c2', leftValue: '={{ !$json._sem_resultados }}', rightValue: true, operator: { type: 'boolean', operation: 'equals' } }],
        combinator: 'and'
      }
    }
  },
  {
    id: 'n-loop', name: 'loop_lead',
    type: 'n8n-nodes-base.splitInBatches', typeVersion: 3,
    position: [2420, 100],
    parameters: { batchSize: 1, options: {} }
  },
  {
    id: 'n-dedup-req', name: 'checar_dedup',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [2660, 100], continueOnFail: true,
    parameters: {
      method: 'GET',
      url: '=' + SUPABASE_URL + '/rest/v1/leads_enviados?email=eq.{{ encodeURIComponent($json.email) }}&enviado_em=gte.{{ new Date(Date.now() - 60*24*60*60*1000).toISOString() }}&select=email&limit=1',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS.filter(function(h){ return h.name !== 'Prefer'; }) },
      options: {}
    }
  },
  {
    id: 'n-dedup-code', name: 'verificar_dedup',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [2900, 100],
    parameters: { jsCode: CODE_VERIFICAR_DEDUP, mode: 'runOnceForAllItems' }
  },
  {
    id: 'n-if-new', name: 'if_lead_novo',
    type: 'n8n-nodes-base.if', typeVersion: 2,
    position: [3140, 100],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'c3', leftValue: '={{ $json._ja_enviado }}', rightValue: false, operator: { type: 'boolean', operation: 'equals' } }],
        combinator: 'and'
      }
    }
  },
  {
    id: 'n-save', name: 'salvar_lead',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [3380, 0], continueOnFail: true,
    parameters: {
      method: 'POST',
      url: SUPABASE_URL + '/rest/v1/leads',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS },
      sendBody: true, contentType: 'raw', rawContentType: 'application/json',
      body: '={{ JSON.stringify({ empresa: $json.empresa_nome_lead || $json.empresa_nome, telefone: "email:" + $json.email, email: $json.email, status: "PROSPECTADOS", categoria: "SUPERMERCADO", empresa_id: $json.empresa_id, cargo_encontrado: $json.cargo, empresa_encontrada: $json.empresa_nome_lead, dominio_email: $json._dominio_email }) }}'
    }
  },
  {
    id: 'n-reg', name: 'registrar_enviado',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [3620, 0], continueOnFail: true,
    parameters: {
      method: 'POST',
      url: SUPABASE_URL + '/rest/v1/leads_enviados',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey',        value: SUPABASE_KEY },
          { name: 'Authorization', value: 'Bearer ' + SUPABASE_KEY },
          { name: 'Content-Type',  value: 'application/json' },
          { name: 'Prefer',        value: 'resolution=ignore-duplicates,return=minimal' }
        ]
      },
      sendBody: true, contentType: 'raw', rawContentType: 'application/json',
      body: '={{ JSON.stringify({ email: $json.email, empresa_id: $json.empresa_id }) }}'
    }
  },
  // Fim do loop: output 1 do SplitInBatches
  // Busca os leads salvos hoje para montar a lista
  {
    id: 'n-buscar-salvos', name: 'buscar_leads_salvos',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [2660, 320], continueOnFail: true,
    parameters: {
      method: 'GET',
      url: '=' + SUPABASE_URL + '/rest/v1/leads?empresa_id=eq.{{ $("verificar_empresa").first().json.id }}&created_at=gte.{{ new Date().toISOString().split("T")[0] }}&status=eq.PROSPECTADOS&select=email,empresa,cargo_encontrado,empresa_encontrada,dominio_email&order=created_at.desc',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS.filter(function(h){ return h.name !== 'Prefer'; }) },
      options: {}
    }
  },
  {
    id: 'n-lista', name: 'montar_lista',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [2900, 320],
    parameters: { jsCode: CODE_MONTAR_LISTA, mode: 'runOnceForAllItems' }
  },
  {
    id: 'n-gmail', name: 'enviar_lista_victor',
    type: 'n8n-nodes-base.gmail', typeVersion: 2.1,
    position: [3140, 320],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: VICTOR_EMAIL,
      subject: '={{ $json._assunto }}',
      emailType: 'text',
      message: '={{ $json._corpo }}',
      options: {}
    },
    credentials: {
      gmailOAuth2: { id: 'GMAIL_CREDENTIAL_ID_AQUI', name: 'Gmail do Victor' }
    }
  },
  {
    id: 'n-patch', name: 'patch_search_concluida',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [3380, 320], continueOnFail: true,
    parameters: {
      method: 'PATCH',
      url: '=' + SUPABASE_URL + '/rest/v1/searches?empresa_id=eq.{{ $("verificar_empresa").first().json.id }}&status=eq.em_andamento',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS },
      sendBody: true, contentType: 'raw', rawContentType: 'application/json',
      body: '={{ JSON.stringify({ status: "CONCLUÍDA", total_encontrados: $("montar_lista").first().json._total || 0 }) }}'
    }
  },
  // NoOps de saída
  {
    id: 'n-sem-emp', name: 'sem_empresa_ativa',
    type: 'n8n-nodes-base.noOp', typeVersion: 1,
    position: [1220, 420], parameters: {}
  },
  {
    id: 'n-sem-res', name: 'sem_resultados_harvestapi',
    type: 'n8n-nodes-base.noOp', typeVersion: 1,
    position: [2420, 320], parameters: {}
  }
];

// ─── Conexões ──────────────────────────────────────────────────────────────────

var connections = {
  'schedule_diario':   { main: [[{ node: 'calcular_semana', type: 'main', index: 0 }]] },
  'webhook_dashboard': { main: [[{ node: 'calcular_semana', type: 'main', index: 0 }]] },
  'calcular_semana':   { main: [[{ node: 'buscar_empresa_supabase', type: 'main', index: 0 }]] },
  'buscar_empresa_supabase': { main: [[{ node: 'verificar_empresa', type: 'main', index: 0 }]] },
  'verificar_empresa': { main: [[{ node: 'if_empresa_ativa', type: 'main', index: 0 }]] },
  'if_empresa_ativa': {
    main: [
      [{ node: 'criar_search',      type: 'main', index: 0 }],
      [{ node: 'sem_empresa_ativa', type: 'main', index: 0 }]
    ]
  },
  'criar_search':      { main: [[{ node: 'montar_harvestapi',    type: 'main', index: 0 }]] },
  'montar_harvestapi': { main: [[{ node: 'iniciar_run_apify',   type: 'main', index: 0 }]] },
  'iniciar_run_apify': { main: [[{ node: 'aguardar_run_apify',  type: 'main', index: 0 }]] },
  'aguardar_run_apify':{ main: [[{ node: 'buscar_dataset_apify',type: 'main', index: 0 }]] },
  'buscar_dataset_apify':{ main: [[{ node: 'processar_leads',   type: 'main', index: 0 }]] },
  'processar_leads': { main: [[{ node: 'if_tem_leads', type: 'main', index: 0 }]] },
  'if_tem_leads': {
    main: [
      [{ node: 'loop_lead',                 type: 'main', index: 0 }],
      [{ node: 'sem_resultados_harvestapi', type: 'main', index: 0 }]
    ]
  },
  'loop_lead': {
    main: [
      [{ node: 'checar_dedup',       type: 'main', index: 0 }],
      [{ node: 'buscar_leads_salvos', type: 'main', index: 0 }]
    ]
  },
  'checar_dedup':   { main: [[{ node: 'verificar_dedup', type: 'main', index: 0 }]] },
  'verificar_dedup': { main: [[{ node: 'if_lead_novo',   type: 'main', index: 0 }]] },
  'if_lead_novo': {
    main: [
      [{ node: 'salvar_lead', type: 'main', index: 0 }],
      [{ node: 'loop_lead',   type: 'main', index: 0 }]
    ]
  },
  'salvar_lead':       { main: [[{ node: 'registrar_enviado', type: 'main', index: 0 }]] },
  'registrar_enviado': { main: [[{ node: 'loop_lead',         type: 'main', index: 0 }]] },
  // Fim do loop → busca salvos → lista → gmail → patch
  'buscar_leads_salvos': { main: [[{ node: 'montar_lista',           type: 'main', index: 0 }]] },
  'montar_lista':        { main: [[{ node: 'enviar_lista_victor',    type: 'main', index: 0 }]] },
  'enviar_lista_victor': { main: [[{ node: 'patch_search_concluida', type: 'main', index: 0 }]] }
};

// ─── Monta JSON ───────────────────────────────────────────────────────────────

var fluxo = {
  name: 'Fluxo Victor Selfe v2 - HarvestAPI LinkedIn multi-empresa',
  nodes, connections,
  active: false,
  settings: { executionOrder: 'v1', saveManualExecutions: true },
  staticData: null,
  tags: [{ name: 'victor' }, { name: 'harvestapi' }, { name: 'linkedin' }],
  pinData: {}
};

// ─── Valida sintaxe dos codes ─────────────────────────────────────────────────

[
  ['calcular_semana',   CODE_CALCULAR_SEMANA],
  ['verificar_empresa', CODE_VERIFICAR_EMPRESA],
  ['montar_harvestapi', CODE_MONTAR_HARVESTAPI],
  ['processar_leads',   CODE_PROCESSAR_LEADS],
  ['verificar_dedup',   CODE_VERIFICAR_DEDUP],
  ['montar_lista',      CODE_MONTAR_LISTA]
].forEach(function(p) {
  try {
    new Function('return async function() { ' + p[1] + ' }');
    console.log('OK Sintaxe:', p[0]);
  } catch(e) {
    console.error('ERRO SINTAXE ' + p[0] + ': ' + e.message);
    process.exit(1);
  }
});

fs.writeFileSync(OUTPUT, JSON.stringify(fluxo, null, 2));
console.log('\nOK Salvo:', OUTPUT);

// ─── Verificação ──────────────────────────────────────────────────────────────

var json = JSON.stringify(fluxo);
console.log('\n=== VERIFICAÇÃO FINAL ===');
[
  ['Nome v2',                          json.includes('Victor Selfe v2')],
  ['HarvestAPI actor correto',         json.includes(APIFY_ACTOR)],
  ['Start run endpoint',               json.includes('/runs?token=')],
  ['Wait 15 min',                      json.includes('aguardar_run_apify')],
  ['Get dataset endpoint',             json.includes('/runs/last/dataset/items')],
  ['LinkedIn URL no banco',            json.includes('linkedin_search_url')],
  ['Buffer multiplo',                  json.includes('buffer_multiplo')],
  ['Filtro domínios pessoais',         json.includes('DOMINIOS_PESSOAIS')],
  ['Dedup 60 dias',                    json.includes('60*24*60*60*1000')],
  ['Loop fecha (registrar→loop)',      fluxo.connections['registrar_enviado'].main[0][0].node === 'loop_lead'],
  ['Fim loop → buscar salvos',         fluxo.connections['loop_lead'].main[1][0].node === 'buscar_leads_salvos'],
  ['Lista → Gmail Victor',             fluxo.connections['montar_lista'].main[0][0].node === 'enviar_lista_victor'],
  ['Gmail → Victor email',             json.includes(VICTOR_EMAIL)],
  ['Gmail → patch search',             fluxo.connections['enviar_lista_victor'].main[0][0].node === 'patch_search_concluida'],
  ['APIFY_TOKEN placeholder',          json.includes('SUA_APIFY_TOKEN_AQUI')],
  ['Total nodes',                      fluxo.nodes.length === 22]
].forEach(function(c) {
  console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]);
});

console.log('\n=== PIPELINE v2 ===');
console.log('schedule (seg-sex 8h) / webhook → calcular_semana (semana do mês)');
console.log('→ Supabase victor_empresas (empresa da semana + linkedin_search_url)');
console.log('→ montar_harvestapi (input com URL + maxItems com buffer 2.5x)');
console.log('→ Apify HarvestAPI sync (bloqueia até completar, retorna perfis com email)');
console.log('→ processar_leads (filtra pessoal + valida domínio)');
console.log('→ loop 1x1 → dedup 60 dias → se novo: salvar + registrar → loop');
console.log('→ fim loop → buscar_leads_salvos (Supabase) → montar_lista → Gmail Victor');
console.log('   Victor recebe: "X leads hoje: nome | cargo | empresa | email | LinkedIn"');

console.log('\n=== 3 PASSOS PARA USAR ===');
console.log('1. Substituir SUA_APIFY_TOKEN_AQUI pela token real do Apify');
console.log('   (Apify > Settings > Integrations > API tokens)');
console.log('2. Configurar credencial Gmail do Victor no node enviar_lista_victor');
console.log('3. PRIMEIRO: rodar manualmente com maxItems=100 para medir taxa e custo');
console.log('   Resultado esperado: 40-70 leads com email | custo ~US$1.40');
