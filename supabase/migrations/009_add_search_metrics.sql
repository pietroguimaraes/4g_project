-- Migration 009: Adiciona métricas de busca à tabela searches
-- Permite rastrear quantidade pedida vs entregue vs bruta do Apify

ALTER TABLE searches
  ADD COLUMN IF NOT EXISTS quantidade_bruta integer,
  ADD COLUMN IF NOT EXISTS quantidade_entregue integer,
  ADD COLUMN IF NOT EXISTS num_rodadas integer DEFAULT 1;
