-- Migration 017: Adiciona fonte_telefone à tabela leads
-- Registra de onde veio o contato: ia_pessoal, maps_fallback, website_wame, website_html

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS fonte_telefone TEXT;
