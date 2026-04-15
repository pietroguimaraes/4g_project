-- Migration 002: Tabela de leads
-- Representa cada empresa no funil, do Apify até o handoff ao Anderson

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  telefone TEXT NOT NULL UNIQUE,
  website TEXT,
  cidade TEXT,
  estado TEXT,
  pais TEXT,
  status TEXT NOT NULL DEFAULT 'LOCALIZADOS'
    CHECK (status IN (
      'LOCALIZADOS','PROSPECTAR','PROSPECTADOS',
      'INTERESSE','TRANSFERIDOS','DESCARTADOS'
    )),
  categoria TEXT CHECK (categoria IN ('DOMÉSTICOS','ESPORTIVOS','MISTO')),
  nota SMALLINT CHECK (nota BETWEEN 0 AND 10),
  data_coleta TIMESTAMPTZ DEFAULT NOW(),
  data_resposta TIMESTAMPTZ,
  data_followup TIMESTAMPTZ,
  qtd_reengajamentos SMALLINT DEFAULT 0,
  search_id UUID REFERENCES searches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_telefone ON leads(telefone);
