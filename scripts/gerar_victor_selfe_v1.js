const fs = require('fs');

// ─── v1: Fluxo Victor Selfe Corp — sistema multi-empresa
// Diferença fundamental do pizza: fonte é Apollo mixed_people/search (busca por cargo)
// Pipeline: schedule/webhook → empresa ativa (Supabase) → Apollo → validar → dedup → email
//
// Arquitetura (Orion + Claudinho):
//   1 orquestrador que lê a semana do mês e busca empresa ativa no banco
//   1 workflow genérico de execução — os parâmetros da empresa vêm do banco
//   Apollo como única fonte (Apify Google Maps não serve para ICPs de cargo)
//   Verificação: domínio corporativo + dedup global (janela 60 dias)

const SUPABASE_URL = 'https://tuctjosvxdzbfnyvvodc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1Y3Rqb3N2eGR6YmZueXZ2b2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTk3MzYsImV4cCI6MjA5NDY5NTczNn0.jPjPQz18lsEdpQLSxQCz2kP0uObAQ1XTs1Kj5qANcko';
const APOLLO_KEY   = 'osbIKBwqiIxlaknIF1i7aw';
const VICTOR_EMAIL = 'paradavictor904@gmail.com';
const OUTPUT       = 'C:/Users/guima/Downloads/Fluxo_victor_selfe_v1.json';

// Headers Supabase reutilizados em vários nodes
const SB_HEADERS = [
  { name: 'apikey',        value: SUPABASE_KEY },
  { name: 'Authorization', value: 'Bearer ' + SUPABASE_KEY },
  { name: 'Content-Type',  value: 'application/json' },
  { name: 'Prefer',        value: 'return=representation' }
];

// ─── Código dos nodes ──────────────────────────────────────────────────────────

const CODE_CALCULAR_SEMANA = `
// Calcula semana do mês (1-4) para determinar empresa ativa.
// Semana 1: dias 1-7 | Semana 2: dias 8-14 | Semana 3: dias 15-21 | Semana 4: dias 22+
var hoje = new Date();
var dia  = hoje.getDate();
var semana = dia <= 7 ? 1 : dia <= 14 ? 2 : dia <= 21 ? 3 : 4;

// Detecta se foi disparado pelo webhook (dashboard) ou pelo schedule
var isWebhook = false;
var user_id   = '';
var empresa_id_forçado = null;

try {
  var wh = $('webhook_dashboard');
  if (wh && wh.isExecuted) {
    isWebhook = true;
    var body = wh.first().json.body || wh.first().json;
    user_id             = body.user_id    || '';
    empresa_id_forçado  = body.empresa_id || null;
  }
} catch(e) {}

console.log('Semana calculada:', semana, '| Dia:', dia, '| Source:', isWebhook ? 'webhook' : 'schedule');

return [{ json: {
  semana_rotacao:    semana,
  empresa_id_forçado: empresa_id_forçado,
  user_id:           user_id,
  _source:           isWebhook ? 'webhook' : 'schedule',
  _dia:              dia
}}];
`.trim();

const CODE_VERIFICAR_EMPRESA = `
// Verifica se Supabase retornou empresa ativa para a semana calculada.
// Supabase retorna array — pega o primeiro elemento.
var items = $input.all();
var empresa = null;

for (var i = 0; i < items.length; i++) {
  var item = items[i].json;
  if (item && item.id) { empresa = item; break; }
}

if (!empresa) {
  console.log('Nenhuma empresa ativa encontrada para essa semana.');
  return [{ json: { _sem_empresa: true, _motivo: 'sem empresa ativa' } }];
}

console.log('Empresa ativa:', empresa.nome, '| Semana:', empresa.semana_rotacao);
return [{ json: { ...empresa, _sem_empresa: false } }];
`.trim();

