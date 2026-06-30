-- Migration 019: Victor - Sistema Multi-Empresa
-- Cria estrutura para gerenciar 5 empresas do Victor com ICPs distintos

-- 1. Tabela de configuração por empresa
CREATE TABLE IF NOT EXISTS victor_empresas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  segmento        TEXT NOT NULL,
  cargos          TEXT[] NOT NULL,           -- ex: {'Comprador de Viagens', 'Comprador de Eventos'}
  regioes         TEXT[],                    -- ex: {'SP', 'Nacional'} ou lista de cidades
  setores         TEXT[],                    -- ex: {'Alimentos', 'Bebidas', 'Hospital'} para DLV
  min_funcionarios INTEGER DEFAULT 0,        -- 1000 para Selfe Corp, 0 para as demais
  semana_rotacao  SMALLINT NOT NULL          -- 1 a 4 (semana do mês em que essa empresa roda)
    CHECK (semana_rotacao BETWEEN 1 AND 4),
  leads_meta_mes  INTEGER NOT NULL DEFAULT 0,
  template_email  TEXT,                      -- template com variáveis {{nome}}, {{empresa}}, {{cargo}}
  ativo           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adiciona empresa_id nas tabelas existentes
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES victor_empresas(id),
  ADD COLUMN IF NOT EXISTS cargo_encontrado TEXT,
  ADD COLUMN IF NOT EXISTS empresa_encontrada TEXT,
  ADD COLUMN IF NOT EXISTS dominio_email TEXT;

ALTER TABLE searches
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES victor_empresas(id);

-- 3. Tabela de deduplicação global (evita enviar para o mesmo email em janela de 60 dias)
CREATE TABLE IF NOT EXISTS leads_enviados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  empresa_id  UUID REFERENCES victor_empresas(id),
  enviado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_leads_enviados_email ON leads_enviados(email);
CREATE INDEX IF NOT EXISTS idx_leads_enviados_enviado_em ON leads_enviados(enviado_em);

-- 4. Índices novos em leads e searches
CREATE INDEX IF NOT EXISTS idx_leads_empresa_id ON leads(empresa_id);
CREATE INDEX IF NOT EXISTS idx_searches_empresa_id ON searches(empresa_id);

-- 5. Trigger updated_at para victor_empresas
CREATE TRIGGER set_updated_at_victor_empresas
  BEFORE UPDATE ON victor_empresas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Cadastra as 5 empresas do Victor
INSERT INTO victor_empresas (nome, segmento, cargos, regioes, setores, min_funcionarios, semana_rotacao, leads_meta_mes, template_email) VALUES
(
  'Selfe Corp',
  'Viagens Corporativas',
  ARRAY['Comprador de Viagens', 'Comprador de Eventos', 'Travel Manager', 'Gestor de Viagens'],
  ARRAY['Brasil'],
  NULL,
  1000,
  1,
  300,
  'Olá {{nome}}, tudo bem?

Sou Victor, da Selfe Corp — especialistas em gestão de viagens corporativas.

Vi que você atua como {{cargo}} na {{empresa}} e queria entender como vocês gerenciam hoje as viagens e eventos da empresa.

Trabalhamos com empresas de grande porte e conseguimos reduzir significativamente os custos com viagens corporativas, além de simplificar toda a gestão para o time.

Faz sentido trocarmos uma ideia rápida de 15 minutos?

Atenciosamente,
Victor'
),
(
  'Grupo BRS',
  'Facilities',
  ARRAY['Facilities Manager', 'Gerente de Facilities', 'Comprador de Indiretos', 'Gerente de Compras Indiretas'],
  ARRAY['São Paulo', 'Santo André', 'São Bernardo do Campo', 'São Caetano do Sul', 'Diadema', 'Mauá', 'Ribeirão Pires', 'Rio Grande da Serra'],
  NULL,
  0,
  2,
  300,
  'Olá {{nome}}, tudo bem?

Sou Victor, do Grupo BRS — empresa de facilities com atuação na Grande São Paulo e ABCD.

Vi seu perfil e percebi que você cuida da área de {{cargo}} na {{empresa}}.

Atuamos com serviços de facilities para empresas da região e tenho interesse em entender quais são os desafios que vocês enfrentam hoje nessa área.

Podemos conversar 15 minutinhos essa semana?

Atenciosamente,
Victor'
),
(
  'Meso',
  'Saúde e Segurança do Trabalho',
  ARRAY['Comprador SESMT', 'Coordenador SESMT', 'Gerente de SSMA', 'Comprador de Indiretos', 'Gerente de Saúde e Segurança'],
  ARRAY['Brasil'],
  NULL,
  0,
  3,
  300,
  'Olá {{nome}}, tudo bem?

Sou Victor, da Meso — empresa especializada em saúde e segurança do trabalho.

Vi que você trabalha com {{cargo}} na {{empresa}} e queria entender como estão gerenciando os processos de SESMT e SSMA hoje.

Oferecemos soluções completas para empresas que precisam garantir conformidade e segurança para seus colaboradores.

Teria 15 minutos para conversarmos?

Atenciosamente,
Victor'
),
(
  'Salvia',
  'Distribuição de Pizzas B2B',
  ARRAY['Comprador de Congelados', 'Comprador de Perecíveis', 'Gerente de Compras', 'Diretor de Compras'],
  ARRAY['RS', 'PR', 'SC', 'SP', 'RJ'],
  ARRAY['Hipermercado', 'Supermercado', 'Rede de Varejo Alimentar'],
  0,
  4,
  200,
  'Olá {{nome}}, tudo bem?

Sou Victor, da Salvia — distribuidora de pizzas para redes de hipermercados.

Vi que você atua como {{cargo}} na {{empresa}} e imagino que vocês já trabalham com fornecedores de congelados e perecíveis.

Temos produtos de alta qualidade com excelente giro de prateleira e condições diferenciadas para redes do seu porte.

Posso enviar nosso portfólio ou marcamos uma conversa rápida?

Atenciosamente,
Victor'
),
(
  'DLV',
  'Eficiência Energética',
  ARRAY['Gerente de Engenharia', 'Diretor de Operações', 'Gerente de Manutenção', 'Engenheiro de Facilities', 'Gestor de Energia'],
  ARRAY['Brasil'],
  ARRAY['Alimentos', 'Bebidas', 'Hospital', 'Data Center', 'Shopping Center'],
  0,
  4,
  100,
  'Olá {{nome}}, tudo bem?

Sou Victor, da DLV — empresa especializada em eficiência energética com foco em sistemas de refrigeração industrial (Chillers).

Vi que você atua como {{cargo}} na {{empresa}}, que faz parte do setor onde mais atuamos.

Empresas do seu segmento costumam ter oportunidades significativas de redução de custo energético nos sistemas de resfriamento. Já ajudamos clientes a economizar entre 20% e 35% nessa área.

Faria sentido uma conversa técnica rápida?

Atenciosamente,
Victor'
);
