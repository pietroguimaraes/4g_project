-- Migration 005: Trigger automático para updated_at na tabela leads
-- Garante que updated_at seja atualizado em qualquer UPDATE,
-- independente de qual cliente fez a alteração.

-- Função reutilizável (pode ser reaproveitada em outras tabelas futuramente)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger na tabela leads
CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