const CODE_MONTAR_APOLLO = `
// Monta body dinâmico para Apollo mixed_people/search
// Os filtros são 100% baseados na configuração da empresa — zero hardcode.
var empresa = $input.first().json;

var cargos  = empresa.cargos          || [];
var regioes = empresa.regioes         || [];
var setores = empresa.setores         || [];
var minFunc = empresa.min_funcionarios || 0;

var body = {
  person_titles:         cargos,
  page:                  1,
  per_page:              25,
  reveal_personal_emails: true,
  reveal_phone_number:   false
};

// Filtro geográfico — só aplica se região não for genérica (Nacional / Brasil)
if (regioes.length > 0 && !regioes.includes('Brasil') && !regioes.includes('Nacional')) {
  body.person_locations = regioes.map(function(r) {
    // Adiciona ", Brazil" se for só um nome de cidade/estado
    return (r.includes(',') || r.includes('Brazil')) ? r : r + ', Brazil';
  });
}

// Filtro de tamanho — Selfe Corp (1000+ funcionários)
if (minFunc >= 1000) {
  body.organization_num_employees_ranges = ['1,000,10,000', '10,000,100,000', '100,000+'];
}

// Filtro de setor — DLV (Alimentos/Bebidas/Hospital/etc.)
if (setores && setores.length > 0) {
  var SETOR_MAP = {
    'Alimentos':       'food_production',
    'Bebidas':         'food_beverages',
    'Hospital':        'hospital_health_care',
    'Data Center':     'information_technology_and_services',
    'Shopping Center': 'retail',
    'Hipermercado':    'supermarkets',
    'Supermercado':    'supermarkets',
    'Rede de Varejo Alimentar': 'supermarkets'
  };
  var tags = [];
  setores.forEach(function(s) {
    var tag = SETOR_MAP[s];
    if (tag && tags.indexOf(tag) === -1) tags.push(tag);
  });
  if (tags.length > 0) {
    body.organization_industry_tag_ids = tags;
  }
}

console.log('Apollo query — empresa:', empresa.nome);
console.log('Cargos:', cargos.join(', '));
if (body.person_locations) console.log('Regiões:', body.person_locations.join(', '));
if (body.organization_num_employees_ranges) console.log('Min func:', minFunc + '+');
if (body.organization_industry_tag_ids) console.log('Setores:', body.organization_industry_tag_ids.join(', '));

return [{ json: {
  _apollo_body:   body,
  empresa_id:     empresa.id,
  empresa_nome:   empresa.nome,
  template_email: empresa.template_email,
  leads_meta_mes: empresa.leads_meta_mes,
  _empresa_full:  empresa
}}];
`.trim();

const CODE_PROCESSAR_LEADS = `
// Processa resultados do Apollo:
//   1. Extrai campos dos perfis
//   2. Filtra emails pessoais (gmail, hotmail etc.)
//   3. Valida domínio do email bate com empresa (tip do Claudinho)
//   4. Monta estrutura padrão de lead

var DOMINIOS_PESSOAIS = [
  'gmail.com','hotmail.com','yahoo.com','outlook.com',
  'uol.com.br','bol.com.br','terra.com.br','ig.com.br',
  'yahoo.com.br','live.com','msn.com','icloud.com',
  'me.com','globomail.com','r7.com','oi.com.br'
];

var resposta = $input.first().json;
var pessoas  = resposta.people || [];
var meta     = $('montar_apollo').first().json;

console.log('Pessoas retornadas pelo Apollo:', pessoas.length);

if (pessoas.length === 0) {
  return [{ json: { _sem_resultados: true, empresa_nome: meta.empresa_nome } }];
}

var leads = [];
var descartados = { sem_email: 0, email_pessoal: 0, dominio_nao_bate: 0 };

pessoas.forEach(function(p) {

  // Sem email → descarta
  if (!p.email) { descartados.sem_email++; return; }

  var email        = p.email.toLowerCase().trim();
  var dominioEmail = email.split('@')[1] || '';

  // Email pessoal → descarta
  if (DOMINIOS_PESSOAIS.indexOf(dominioEmail) !== -1) {
    descartados.email_pessoal++;
    console.log('Email pessoal descartado:', email);
    return;
  }

  // Verifica se domínio do email bate com domínio da empresa (evita "pessoa certa, empresa errada")
  var org     = p.organization || {};
  var siteOrg = (org.website_url || org.primary_domain || '')
    .toLowerCase()
    .replace('https://', '').replace('http://', '').replace('www.', '')
    .split('/')[0];

  if (siteOrg) {
    var bateu = dominioEmail === siteOrg
      || dominioEmail.endsWith('.' + siteOrg)
      || siteOrg.endsWith('.' + dominioEmail);

    if (!bateu) {
      descartados.dominio_nao_bate++;
      console.log('Domínio não bate:', email, 'vs', siteOrg, '— descartado');
      return;
    }
  }

  var nome = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.name || 'Comprador';

  leads.push({ json: {
    email:             email,
    nome:              nome,
    cargo:             p.title || '',
    empresa_nome_lead: org.name || p.organization_name || '',
    empresa_site:      siteOrg,
    linkedin_url:      p.linkedin_url || '',
    // Meta da empresa Victor
    empresa_id:        meta.empresa_id,
    empresa_nome:      meta.empresa_nome,
    template_email:    meta.template_email,
    // Para salvar no banco
    _dominio_email:    dominioEmail,
    _dominio_empresa:  siteOrg,
    _apollo_id:        p.id || ''
  }});
});

console.log('Leads válidos:', leads.length, '| Descartados:', JSON.stringify(descartados));

if (leads.length === 0) {
  return [{ json: { _sem_resultados: true, empresa_nome: meta.empresa_nome, _descartados: descartados } }];
}

return leads;
`.trim();

