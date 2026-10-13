-- Acopios Panamá — esquema inicial.
-- Directorio nacional de centros de acopio, auto-mantenido por la comunidad:
--  * cualquiera (con correo verificado) publica un centro y queda como responsable;
--  * cualquiera confirma «sigue funcionando» o reporta problemas;
--  * reglas automáticas deciden qué se muestra (frescura, confirmaciones, reportes, antifraude).
-- Lo público son LUGARES, no personas: los correos nunca se publican.

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  name             text NOT NULL DEFAULT '',
  is_moderator     boolean NOT NULL DEFAULT false,
  is_admin         boolean NOT NULL DEFAULT false, -- puede nombrar moderadores
  totp_secret_enc  text,
  totp_enabled_at  timestamptz,
  totp_last_step   bigint,
  recovery_codes   text[] NOT NULL DEFAULT '{}',
  verified_at      timestamptz,             -- primera vez que entró con un código (correo verificado)
  disabled_at      timestamptz,             -- bloqueado (abuso): no puede entrar ni publicar
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hmac   text NOT NULL,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  code_hmac    text NOT NULL,
  code_group   uuid NOT NULL,
  code_enc     text,
  sent_count   int NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  nonce_hash   text NOT NULL,
  attempts     int NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_challenges_email_idx ON auth_challenges (email_hmac, created_at);
CREATE INDEX auth_challenges_group_idx ON auth_challenges (code_group);

CREATE TABLE sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      text NOT NULL UNIQUE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_staff        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  mfa_verified_at timestamptz,
  step_up_at      timestamptz,
  user_agent      text NOT NULL DEFAULT ''
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE centers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
  center_type       text NOT NULL DEFAULT 'ACOPIO'
                    CHECK (center_type IN ('ACOPIO','DISTRIBUCION','COMEDOR','ALBERGUE','MIXTO')),
  organizer_type    text NOT NULL CHECK (organizer_type IN
                    ('JUNTA_COMUNAL','MUNICIPIO','GOBIERNO','IGLESIA','ESCUELA','CRUZ_ROJA','ONG','EMPRESA','VECINOS','OTRO')),
  organizer_name    text NOT NULL DEFAULT '',
  province          text NOT NULL,
  district          text NOT NULL DEFAULT '',
  community         text NOT NULL DEFAULT '',
  address           text NOT NULL CHECK (length(address) BETWEEN 3 AND 300),
  lat               double precision CHECK (lat BETWEEN 7.0 AND 9.8),
  lng               double precision CHECK (lng BETWEEN -83.1 AND -77.1),
  -- Horario por día: {"MON":{"open":"07:00","close":"18:00"},"TUE":null,...} (null = cerrado ese día;
  -- {"allDay":true} = 24 horas). hours_note: aclaraciones («hasta agotar espacio»).
  schedule          jsonb NOT NULL DEFAULT '{}',
  hours_note        text NOT NULL DEFAULT '',
  -- Contacto público: SOLO con consentimiento expreso de esa persona (contact_consent_at).
  contact_name      text NOT NULL DEFAULT '',
  contact_phone     text NOT NULL DEFAULT '',
  contact_whatsapp  text NOT NULL DEFAULT '',
  contact_consent_at timestamptz,
  notes             text NOT NULL DEFAULT '',
  -- PUBLISHED: visible (sujeto a reglas automáticas); CLOSED: cerrado por su responsable;
  -- REMOVED: retirado por moderación (último recurso).
  status            text NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','CLOSED','REMOVED')),
  manager_confirmed_at timestamptz NOT NULL DEFAULT now(), -- última confirmación de un responsable
  last_reminder_at  timestamptz,               -- último recordatorio «¿sigue funcionando?» a sus responsables
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  removed_reason    text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  published_at      timestamptz,
  closed_at         timestamptz,
  CHECK ((lat IS NULL) = (lng IS NULL))
);
CREATE INDEX centers_status_idx ON centers (status, province);

CREATE TABLE center_needs (
  center_id  uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  item       text NOT NULL,
  level      text NOT NULL CHECK (level IN ('URGENT','NEEDED','ENOUGH')),
  note       text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (center_id, item)
);

CREATE TABLE center_managers (
  center_id   uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (center_id, user_id)
);
CREATE INDEX center_managers_user_idx ON center_managers (user_id);

-- Confirmaciones de la comunidad («estuve aquí y sigue funcionando»). Sin datos personales:
-- solo un HMAC diario del origen (IP) para contar personas distintas.
CREATE TABLE confirmations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  origin_hmac text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX confirmations_center_idx ON confirmations (center_id, created_at);
CREATE UNIQUE INDEX confirmations_dedupe_uq ON confirmations (center_id, origin_hmac);

-- Reportes públicos («cerró», «información falsa», «pide dinero»…). Mismo esquema de origen.
CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  reason      text NOT NULL CHECK (reason IN ('CLOSED','WRONG_INFO','ASKS_MONEY','FAKE','NOT_RECEIVING','OTHER')),
  details     text NOT NULL DEFAULT '',
  origin_hmac text NOT NULL,
  -- OPEN cuenta para las reglas. Un responsable que corrige la ficha «resuelve» los reportes de
  -- información (WRONG_INFO, NOT_RECEIVING, CLOSED); los graves solo caducan o los cierra moderación.
  status      text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX reports_center_idx ON reports (center_id, status);
CREATE UNIQUE INDEX reports_dedupe_uq ON reports (center_id, origin_hmac) WHERE status = 'OPEN';

CREATE TABLE audit_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid,
  action      text NOT NULL,
  object_type text NOT NULL,
  object_id   text,
  reason      text NOT NULL DEFAULT '',
  meta        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_created_idx ON audit_events (created_at);
CREATE INDEX audit_events_object_idx ON audit_events (object_type, object_id);

CREATE FUNCTION audit_events_no_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events es de solo inserción';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_no_update();
