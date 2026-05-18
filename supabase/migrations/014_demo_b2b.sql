-- Migration 014: Demo Distribuidora B2B
-- Atualiza constraints para categorias B2B e cria tabela de configuração
-- Contexto: instância demo genérica para prospecção comercial (Dia 5)

-- 1. Atualizar constraint de categorias no leads
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_categoria_check;
ALTER TABLE leads ADD CONSTRAINT leads_categoria_check
  CHECK (categoria IN ('ALIMENTÍCIO', 'HIGIENE', 'LIMPEZA') OR categoria IS NULL);

-- 2. Criar tabela de configuração por instância
-- Permite que cada deploy tenha seus próprios valores sem alterar o código
CREATE TABLE IF NOT EXISTS config (
  chave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  descricao   TEXT
);

-- 3. Inserir configuração do demo Distribuidora B2B
INSERT INTO config (chave, valor, descricao) VALUES
  ('negocio_nome',      'Distribuidora B2B',              'Nome exibido no dashboard'),
  ('negocio_segmento',  'Distribuição Atacado',           'Segmento do negócio'),
  ('categorias',        'ALIMENTÍCIO,HIGIENE,LIMPEZA',    'Categorias de lead (separadas por vírgula)'),
  ('vendedor_nome',     'Vendedor',                       'Nome do responsável pelos leads quentes'),
  ('setor_busca',       'distribuidoras atacado B2B',     'Termo padrão para busca no Apify'),
  ('demo_mode',         'true',                           'Indica que é uma instância de demonstração')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