const CODE_VERIFICAR_DEDUP = `
// Verifica se esse lead já foi enviado nos últimos 60 dias.
// Recebe resposta do Supabase GET leads_enviados.
var items = $input.all();
var jaEnviado = false;

for (var i = 0; i < items.length; i++) {
  var item = items[i].json;
  // Se retornou algum registro com o email, é duplicado
  if (item && item.email) {
    jaEnviado = true;
    break;
  }
}

var lead = $('loop_lead').item.json;
console.log(jaEnviado ? 'DEDUP: já enviado →' : 'DEDUP: novo →', lead.email);

return [{ json: { ...lead, _ja_enviado: jaEnviado } }];
`.trim();

const CODE_MONTAR_EMAIL = `
// Preenche o template da empresa com dados do lead.
// Variáveis: {{nome}} {{cargo}} {{empresa}}
var lead = $input.first().json;
var template = lead.template_email || 'Olá {{nome}}, tudo bem?\\n\\nVictor';

var primeiroNome = (lead.nome || 'Comprador').split(' ')[0];

var corpo = template
  .replace(/\\{\\{nome\\}\\}/g,    primeiroNome)
  .replace(/\\{\\{cargo\\}\\}/g,   lead.cargo         || 'gestor de compras')
  .replace(/\\{\\{empresa\\}\\}/g, lead.empresa_nome_lead || 'sua empresa');

var assunto = 'Olá, ' + primeiroNome + ' — ' + (lead.empresa_nome || 'proposta');

console.log('Email montado para:', lead.email, '| Assunto:', assunto);

return [{ json: { ...lead, _corpo_email: corpo, _assunto_email: assunto } }];
`.trim();

// ─── Construção dos nodes ──────────────────────────────────────────────────────

