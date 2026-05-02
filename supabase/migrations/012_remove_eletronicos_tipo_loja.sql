-- Migration 012: Remove 'Eletroportáteis/eletrônicos' dos tipos de loja válidos
ALTER TABLE searches DROP CONSTRAINT IF EXISTS searches_tipo_loja_check;

ALTER TABLE searches
  ADD CONSTRAINT searches_tipo_loja_check
    CHECK (tipo_loja IN (
      'Lojas de Variedades/1,99/miudezas/bazares',
      'Lojas de brinquedos',
      'Lojas de artigos esportivos',
      'Papelaria'
    ));
