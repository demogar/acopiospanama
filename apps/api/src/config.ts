import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const schema = z
  .object({
    // Por defecto, producción: si falta la variable, se aplican las reglas más estrictas.
    NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
    // Versión desplegada (la fija el Dockerfile a partir de package.json y el commit). Se expone en /api/health.
    APP_VERSION: z.string().default('dev'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    // Origen público de la web, p. ej. https://revisa.miph.com. Se usa para validar Origin y para enlaces en correos.
    APP_ORIGIN: z.string().url(),
    // Secreto maestro (>= 32 bytes aleatorios en hex o base64). De él se derivan las claves con HKDF.
    SECRET_KEY: z.string().min(43, 'SECRET_KEY debe tener al menos 32 bytes aleatorios (openssl rand -base64 48)'),
    MAIL_MODE: z.enum(['smtp', 'outbox']).default('smtp'),
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().default('Acopio Panamá <no-responder@localhost>'),
    COOKIE_SECURE: bool.optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    RESIDENT_IDLE_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(24 * 60)
      .default(60),
    RESIDENT_MAX_HOURS: z.coerce.number().int().min(1).max(72).default(12),
    STAFF_IDLE_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(24 * 60)
      .default(30),
    STAFF_MAX_HOURS: z.coerce.number().int().min(1).max(24).default(10),
    STEP_UP_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
    // Permite /api/dev/outbox para ver correos en desarrollo. Nunca en producción.
    ENABLE_DEV_OUTBOX: bool.default('false'),
    // Solo desarrollo y pruebas automáticas: relaja límites anti-abuso. Prohibido en producción.
    RELAX_RATE_LIMITS: bool.default('false'),
    RETENTION_CRON: z.string().default('0 30 3 * * *'),
  })
  .superRefine((c, ctx) => {
    if (c.NODE_ENV === 'production') {
      if (c.MAIL_MODE !== 'smtp') {
        ctx.addIssue({ code: 'custom', message: 'En producción MAIL_MODE debe ser smtp', path: ['MAIL_MODE'] });
      }
      if (c.RELAX_RATE_LIMITS) {
        ctx.addIssue({
          code: 'custom',
          message: 'RELAX_RATE_LIMITS no se permite en producción',
          path: ['RELAX_RATE_LIMITS'],
        });
      }
      if (c.ENABLE_DEV_OUTBOX) {
        ctx.addIssue({
          code: 'custom',
          message: 'ENABLE_DEV_OUTBOX no se permite en producción',
          path: ['ENABLE_DEV_OUTBOX'],
        });
      }
      if (!c.APP_ORIGIN.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', message: 'En producción APP_ORIGIN debe ser https://', path: ['APP_ORIGIN'] });
      }
      if (c.COOKIE_SECURE === false) {
        ctx.addIssue({
          code: 'custom',
          message: 'En producción las cookies deben ser Secure',
          path: ['COOKIE_SECURE'],
        });
      }
    }
    if (c.MAIL_MODE === 'smtp' && !c.SMTP_URL) {
      ctx.addIssue({ code: 'custom', message: 'SMTP_URL es obligatorio con MAIL_MODE=smtp', path: ['SMTP_URL'] });
    }
  });

export type AppConfig = z.infer<typeof schema> & { cookieSecure: boolean; appOrigin: string };

let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached && env === process.env) return cached;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  const c = parsed.data;
  const cfg: AppConfig = {
    ...c,
    appOrigin: new URL(c.APP_ORIGIN).origin,
    cookieSecure: c.COOKIE_SECURE ?? c.NODE_ENV === 'production',
  };
  if (env === process.env) cached = cfg;
  return cfg;
}

export function resetConfigCache() {
  cached = null;
}