var nodes = [

  // 1. Schedule: seg-sex 8h
  {
    id: 'n-schedule', name: 'schedule_diario',
    type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
    position: [0, 200],
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * 1-5' }] }
    }
  },

  // 2. Webhook: trigger manual do dashboard
  {
    id: 'n-webhook', name: 'webhook_dashboard',
    type: 'n8n-nodes-base.webhook', typeVersion: 2,
    position: [0, 400],
    parameters: {
      httpMethod: 'POST',
      path: 'busca-victor-selfe',
      responseMode: 'lastNode',
      options: {}
    },
    webhookId: 'victor-selfe-webhook'
  },

  // 3. Code: calcula semana do mês → qual empresa rodar
  {
    id: 'n-calc', name: 'calcular_semana',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [280, 300],
    parameters: { jsCode: CODE_CALCULAR_SEMANA, mode: 'runOnceForAllItems' }
  },

  // 4. HTTP: busca empresa ativa no Supabase
  {
    id: 'n-buscar-empresa', name: 'buscar_empresa_supabase',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [520, 300],
    continueOnFail: true,
    parameters: {
      method: 'GET',
      url: '=' + SUPABASE_URL + '/rest/v1/victor_empresas?semana_rotacao=eq.{{ $json.semana_rotacao }}&ativo=eq.true&select=*&limit=2',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS.filter(h => h.name !== 'Prefer') },
      options: { response: { response: { responseFormat: 'json' } } }
    }
  },

  // 5. Code: valida se encontrou empresa
  {
    id: 'n-verif-empresa', name: 'verificar_empresa',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [760, 300],
    parameters: { jsCode: CODE_VERIFICAR_EMPRESA, mode: 'runOnceForAllItems' }
  },

  // 6. IF: tem empresa ativa?
  {
    id: 'n-if-empresa', name: 'if_empresa_ativa',
    type: 'n8n-nodes-base.if', typeVersion: 2,
    position: [1000, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'c1', leftValue: '={{ $json._sem_empresa }}', rightValue: false, operator: { type: 'boolean', operation: 'equals' } }],
        combinator: 'and'
      }
    }
  },

  // 7. HTTP: cria registro de search no Supabase
  {
    id: 'n-criar-search', name: 'criar_search',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [1240, 200],
    parameters: {
      method: 'POST',
      url: SUPABASE_URL + '/rest/v1/searches',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS },
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'application/json',
      body: '={{ JSON.stringify({ status: "em_andamento", tipo_loja: $json.nome, quantidade_pedida: $json.leads_meta_mes || 50, empresa_id: $json.id }) }}'
    }
  },

  // 8. Code: monta query Apollo dinamicamente
  {
    id: 'n-apollo-query', name: 'montar_apollo',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [1480, 200],
    parameters: { jsCode: CODE_MONTAR_APOLLO, mode: 'runOnceForAllItems' }
  },

  // 9. HTTP: chama Apollo mixed_people/search
  {
    id: 'n-apollo', name: 'buscar_apollo',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [1720, 200],
    continueOnFail: true,
    parameters: {
      method: 'POST',
      url: 'https://api.apollo.io/api/v1/mixed_people/search',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'X-Api-Key',    value: APOLLO_KEY },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Cache-Control', value: 'no-cache' }
        ]
      },
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'application/json',
      body: '={{ JSON.stringify($json._apollo_body) }}'
    }
  },

  // 10. IF: Apollo retornou resultados?
  {
    id: 'n-if-apollo', name: 'if_tem_resultados',
    type: 'n8n-nodes-base.if', typeVersion: 2,
    position: [1960, 200],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ id: 'c2', leftValue: '={{ $json.people && $json.people.length > 0 }}', rightValue: true, operator: { type: 'boolean', operation: 'equals' } }],
        combinator: 'and'
      }
    }
  },

  // 11. Code: processa e valida leads
  {
    id: 'n-processar', name: 'processar_leads',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [2200, 100],
    parameters: { jsCode: CODE_PROCESSAR_LEADS, mode: 'runOnceForAllItems' }
  },

  // 12. SplitInBatches: processa 1 lead por vez
  {
    id: 'n-loop', name: 'loop_lead',
    type: 'n8n-nodes-base.splitInBatches', typeVersion: 3,
    position: [2440, 100],
    parameters: { batchSize: 1, options: {} }
  },

  // 13. HTTP: verifica dedup no Supabase (leads enviados nos últimos 60 dias)
  {
    id: 'n-dedup', name: 'checar_dedup',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [2680, 100],
    continueOnFail: true,
    parameters: {
      method: 'GET',
      url: '=' + SUPABASE_URL + '/rest/v1/leads_enviados?email=eq.{{ encodeURIComponent($json.email) }}&enviado_em=gte.{{ new Date(Date.now() - 60*24*60*60*1000).toISOString() }}&select=email&limit=1',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS.filter(h => h.name !== 'Prefer') },
      options: {}
    }
  },

  // 14. Code: verifica resultado do dedup
  {
    id: 'n-verif-dedup', name: 'verificar_dedup',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [2920, 100],
    parameters: { jsCode: CODE_VERIFICAR_DEDUP, mode: 'runOnceForAllItems' }
  },

  // 15. IF: é novo (não está em leads_enviados)?
  {
    id: 'n-if-novo', name: 'if_lead_novo',
    type: 'n8n-nodes-base.if', typeVersion: 2,
    position: [3160, 100],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'c3', leftValue: '={{ $json._ja_enviado }}', rightValue: false, operator: { type: 'boolean', operation: 'equals' } }],
        combinator: 'and'
      }
    }
  },

  // 16. HTTP: salva lead no Supabase
  {
    id: 'n-salvar', name: 'salvar_lead',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [3400, 0],
    continueOnFail: true,
    parameters: {
      method: 'POST',
      url: SUPABASE_URL + '/rest/v1/leads',
      sendHeaders: true,
      headerParameters: { parameters: SB_HEADERS },
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'application/json',
      body: '={{ JSON.stringify({ empresa: $json.empresa_nome_lead || $json.empresa_nome, telefone: "email:" + $json.email, email: $json.email, status: "PROSPECTADOS", categoria: "SUPERMERCADO", empresa_id: $json.empresa_id, cargo_encontrado: $json.cargo, empresa_encontrada: $json.empresa_nome_lead, dominio_email: $json._dominio_email }) }}'
    }
  },

  // 17. Code: monta corpo do email com template da empresa
  {
    id: 'n-email-body', name: 'montar_email',
    type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [3640, 0],
    parameters: { jsCode: CODE_MONTAR_EMAIL, mode: 'runOnceForAllItems' }
  },

  // 18. Gmail: envia email personalizado
  {
    id: 'n-gmail', name: 'enviar_email_gmail',
    type: 'n8n-nodes-base.gmail', typeVersion: 2.1,
    position: [3880, 0],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: '={{ $json.email }}',
      subject: '={{ $json._assunto_email }}',
      emailType: 'text',
      message: '={{ $json._corpo_email }}',
      options: {}
    },
    credentials: {
      gmailOAuth2: { id: 'GMAIL_CREDENTIAL_ID_AQUI', name: 'Gmail do Victor' }
    }
  },

  // 19. HTTP: registra em leads_enviados (dedup global)
  {
    id: 'n-registrar', name: 'registrar_enviado',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [4120, 0],
    continueOnFail: true,
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
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'application/json',
      body: '={{ JSON.stringify({ email: $json.email, empresa_id: $json.empresa_id }) }}'
    }
  },

  // 20. NoOp: sem empresa ativa (fim do fluxo early exit)
  {
    id: 'n-sem-empresa', name: 'sem_empresa_ativa',
    type: 'n8n-nodes-base.noOp', typeVersion: 1,
    position: [1240, 400],
    parameters: {}
  },

  // 21. NoOp: Apollo sem resultados
  {
    id: 'n-sem-apollo', name: 'sem_resultados_apollo',
    type: 'n8n-nodes-base.noOp', typeVersion: 1,
    position: [2200, 300],
    parameters: {}
  },

  // 22. NoOp: fim do loop (todos os leads processados)
  {
    id: 'n-fim-loop', name: 'fim_loop',
    type: 'n8n-nodes-base.noOp', typeVersion: 1,
    position: [2680, 280],
    parameters: {}
  }
];

