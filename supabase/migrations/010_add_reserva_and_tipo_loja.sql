-- Migration 010: Sistema de Reserva de Leads
-- Adiciona status RESERVA e coluna tipo_loja na tabela leads
-- Leads em RESERVA são extras de buscas anteriores reutilizados na próxima busca da mesma categoria

-- 1. Remover CHECK constraint antiga e recriar com RESERVA
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN (
  'LOCALIZADOS','PROSPECTAR','PROSPECTADOS',
  'INTERESSE','TRANSFERIDOS','DESCARTADOS',
  'NAO_RESPONDERAM','RESERVA'
));

-- 2. Adicionar coluna tipo_loja para filtrar reserva por categoria
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tipo_loja TEXT;

-- 3. Índice para consultas de reserva (cidade + tipo_loja + status)
CREATE INDEX IF NOT EXISTS idx_leads_reserva ON leads(status, tipo_loja, cidade)
  WHERE status = 'RESERVA';
