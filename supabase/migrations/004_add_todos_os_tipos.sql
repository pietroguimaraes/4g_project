-- Migration 004: Adiciona "Todos os tipos" às opções de tipo_loja

ALTER TABLE searches
  DROP CONSTRAINT searches_tipo_loja_check;

ALTER TABLE searches
  ADD CONSTRAINT searches_tipo_loja_check
    CHECK (tipo_loja IN (
      'Todos os tipos',
      'Loja de brinquedos',
      'Artigos esportivos',
      'Bazar e variedades',
      'Sacoleiro / Atacadista',
      'Loja de presentes',
      'Comércio'
    ));