// ─── Conexões ──────────────────────────────────────────────────────────────────

var connections = {

  // Ambos os triggers → calcular_semana
  'schedule_diario':  { main: [[{ node: 'calcular_semana', type: 'main', index: 0 }]] },
  'webhook_dashboard':{ main: [[{ node: 'calcular_semana', type: 'main', index: 0 }]] },

  // Semana calculada → buscar empresa no Supabase
  'calcular_semana': { main: [[{ node: 'buscar_empresa_supabase', type: 'main', index: 0 }]] },

  // Supabase retorna → verificar se encontrou empresa
  'buscar_empresa_supabase': { main: [[{ node: 'verificar_empresa', type: 'main', index: 0 }]] },
  'verificar_empresa':       { main: [[{ node: 'if_empresa_ativa',  type: 'main', index: 0 }]] },

  // IF empresa: true (output 0) → criar search | false (output 1) → sem_empresa
  'if_empresa_ativa': {
    main: [
      [{ node: 'criar_search',       type: 'main', index: 0 }],  // true
      [{ node: 'sem_empresa_ativa',  type: 'main', index: 0 }]   // false
    ]
  },

  // criar_search → montar query Apollo → buscar Apollo
  'criar_search':  { main: [[{ node: 'montar_apollo', type: 'main', index: 0 }]] },
  'montar_apollo': { main: [[{ node: 'buscar_apollo', type: 'main', index: 0 }]] },
  'buscar_apollo': { main: [[{ node: 'if_tem_resultados', type: 'main', index: 0 }]] },

  // IF Apollo: true → processar | false → sem_resultados
  'if_tem_resultados': {
    main: [
      [{ node: 'processar_leads',      type: 'main', index: 0 }],  // true
      [{ node: 'sem_resultados_apollo', type: 'main', index: 0 }]  // false
    ]
  },

  // processar leads → loop
  'processar_leads': { main: [[{ node: 'loop_lead', type: 'main', index: 0 }]] },

  // loop_lead: output 0 (tem item) → checar dedup | output 1 (done) → fim_loop
  'loop_lead': {
    main: [
      [{ node: 'checar_dedup', type: 'main', index: 0 }],  // output 0: processa
      [{ node: 'fim_loop',     type: 'main', index: 0 }]   // output 1: done
    ]
  },

  // checar_dedup → verificar_dedup → if_lead_novo
  'checar_dedup':   { main: [[{ node: 'verificar_dedup', type: 'main', index: 0 }]] },
  'verificar_dedup': { main: [[{ node: 'if_lead_novo',   type: 'main', index: 0 }]] },

  // IF lead novo: true → salvar | false → volta ao loop (pula lead)
  'if_lead_novo': {
    main: [
      [{ node: 'salvar_lead', type: 'main', index: 0 }],  // true: novo, processa
      [{ node: 'loop_lead',   type: 'main', index: 0 }]   // false: duplicado, pula
    ]
  },

  // Pipeline de envio: salvar → montar email → gmail → registrar → volta ao loop
  'salvar_lead':       { main: [[{ node: 'montar_email',       type: 'main', index: 0 }]] },
  'montar_email':      { main: [[{ node: 'enviar_email_gmail', type: 'main', index: 0 }]] },
  'enviar_email_gmail':{ main: [[{ node: 'registrar_enviado',  type: 'main', index: 0 }]] },
  'registrar_enviado': { main: [[{ node: 'loop_lead',          type: 'main', index: 0 }]] }  // volta ao loop
};

