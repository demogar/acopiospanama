-- A dónde llega la ayuda. Quien dona quiere elegir un centro cuyas donaciones vayan a un lugar
-- concreto («quiero que llegue a Macaracas y Los Pozos»), y saber cómo llegan ayuda a detectar
-- el «juega vivo». Lista de destinos como provincia (catálogo) + distrito o comunidad (texto):
-- [{"province":"LOS_SANTOS","district":"Macaracas"},{"province":"HERRERA","district":"Los Pozos"}]
-- Vacía = el centro no lo indicó (la web lo dice y pide preguntar antes de dejar nada).
ALTER TABLE centers ADD COLUMN destinations jsonb NOT NULL DEFAULT '[]';
-- Cómo llega: quién lo transporta, cada cuánto, a quién se entrega («lo lleva la parroquia los lunes»).
ALTER TABLE centers ADD COLUMN destination_note text NOT NULL DEFAULT '';

-- Nuevo motivo de reporte, grave: las donaciones no llegan a donde la ficha dice.
ALTER TABLE reports DROP CONSTRAINT reports_reason_check;
ALTER TABLE reports ADD CONSTRAINT reports_reason_check
  CHECK (reason IN ('CLOSED','WRONG_INFO','ASKS_MONEY','FAKE','NOT_RECEIVING','MY_DATA','DIVERTED','OTHER'));
