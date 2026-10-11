-- Nuevo motivo de reporte, grave: alguien se está aprovechando y las donaciones no llegan a las
-- personas afectadas. Cuenta para ocultar el centro igual que pedir dinero o ser falso.
ALTER TABLE reports DROP CONSTRAINT reports_reason_check;
ALTER TABLE reports ADD CONSTRAINT reports_reason_check
  CHECK (reason IN ('CLOSED','WRONG_INFO','ASKS_MONEY','FAKE','NOT_RECEIVING','MY_DATA','DIVERTED','OTHER'));
