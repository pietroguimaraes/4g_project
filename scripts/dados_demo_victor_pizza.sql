-- Dados de demonstração: Victor Pizza
-- 15 supermercados reais de SP pré-carregados para a demo
-- IMPORTANTE: rodar no Supabase da instância Victor APÓS o login de demo ser criado
-- Substituir <USER_ID_VICTOR_DEMO> pelo UUID real do usuário criado no Supabase Auth

-- Limpar dados anteriores do usuário demo (se houver)
DELETE FROM leads WHERE user_id = '<USER_ID_VICTOR_DEMO>';
DELETE FROM searches WHERE user_id = '<USER_ID_VICTOR_DEMO>';

-- Inserir busca de referência (aparece como "busca concluída" no histórico)
INSERT INTO searches (id, user_id, pais, estado, cidade, tipo_loja, quantidade, status, quantidade_entregue, created_at)
VALUES (
  'demo-search-victor-001',
  '<USER_ID_VICTOR_DEMO>',
  'Brasil', 'SP', 'São Paulo', 'Supermercados', 15, 'CONCLUÍDA', 15,
  NOW() - INTERVAL '2 hours'
);

-- Leads: 8 no painel de aprovação (LOCALIZADOS), 7 no Kanban
INSERT INTO leads (id, user_id, empresa, telefone, email, cidade, estado, pais, status, categoria, fonte_telefone, search_id, data_coleta, manual, qtd_reengajamentos, created_at, updated_at) VALUES

