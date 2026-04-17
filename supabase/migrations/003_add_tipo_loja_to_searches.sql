-- Migration 003: Adiciona tipo_loja à tabela searches
-- Permite filtrar buscas por tipo de estabelecimento no Apify

ALTER TABLE searches
  ADD COLUMN tipo_loja TEXT NOT NULL DEFAULT 'Loja de brinquedos'
    CHECK (tipo_loja IN (
      'Loja de brinquedos',
      'Artigos esportivos',
      'Bazar e variedades',
      'Sacoleiro / Atacadista',
      'Loja de presentes',
      'Comércio'
    ));
