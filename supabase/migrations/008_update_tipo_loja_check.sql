-- Migration 008: Atualiza tipos de loja para novos valores do dashboard

ALTER TABLE searches DROP CONSTRAINT IF EXISTS searches_tipo_loja_check;

ALTER TABLE searches
  ADD CONSTRAINT searches_tipo_loja_check
    CHECK (tipo_loja IN (
      'Lojas de Variedades/1,99/miudezas/bazares',
      'Lojas de brinquedos',
      'Lojas de artigos esportivos',
      'Papelaria',
      'Eletroportáteis/eletrônicos'
    ));
