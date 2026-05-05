-- Tabela de mensagens — histórico de conversa lead ↔ Lucas (IA)
CREATE TABLE messages (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone   TEXT        NOT NULL,
  role       TEXT        NOT NULL CHECK (role IN ('lead', 'lucas')),
  conteudo   TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_messages_telefone ON messages (telefone);
CREATE INDEX idx_messages_telefone_created ON messages (telefone, created_at);
