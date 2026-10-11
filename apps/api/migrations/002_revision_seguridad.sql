-- Correcciones de la revisión de seguridad y abuso.

-- 1) Autoría persistente: el límite diario y el bloqueo no se evaden borrando la cuenta.
--    HMAC del correo (no el correo); la retención lo limpia junto con el centro.
ALTER TABLE centers ADD COLUMN creator_email_hmac text;
CREATE INDEX centers_creator_idx ON centers (creator_email_hmac, created_at);

-- Correos bloqueados por moderación (como HMAC): no pueden volver a entrar aunque borren la cuenta.
CREATE TABLE blocked_emails (
  email_hmac text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Co-responsables por invitación: no tienen acceso hasta aceptar (así nadie convierte a un tercero
--    en «responsable» sin su permiso ni se usa la invitación para enviar correos no deseados).
ALTER TABLE center_managers ADD COLUMN accepted_at timestamptz;
UPDATE center_managers SET accepted_at = created_at;
ALTER TABLE users ADD COLUMN last_invited_at timestamptz;

-- 3) Bloqueo temporal tras muchos códigos de segundo factor incorrectos.
ALTER TABLE users ADD COLUMN mfa_failed_count int NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN mfa_locked_until timestamptz;

-- 4) Nuevo motivo de reporte: «publicaron mis datos sin permiso» (oculta el contacto al instante).
ALTER TABLE reports DROP CONSTRAINT reports_reason_check;
ALTER TABLE reports ADD CONSTRAINT reports_reason_check
  CHECK (reason IN ('CLOSED','WRONG_INFO','ASKS_MONEY','FAKE','NOT_RECEIVING','MY_DATA','OTHER'));
