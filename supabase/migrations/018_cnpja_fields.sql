-- Tabela searches: adiciona municipio_id e bairro
ALTER TABLE searches ADD COLUMN IF NOT EXISTS municipio_id integer;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS bairro text;

-- Tabela leads: adiciona campos estruturados do CNPJa
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cep text;