// ─── Monta JSON do fluxo ───────────────────────────────────────────────────────

var fluxo = {
  name: 'Fluxo Victor Selfe v1 - Apollo multi-empresa',
  nodes: nodes,
  connections: connections,
  active: false,
  settings: {
    executionOrder: 'v1',
    saveManualExecutions: true,
    callerPolicy: 'workflowsFromSameOwner',
    errorWorkflow: ''
  },
  staticData: null,
  tags: [{ name: 'victor' }, { name: 'selfe-corp' }, { name: 'apollo' }],
  pinData: {}
};

// ─── Valida código JS dos nodes ───────────────────────────────────────────────

var codesToValidate = [
  ['calcular_semana',   CODE_CALCULAR_SEMANA],
  ['montar_apollo',     CODE_MONTAR_APOLLO],
  ['processar_leads',   CODE_PROCESSAR_LEADS],
  ['verificar_dedup',   CODE_VERIFICAR_DEDUP],
  ['montar_email',      CODE_MONTAR_EMAIL]
];

codesToValidate.forEach(function(pair) {
  try {
    new Function('return async function() { ' + pair[1] + ' }');
    console.log('OK Sintaxe válida:', pair[0]);
  } catch(e) {
    console.error('ERRO SINTAXE ' + pair[0] + ': ' + e.message);
    process.exit(1);
  }
});

