-- Adiciona status PEQUENOS (clientes com poder de compra < R$3.000)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN (
  'LOCALIZADOS',
  'PROSPECTAR',
  'PROSPECTADOS',
  'INTERESSE',
  'TRANSFERIDOS',
  'DESCARTADOS',
  'NAO_RESPONDERAM',
  'RESERVA',
  'PEQUENOS'
));