-- PAINEL DE APROVAÇÃO (status = LOCALIZADOS)
('demo-lead-01', '<USER_ID_VICTOR_DEMO>', 'Supermercado Shibata',          '11987654301', 'compras@shibata.com.br',       'São Paulo',     'SP', 'Brasil', 'LOCALIZADOS', 'SUPERMERCADO', 'ia_pessoal',    'demo-search-victor-001', NOW() - INTERVAL '1 hour', false, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('demo-lead-02', '<USER_ID_VICTOR_DEMO>', 'Rede Supermarket Brasil',        '11976543212', null,                           'São Paulo',     'SP', 'Brasil', 'LOCALIZADOS', 'SUPERMERCADO', 'maps_fallback',  'demo-search-victor-001', NOW() - INTERVAL '1 hour', false, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('demo-lead-03', '<USER_ID_VICTOR_DEMO>', 'Hipermercado Top Serve',         '11965432123', 'compras@topserve.com.br',      'Guarulhos',     'SP', 'Brasil', 'LOCALIZADOS', 'SUPERMERCADO', 'ia_pessoal',    'demo-search-victor-001', NOW() - INTERVAL '1 hour', false, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('demo-lead-04', '<USER_ID_VICTOR_DEMO>', 'Mercadão dos Atacadistas Ltda',  '11954321234', 'pedro.compras@mercadao.com',   'Santo André',   'SP', 'Brasil', 'LOCALIZADOS', 'ATACADISTA',   'ia_pessoal',    'demo-search-victor-001', NOW() - INTERVAL '1 hour', false, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('demo-lead-05', '<USER_ID_VICTOR_DEMO>', 'Supermercado Família Pinheiro',  '11943210345', null,                           'Osasco',        'SP', 'Brasil', 'LOCALIZADOS', 'SUPERMERCADO', 'maps_fallback',  'demo-search-victor-001', NOW() - INTERVAL '1 hour', false, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('demo-lead-06', '<USER_ID_VICTOR_DEMO>', 'Rede Econ Supermercados',        '11932109456', 'econ.compras@gmail.com',       'São Bernardo',  'SP', 'Brasil', 'LOCALIZADOS', 'SUPERMERCADO', 'ia_pessoal',    'demo-search-victor-001', NOW() - INTERVAL '1 hour', false, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('demo-lead-07', '<USER_ID_VICTOR_DEMO>', 'Supermercado Vitalidade',        '11921098567', null,                           'Campinas',      'SP', 'Brasil', 'LOCALIZADOS', 'SUPERMERCADO', 'maps_fallback',  'demo-search-victor-001', NOW() - INTERVAL '1 hour', false, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('demo-lead-08', '<USER_ID_VICTOR_DEMO>', 'Atacadão Leste Paulista',        '11910987678', 'compras@atacadaoleste.com.br', 'Mogi das Cruzes','SP','Brasil', 'LOCALIZADOS', 'ATACADISTA',   'ia_pessoal',    'demo-search-victor-001', NOW() - INTERVAL '1 hour', false, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),

-- KANBAN — PROSPECTAR (bot vai abordar)
('demo-lead-09', '<USER_ID_VICTOR_DEMO>', 'Supermercado Gonçalves',         '11909876789', 'fabio.compras@supgoncalves.com', 'São Paulo',   'SP', 'Brasil', 'PROSPECTAR', 'SUPERMERCADO', 'ia_pessoal', 'demo-search-victor-001', NOW() - INTERVAL '3 hours', false, 0, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),
('demo-lead-10', '<USER_ID_VICTOR_DEMO>', 'Rede Mineirão SP',               '11898765890', null,                           'São Paulo',     'SP', 'Brasil', 'PROSPECTAR', 'SUPERMERCADO', 'maps_fallback', 'demo-search-victor-001', NOW() - INTERVAL '3 hours', false, 0, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),

-- KANBAN — INTERESSE (já responderam positivamente)
('demo-lead-11', '<USER_ID_VICTOR_DEMO>', 'Supermercados Hirota Food',      '11887654901', 'hirota.compras@hirota.com.br', 'São Paulo',     'SP', 'Brasil', 'INTERESSE', 'SUPERMERCADO', 'ia_pessoal', 'demo-search-victor-001', NOW() - INTERVAL '5 hours', false, 0, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),
('demo-lead-12', '<USER_ID_VICTOR_DEMO>', 'Super Mais Supermercados',       '11876543012', 'compras@supermais.com.br',     'Jundiaí',       'SP', 'Brasil', 'INTERESSE', 'SUPERMERCADO', 'ia_pessoal', 'demo-search-victor-001', NOW() - INTERVAL '5 hours', false, 0, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),

-- KANBAN — PROSPECTADOS (foram abordados, sem resposta ainda)
('demo-lead-13', '<USER_ID_VICTOR_DEMO>', 'Supermercado Avenida',           '11865432123', null,                           'Sorocaba',      'SP', 'Brasil', 'PROSPECTADOS', 'SUPERMERCADO', 'maps_fallback', 'demo-search-victor-001', NOW() - INTERVAL '8 hours', false, 0, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours'),
('demo-lead-14', '<USER_ID_VICTOR_DEMO>', 'Rede ABC Mercados',              '11854321234', 'abc.compras@abcmercados.com',  'Santo André',   'SP', 'Brasil', 'PROSPECTADOS', 'SUPERMERCADO', 'ia_pessoal', 'demo-search-victor-001', NOW() - INTERVAL '8 hours', false, 0, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours'),

-- KANBAN — TRANSFERIDOS (fechou reunião com vendedor)
('demo-lead-15', '<USER_ID_VICTOR_DEMO>', 'Hipermercado Nacional SP',       '11843210345', 'nacional.compras@hnacional.com','São Paulo',    'SP', 'Brasil', 'TRANSFERIDOS', 'SUPERMERCADO', 'ia_pessoal', 'demo-search-victor-001', NOW() - INTERVAL '12 hours', false, 0, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours');

-- Conversa demo: Supermercados Hirota (lead em INTERESSE)
INSERT INTO messages (id, lead_telefone, role, conteudo, created_at) VALUES
('msg-01', '11887654901', 'lucas',  'Olá! Meu nome é Renato, trabalho com a Victor Distribuidora de Pizza. Vi que vocês trabalham com pizzas no setor de congelados. Posso apresentar nosso catálogo?', NOW() - INTERVAL '4 hours 30 minutes'),
('msg-02', '11887654901', 'lead',   'Oi Renato! Pode sim, aqui é a Ana da Hirota. Quais pizzas vocês têm?', NOW() - INTERVAL '4 hours'),
('msg-03', '11887654901', 'lucas',  'Ótimo! Temos pizzas de 30 e 35cm, sabores tradicionais e especiais, embalagem com QR code rastreável. Poderia me passar o melhor horário para uma reunião rápida?', NOW() - INTERVAL '3 hours 45 minutes'),
('msg-04', '11887654901', 'lead',   'Pode ser essa semana, quinta às 14h. Me manda os preços por tabela primeiro.', NOW() - INTERVAL '3 hours 30 minutes');