// ─── Salva ─────────────────────────────────────────────────────────────────────

fs.writeFileSync(OUTPUT, JSON.stringify(fluxo, null, 2));
console.log('\nOK Arquivo salvo:', OUTPUT);

// ─── Verificação final ─────────────────────────────────────────────────────────

var json = JSON.stringify(fluxo);
console.log('\n=== VERIFICAÇÃO FINAL ===');
[
  ['Nome correto',                 json.includes('Victor Selfe v1')],
  ['Schedule seg-sex 8h',         json.includes('0 8 * * 1-5')],
  ['Webhook path correto',        json.includes('busca-victor-selfe')],
  ['Apollo endpoint correto',     json.includes('mixed_people/search')],
  ['APOLLO_KEY presente',         json.includes(APOLLO_KEY)],
  ['Supabase victor_empresas',    json.includes('victor_empresas')],
  ['Supabase leads_enviados',     json.includes('leads_enviados')],
  ['Gmail node presente',         json.includes('n8n-nodes-base.gmail')],
  ['Filtro domínio corporativo',  json.includes('DOMINIOS_PESSOAIS')],
  ['Verificação domínio empresa', json.includes('dominio_nao_bate')],
  ['Dedup 60 dias',               json.includes('60*24*60*60*1000')],
  ['Loop SplitInBatches',         json.includes('splitInBatches')],
  ['Loop fecha (registrar→loop)', fluxo.connections['registrar_enviado'].main[0][0].node === 'loop_lead'],
  ['Duplicado pula loop',         fluxo.connections['if_lead_novo'].main[1][0].node === 'loop_lead'],
  ['IF empresa: false → NoOp',    fluxo.connections['if_empresa_ativa'].main[1][0].node === 'sem_empresa_ativa'],
  ['IF apollo: false → NoOp',     fluxo.connections['if_tem_resultados'].main[1][0].node === 'sem_resultados_apollo'],
  ['Total de nodes',              fluxo.nodes.length === 22]
].forEach(function(c) {
  console.log((c[1] ? 'OK' : 'FALHOU') + ': ' + c[0]);
});

console.log('\n=== PIPELINE v1 ===');
console.log('schedule_diario (seg-sex 8h) ↘');
console.log('webhook_dashboard (manual)   ↗  → calcular_semana');
console.log('  ↓ semana = dia do mês / 7');
console.log('buscar_empresa_supabase → victor_empresas WHERE semana_rotacao = N');
console.log('  ↓ empresa.nome, empresa.cargos[], empresa.regioes[], empresa.template_email');
console.log('montar_apollo → body dinâmico (titles + locations + org_size + industry)');
console.log('buscar_apollo → Apollo mixed_people/search');
console.log('  ↓ people[].email, .title, .organization.website_url');
console.log('processar_leads → filtra pessoal + valida domínio bate empresa');
console.log('loop_lead (1x1) → checar_dedup (leads_enviados últimos 60 dias)');
console.log('  se novo → salvar_lead + montar_email + gmail + registrar_enviado → loop');
console.log('  se duplicado → skip → loop');
console.log('  quando done → fim_loop');

console.log('\n=== CONFIGURAR NO N8N APÓS IMPORTAR ===');
console.log('1. Node "enviar_email_gmail": conectar credencial Gmail do Victor');
console.log('2. Ativar workflow (toggle Active)');
console.log('3. Semana 1 (dias 1-7) = Selfe Corp roda automaticamente às 8h');
console.log('4. PRIMEIRA SEMANA: desligar schedule e rodar manualmente para Victor revisar');
