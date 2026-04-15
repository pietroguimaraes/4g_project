-- Migration 001: Tabela de buscas
-- Registra cada busca feita pelo Anderson (país, estado, cidade, quantidade)

CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pais TEXT NOT NULL,
  estado TEXT NOT NULL,
  cidade TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'CONCLUÍDA', 'ERRO')),
  total_encontrados INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
