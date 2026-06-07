-- Migration 016: Isolamento por usuário via RLS
-- Adiciona user_id às tabelas searches e leads e habilita Row Level Security.
-- EXECUTAR ANTES de adicionar um segundo cliente na mesma instância Supabase.
-- ATENÇÃO: aplicar com snapshot antes (supabase db dump ou painel Supabase → Backups).

-- ── 1. Adiciona user_id em searches ───────────────────────────────────────────
ALTER TABLE searches
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Popula registros existentes com o primeiro usuário (ajuste o UUID se necessário)
-- UPDATE searches SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);

-- ── 2. Adiciona user_id em leads ──────────────────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Popula via search associada (leads herdam o user do search que os criou)
-- UPDATE leads SET user_id = s.user_id FROM searches s WHERE leads.search_id = s.id AND leads.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);

-- ── 3. Habilita RLS ───────────────────────────────────────────────────────────
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads    ENABLE ROW LEVEL SECURITY;

-- ── 4. Políticas: cada usuário vê apenas seus próprios dados ──────────────────
DROP POLICY IF EXISTS "users_own_searches" ON searches;
CREATE POLICY "users_own_searches"
  ON searches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_leads" ON leads;
CREATE POLICY "users_own_leads"
  ON leads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Garante que novos registros sempre recebem user_id ─────────────────────
-- O backend já tem auth.getUser() — basta passar user.id no INSERT.
-- Ver src/app/api/searches/route.ts (adicionar user_id: user.id no insert).
