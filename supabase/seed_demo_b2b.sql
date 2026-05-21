-- ============================================================
-- SEED DEMO B2B — Dados fictícios para demonstração comercial
-- Rodar no SQL Editor do Supabase do projeto demo B2B
-- URL: https://tuctjosvxdzbfnyvvodc.supabase.co
-- ============================================================

-- =====================
-- 1. BUSCA (referência para os leads)
-- =====================
INSERT INTO searches (id, pais, estado, cidade, quantidade, status, total_encontrados, quantidade_bruta, quantidade_entregue, num_rodadas, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Brasil', 'GO', 'Goiânia', 50, 'CONCLUÍDA', 47, 62, 47, 2,
  NOW() - INTERVAL '4 days'
);

-- =====================
-- 2. LEADS (distribuídos pelo Kanban)
-- =====================

-- LOCALIZADOS — aparecem no painel de aprovação (aguardando triagem)
INSERT INTO leads (empresa, telefone, cidade, estado, pais, status, categoria, tipo_loja, search_id, created_at) VALUES
  ('Distribuidora Alvorada Ltda',  '62991110001', 'Goiânia',              'GO', 'Brasil', 'LOCALIZADOS', 'ALIMENTÍCIO', 'distribuidora', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 days'),
  ('Atacado Bonfim & Cia',         '62991110002', 'Anápolis',             'GO', 'Brasil', 'LOCALIZADOS', 'HIGIENE',     'distribuidora', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 days'),
  ('Distrib. Cerrado Center',      '62991110003', 'Goiânia',              'GO', 'Brasil', 'LOCALIZADOS', 'LIMPEZA',     'distribuidora', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 days');

-- PROSPECTAR — aprovados, aguardando envio da mensagem
INSERT INTO leads (empresa, telefone, cidade, estado, pais, status, categoria, tipo_loja, search_id, created_at) VALUES
  ('Atacadão Central Goiás',       '62991110004', 'Goiânia',              'GO', 'Brasil', 'PROSPECTAR', 'ALIMENTÍCIO', 'distribuidora', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 days'),
  ('Distribuidora Norte Sul',      '62991110005', 'Aparecida de Goiânia', 'GO', 'Brasil', 'PROSPECTAR', 'LIMPEZA',     'distribuidora', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 days');

-- PROSPECTADOS — mensagem já enviada, aguardando resposta
INSERT INTO leads (empresa, telefone, cidade, estado, pais, status, categoria, tipo_loja, search_id, created_at) VALUES
  ('Distrib. São Francisco',       '62991110006', 'Goiânia',              'GO', 'Brasil', 'PROSPECTADOS', 'HIGIENE',     'distribuidora', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 days'),
  ('Atacado Planalto Goiás',       '62991110007', 'Goiânia',              'GO', 'Brasil', 'PROSPECTADOS', 'ALIMENTÍCIO', 'distribuidora', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 days'),
  ('Prime Distribuidora',          '62991110008', 'Trindade',             'GO', 'Brasil', 'PROSPECTADOS', 'LIMPEZA',     'distribuidora', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '5 days');

-- INTERESSE — leads quentes, demonstraram interesse real
INSERT INTO leads (empresa, telefone, website, cidade, estado, pais, status, categoria, nota, tipo_loja, data_resposta, search_id, created_at) VALUES
  ('Atacado Primavera',            '62991110009', 'www.atacadoprimavera.com.br', 'Goiânia', 'GO', 'Brasil', 'INTERESSE', 'ALIMENTÍCIO', 8, 'distribuidora', NOW() - INTERVAL '1 day',  '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '5 days'),
  ('Distribuidora Estrela GO',     '62991110010', NULL,                          'Goiânia', 'GO', 'Brasil', 'INTERESSE', 'HIGIENE',     7, 'distribuidora', NOW() - INTERVAL '2 days', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '5 days');

-- TRANSFERIDOS — entregue ao time comercial para fechar
INSERT INTO leads (empresa, telefone, website, cidade, estado, pais, status, categoria, nota, tipo_loja, data_resposta, search_id, created_at) VALUES
  ('Mega Atacado Centro-Oeste',    '62991110011', 'www.megaatacadoco.com.br',    'Goiânia', 'GO', 'Brasil', 'TRANSFERIDOS', 'LIMPEZA', 9, 'distribuidora', NOW() - INTERVAL '3 days', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '6 days');

-- DESCARTADOS — sem perfil
INSERT INTO leads (empresa, telefone, cidade, estado, pais, status, categoria, tipo_loja, search_id, created_at) VALUES
  ('Mercadinho do Zé',             '62991110012', 'Goiânia', 'GO', 'Brasil', 'DESCARTADOS', 'ALIMENTÍCIO', 'varejo', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 days');

-- =====================
-- 3. CONVERSA DE QUALIFICAÇÃO — Atacado Primavera
-- Esta é a conversa que você abre durante a demo no [5:00]
-- =====================
INSERT INTO messages (telefone, role, conteudo, created_at) VALUES
  ('62991110009', 'lucas', 'Olá! Tudo bem? Me chamo Vendedor, entro em contato em nome de uma distribuidora atacado B2B. Vi que o Atacado Primavera atua no setor alimentício — exatamente o nosso foco. Vocês têm interesse em conhecer novos fornecedores com condições diferenciadas?', NOW() - INTERVAL '26 hours'),
  ('62991110009', 'lead',  'Oi! Sim pode falar', NOW() - INTERVAL '25 hours'),
  ('62991110009', 'lucas', 'Ótimo! Para entender melhor o perfil de vocês: o Atacado Primavera atende varejo direto, mercados ou outros distribuidores?', NOW() - INTERVAL '24 hours 50 minutes'),
  ('62991110009', 'lead',  'A gente atende principalmente mercadinhos e minimercados aqui na região metropolitana', NOW() - INTERVAL '24 hours 30 minutes'),
  ('62991110009', 'lucas', 'Perfeito! E atualmente quantos pontos de venda vocês atendem, mais ou menos?', NOW() - INTERVAL '24 hours 20 minutes'),
  ('62991110009', 'lead',  'Umas 90 lojas ativas', NOW() - INTERVAL '24 hours'),
  ('62991110009', 'lucas', 'Excelente carteira! Vocês têm interesse em ampliar? Trabalhamos com produtos de giro rápido, entrega em até 48h e prazo diferenciado para distribuidores com esse volume.', NOW() - INTERVAL '23 hours 50 minutes'),
  ('62991110009', 'lead',  'Sim tenho interesse. Quais produtos vocês trabalham?', NOW() - INTERVAL '23 hours 30 minutes'),
  ('62991110009', 'lucas', 'Trabalhamos com as principais categorias do alimentício: laticínios, bebidas, grãos e enlatados. Posso passar o contato do nosso consultor comercial para detalhar o portfólio. Qual o melhor horário para vocês?', NOW() - INTERVAL '23 hours 20 minutes'),
  ('62991110009', 'lead',  'Pode ser amanhã de manhã tipo 9h', NOW() - INTERVAL '23 hours');
