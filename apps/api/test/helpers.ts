/* Utilidades de prueba: base de datos real (PostgreSQL), app Nest en un puerto efímero y un cliente con cookies. */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://acopio:acopio@127.0.0.1:5432/acopio_test';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.SECRET_KEY = 'test-secret-key-0123456789abcdefghijklmnopqrstuvwxyz';
process.env.MAIL_MODE = 'outbox';
process.env.ENABLE_DEV_OUTBOX = 'true';
process.env.RELAX_RATE_LIMITS = 'true';
process.env.COOKIE_SECURE = 'false';
process.env.TRUST_PROXY = '1';

import type { INestApplication } from '@nestjs/common';
import { sql } from 'kysely';
import { authenticator } from 'otplib';
import { resetConfigCache } from '../src/config';
import { createDb, DB, migrate } from '../src/db/db';
import { MailService } from '../src/mail/mail.service';
import { createApp } from '../src/main';

authenticator.options = { step: 30, window: 1, digits: 6 };

export interface TestEnv {
  app: INestApplication;
  base: string;
  db: DB;
  mail: MailService;
  close: () => Promise<void>;
}

export async function setup(): Promise<TestEnv> {
  resetConfigCache();
  const db = createDb(process.env.DATABASE_URL!, 4);
  await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(db);
  await sql`CREATE SCHEMA public`.execute(db);
  await migrate(db);
  const app = await createApp({ logger: false });
  await app.listen(0, '127.0.0.1');
  const addr = app.getHttpServer().address() as { port: number };
  const base = `http://127.0.0.1:${addr.port}/api`;
  const mail = app.get(MailService);
  return {
    app,
    base,
    db,
    mail,
    close: async () => {
      await app.close();
      await db.destroy();
    },
  };
}

export interface Res<T = any> {
  status: number;
  body: T;
  headers: Headers;
  raw: Buffer;
}

/** Cliente HTTP con su propio tarro de cookies (como un navegador distinto). */
export class Client {
  cookies = new Map<string, string>();
  constructor(private readonly env: TestEnv) {}

  async req<T = any>(
    method: string,
    path: string,
    body?: unknown,
    opts: { csrf?: boolean; origin?: string; form?: FormData; headers?: Record<string, string> } = {},
  ): Promise<Res<T>> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (method !== 'GET' && opts.csrf !== false) headers['x-acp'] = '1';
    if (opts.origin) headers.origin = opts.origin;
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    let payload: FormData | string | undefined;
    if (opts.form) payload = opts.form;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(this.env.base + path, { method, headers, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /expires=thu, 01 jan 1970/i.test(a.trim())) || value === '';
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const raw = Buffer.from(await res.arrayBuffer());
    let parsed: unknown = raw.toString('utf8');
    if (res.headers.get('content-type')?.includes('application/json'))
      parsed = raw.length ? JSON.parse(raw.toString('utf8')) : null;
    return { status: res.status, body: parsed as T, headers: res.headers, raw };
  }
  get<T = any>(p: string) {
    return this.req<T>('GET', p);
  }
  post<T = any>(p: string, b: unknown = {}) {
    return this.req<T>('POST', p, b);
  }
  put<T = any>(p: string, b: unknown) {
    return this.req<T>('PUT', p, b);
  }
  patch<T = any>(p: string, b: unknown) {
    return this.req<T>('PATCH', p, b);
  }
  del<T = any>(p: string, b: unknown = {}) {
    return this.req<T>('DELETE', p, b);
  }
}

export function lastCode(env: TestEnv, email: string): string {
  const mails = env.mail.readOutbox(email).filter((m) => /código de acceso/i.test(m.subject));
  const code = mails[mails.length - 1]?.subject.match(/\d{8}/)?.[0];
  if (!code) throw new Error(`sin código para ${email}`);
  return code;
}

