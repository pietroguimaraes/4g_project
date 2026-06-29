-- Migration 018: adiciona campo fonte em leads e searches para suporte ao Instagram

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'google_maps',
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS instagram_followers INTEGER;

ALTER TABLE searches
  ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'google_maps';

COMMENT ON COLUMN leads.fonte IS 'Origem do lead: google_maps | instagram';
COMMENT ON COLUMN leads.instagram_handle IS 'Handle do Instagram (@perfil) quando fonte=instagram';
COMMENT ON COLUMN leads.instagram_followers IS 'Número de seguidores quando fonte=instagram';
COMMENT ON COLUMN searches.fonte IS 'Fonte da busca: google_maps | instagram | ambos';
