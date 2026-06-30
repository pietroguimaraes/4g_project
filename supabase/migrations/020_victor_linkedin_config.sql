-- Migration 020: Victor — adiciona config de busca LinkedIn por empresa
-- Cada empresa guarda sua URL-base de busca do LinkedIn para o HarvestAPI

ALTER TABLE victor_empresas
  ADD COLUMN IF NOT EXISTS linkedin_search_url TEXT,     -- URL de busca LinkedIn com filtros da empresa
  ADD COLUMN IF NOT EXISTS max_leads_dia       INTEGER,  -- meta diária (leads_meta_mes / 22 dias úteis)
  ADD COLUMN IF NOT EXISTS buffer_multiplo     NUMERIC DEFAULT 2.5; -- buffer de perfis a processar (compensa taxa 40-70%)

-- Atualiza meta diária e URLs de busca por empresa
-- Selfe Corp: comprador de viagens/eventos, empresa 1000+, nacional
UPDATE victor_empresas SET
  max_leads_dia = 14,  -- 300 / 22 ≈ 14/dia
  linkedin_search_url = 'https://www.linkedin.com/search/results/people/?keywords=comprador%20de%20viagens%20corporativas%20comprador%20de%20eventos&geoUrn=%5B%22106057199%22%5D&origin=GLOBAL_SEARCH_HEADER'
WHERE nome = 'Selfe Corp';

-- Grupo BRS: facilities/comprador de indiretos, Grande SP + ABCD
UPDATE victor_empresas SET
  max_leads_dia = 14,  -- 300 / 22 ≈ 14/dia
  linkedin_search_url = 'https://www.linkedin.com/search/results/people/?keywords=facilities%20manager%20comprador%20de%20indiretos%20gerente%20facilities&geoUrn=%5B%22103644278%22%2C%22100364837%22%5D&origin=GLOBAL_SEARCH_HEADER'
WHERE nome = 'Grupo BRS';

-- Meso: comprador SESMT / SSMA / indiretos, nacional
UPDATE victor_empresas SET
  max_leads_dia = 14,  -- 300 / 22 ≈ 14/dia
  linkedin_search_url = 'https://www.linkedin.com/search/results/people/?keywords=comprador%20SESMT%20SSMA%20saude%20seguranca%20trabalho%20comprador%20indiretos&geoUrn=%5B%22106057199%22%5D&origin=GLOBAL_SEARCH_HEADER'
WHERE nome = 'Meso';

-- Salvia: comprador congelados/perecíveis, hipermercados, RS/PR/SC/SP/RJ
UPDATE victor_empresas SET
  max_leads_dia = 9,   -- 200 / 22 ≈ 9/dia
  linkedin_search_url = 'https://www.linkedin.com/search/results/people/?keywords=comprador%20congelados%20pereciveis%20hipermercado%20supermercado&geoUrn=%5B%22103644278%22%2C%22101243369%22%2C%22107348541%22%2C%22101525044%22%2C%22102454443%22%5D&origin=GLOBAL_SEARCH_HEADER'
WHERE nome = 'Salvia';

-- DLV: eficiência energética / Chillers, nacional
UPDATE victor_empresas SET
  max_leads_dia = 5,   -- 100 / 22 ≈ 5/dia
  linkedin_search_url = 'https://www.linkedin.com/search/results/people/?keywords=gerente%20engenharia%20eficiencia%20energetica%20chiller%20diretor%20operacoes%20manutenção%20industrial&geoUrn=%5B%22106057199%22%5D&origin=GLOBAL_SEARCH_HEADER'
WHERE nome = 'DLV';