export async function login(env: TestEnv, email: string): Promise<Client> {
  const c = new Client(env);
  const r1 = await c.post('/auth/request-code', { email });
  if (r1.status !== 200) throw new Error(`request-code ${r1.status} ${JSON.stringify(r1.body)}`);
  const r2 = await c.post('/auth/verify-code', { code: lastCode(env, email) });
  if (r2.status !== 200) throw new Error(`verify-code ${email} → ${r2.status} ${JSON.stringify(r2.body)}`);
  return c;
}

const secrets = new Map<string, string>();

/** Código TOTP válido. En pruebas se limpia la marca anti-reuso para no esperar 30 s entre verificaciones. */
export async function totp(env: TestEnv, email: string): Promise<string> {
  await env.db.updateTable('users').set({ totpLastStep: null }).where('email', '=', email).execute();
  return authenticator.generate(secrets.get(email)!);
}

/** Inicia sesión como personal y deja el segundo factor configurado y verificado. */
export async function staffLogin(env: TestEnv, email: string): Promise<Client> {
  const c = await login(env, email);
  const s = await c.get('/auth/session');
  if (!s.body.mfaEnrolled || !secrets.has(email)) {
    const setup = await c.post('/auth/mfa/setup');
    if (setup.status !== 200) throw new Error(`mfa setup ${setup.status} ${JSON.stringify(setup.body)}`);
    secrets.set(email, setup.body.secret);
    const en = await c.post('/auth/mfa/enable', { code: await totp(env, email) });
    if (en.status !== 200) throw new Error(`mfa enable ${en.status} ${JSON.stringify(en.body)}`);
    (c as Client & { recovery?: string[] }).recovery = en.body.recoveryCodes;
  } else {
    const v = await c.post('/auth/mfa/verify', { code: await totp(env, email) });
    if (v.status !== 200) throw new Error(`mfa verify ${v.status} ${JSON.stringify(v.body)}`);
  }
  return c;
}

/** Inicia sesión como moderador (o admin) y deja el segundo factor verificado. */
export { staffLogin as modLogin };

let ipSeq = 10;
/** Un «origen» distinto (simula otra persona: otra IP detrás del proxy). */
export function person(env: TestEnv): Client {
  const c = new Client(env);
  const ip = `203.0.113.${ipSeq++ % 250}`;
  const orig = c.req.bind(c);
  c.req = ((method: string, path: string, body?: unknown, opts: Parameters<Client['req']>[3] = {}) =>
    orig(method, path, body, {
      ...opts,
      headers: { ...(opts.headers ?? {}), 'x-forwarded-for': ip },
    })) as Client['req'];
  return c;
}

export const SCHEDULE = {
  MON: { open: '08:00', close: '17:00' },
  TUE: { open: '08:00', close: '17:00' },
  WED: { open: '08:00', close: '17:00' },
  THU: { open: '08:00', close: '17:00' },
  FRI: { open: '08:00', close: '17:00' },
  SAT: { allDay: true },
  SUN: null,
};

export function centerBody(over: Record<string, unknown> = {}) {
  return {
    name: 'Centro de prueba',
    centerType: 'ACOPIO',
    organizerType: 'JUNTA_COMUNAL',
    organizerName: 'Junta de prueba',
    province: 'LOS_SANTOS',
    district: 'Tonosí',
    community: 'Cabecera',
    address: 'Frente al parque',
    lat: 7.405,
    lng: -80.443,
    schedule: SCHEDULE,
    hoursNote: 'Hasta agotar espacio',
    needs: [
      { item: 'WATER', level: 'URGENT' },
      { item: 'CLOTHES', level: 'ENOUGH' },
    ],
    ...over,
  };
}

export async function createCenter(c: Client, over: Record<string, unknown> = {}) {
  const r = await c.post('/centers', centerBody(over));
  if (r.status !== 201) throw new Error(`create ${r.status} ${JSON.stringify(r.body)}`);
  return r.body as { id: string; slug: string };
}
