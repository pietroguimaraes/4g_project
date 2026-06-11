-- Migration 018: Victor Pizza Demo
-- Configura instância para distribuidora de pizza prospectando supermercados/redes

-- 1. Adiciona campo email na tabela leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Atualizar configuração da instância
INSERT INTO config (chave, valor, descricao) VALUES
  ('negocio_nome',      'Victor - Distribuidora de Pizza',              'Nome exibido no dashboard'),
  ('negocio_segmento',  'Distribuição de Pizza para Varejo',            'Segmento do negócio'),
  ('categorias',        'SUPERMERCADO,ATACADISTA,DISTRIBUIDORA',        'Categorias de lead (separadas por vírgula)'),
  ('vendedor_nome',     'Victor',                                       'Nome do responsável pelos leads quentes'),
  ('setor_busca',       'supermercado hipermercado rede mercado',       'Termo padrão para busca no Apify'),
  ('estados_alvo',      'SP,PR,RS,SC',                                  'Estados de atuação da empresa'),
  ('demo_mode',         'false',                                        'Indica que é uma instância de demonstração')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
