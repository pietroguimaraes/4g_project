-- Migration 015: Cliente Oriental Limpeza
-- Configura instância para distribuidora de limpeza prospectando supermercados/atacadistas

-- 1. Atualizar constraint de categorias
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_categoria_check;
ALTER TABLE leads ADD CONSTRAINT leads_categoria_check
  CHECK (categoria IN ('SUPERMERCADO', 'ATACADISTA', 'DISTRIBUIDORA') OR categoria IS NULL);

-- 2. Atualizar configuração da instância
INSERT INTO config (chave, valor, descricao) VALUES
  ('negocio_nome',      'Oriental Limpeza',                              'Nome exibido no dashboard'),
  ('negocio_segmento',  'Distribuição de Limpeza e Higiene',             'Segmento do negócio'),
  ('categorias',        'SUPERMERCADO,ATACADISTA,DISTRIBUIDORA',         'Categorias de lead (separadas por vírgula)'),
  ('vendedor_nome',     'Reinan',                                        'Nome do responsável pelos leads quentes'),
  ('setor_busca',       'supermercado atacadista atacarejo distribuidora', 'Termo padrão para busca no Apify'),
  ('demo_mode',         'false',                                         'Indica que é uma instância de demonstração')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
