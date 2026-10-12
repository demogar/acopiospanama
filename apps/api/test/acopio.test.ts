import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { sql } from 'kysely';
import { CentersService } from '../src/centers/centers.service';
import { clientKey } from '../src/common/crypto';
import { openNow } from '../src/domain';
import { JobsService } from '../src/jobs/jobs.service';
import {
  Client,
  createCenter,
  importBatch,
  importError,
  centerBody,
  lastCode,
  login,
  modLogin,
  person,
  setup,
  TestEnv,
} from './helpers';

let env: TestEnv;

before(async () => {
  env = await setup();
  await env.db
    .insertInto('users')
    .values([
      { email: 'mod@x.test', isModerator: true, verifiedAt: new Date() },
      { email: 'admin@x.test', isAdmin: true, isModerator: true, verifiedAt: new Date() },
    ])
    .execute();
});
after(async () => env.close());

const ago = (h: number) => new Date(Date.now() - h * 3_600_000);
const pub = async (slug: string) => await new Client(env).get(`/public/centers/${slug}`);
const listed = async (id: string) =>
  ((await new Client(env).get('/public/centers')).body as { id: string }[]).some((c) => c.id === id);
const invalidate = () => env.app.get(CentersService).invalidate();

describe('acceso', () => {
  it('cualquiera puede entrar con su correo; queda verificado al usar el código', async () => {
    const c = await login(env, 'nueva@x.test');
    const u = await env.db
      .selectFrom('users')
      .select(['verifiedAt'])
      .where('email', '=', 'nueva@x.test')
      .executeTakeFirstOrThrow();
    assert.ok(u.verifiedAt);
    assert.equal((await c.get('/me')).status, 200);
  });

  it('una cuenta bloqueada no recibe código', async () => {
    await env.db.insertInto('users').values({ email: 'bloq@x.test', disabledAt: new Date() }).execute();
    const c = new Client(env);
    assert.equal((await c.post('/auth/request-code', { email: 'bloq@x.test' })).status, 200);
    assert.equal(env.mail.readOutbox('bloq@x.test').length, 0);
  });

  it('mutaciones sin cabecera CSRF se rechazan', async () => {
    const c = await login(env, 'csrf@x.test');
    assert.equal((await c.req('DELETE', '/me', undefined, { csrf: false })).status, 403);
  });

  it('lo público no exige sesión; lo demás sí', async () => {
    const anon = new Client(env);
    assert.equal((await anon.get('/public/centers')).status, 200);
    assert.equal((await anon.get('/public/meta')).status, 200);
    assert.equal((await anon.get('/me')).status, 401);
    assert.equal((await anon.del('/me')).status, 401);
  });

  it('ya no se publican ni se editan centros desde la web', async () => {
    const c = await login(env, 'web@x.test');
    const center = await createCenter(env, { name: 'Centro sin edición' });
    assert.equal((await c.post('/centers', centerBody({ name: 'Desde la web' }))).status, 404);
    assert.equal((await c.patch(`/centers/${center.id}`, { hoursNote: 'x' })).status, 404);
    assert.equal((await c.put(`/centers/${center.id}/needs`, { needs: [] })).status, 404);
    assert.equal((await c.get(`/centers/${center.id}/managers`)).status, 404);
    assert.equal((await new Client(env).post('/public/confirm-link', { token: 'x' })).status, 404);
  });

  it('borrar la cuenta cierra los centros donde era el único responsable', async () => {
    const c = await createCenter(env, { name: 'Centro que cierra' }, 'leaving@x.test');
    const u = await login(env, 'leaving@x.test');
    assert.equal((await u.del('/me')).status, 200);
    assert.equal((await u.get('/me')).status, 401);
    const row = await env.db.selectFrom('centers').select('status').where('id', '=', c.id).executeTakeFirstOrThrow();
    assert.equal(row.status, 'CLOSED');
    assert.equal(await listed(c.id), false);
  });
});

describe('importar un lote', () => {
  it('valida tipo y exige la ubicación exacta', async () => {
    const noLoc = await importError(env, { lat: undefined, lng: undefined });
    assert.equal(noLoc.status, 400);
    assert.ok(noLoc.fields?.lat);
    assert.equal((await importError(env, { lat: 40.4, lng: -3.7 })).status, 400);
    const noType = await importError(env, { centerType: 'X' });
    assert.equal(noType.status, 400);
    assert.ok(noType.fields?.centerType);
  });

  it('bloquea pedidos de dinero, cuentas y Yappy en cualquier texto', async () => {
    for (const over of [
      { notes: 'Donaciones por Yappy al 6000-0000' },
      { notes: 'Cuenta de ahorros Banco General' },
      { hoursNote: 'Transferencia ACH' },
      { name: 'Centro 0412345678901' },
      { needs: [{ item: 'WATER', level: 'URGENT', note: 'o deposita en Banistmo' }] },
    ]) {
      const r = await importError(env, over);
      assert.equal(r.status, 400, JSON.stringify(over));
      assert.equal(r.code, 'MONEY_NOT_ALLOWED');
    }
    // Un teléfono normal (7–8 dígitos) no es dinero.
    await createCenter(env, { name: 'Centro con teléfono', notes: 'Llamar al 6000-1234' });
  });

  it('el contacto solo se publica con consentimiento expreso', async () => {
    const contact = { contactName: 'Ana Pérez', contactPhone: '6000-1111', contactWhatsapp: '+507 6000-1111' };
    const noConsent = await importError(env, { name: 'Con contacto', ...contact });
    assert.equal(noConsent.status, 400);
    assert.ok(noConsent.fields?.contactConsent);
    const created = await createCenter(env, { name: 'Con contacto', ...contact, contactConsent: true });
    const p = await pub(created.slug);
    assert.equal(p.body.contactName, 'Ana Pérez');
    assert.equal(p.body.contactWhatsapp, '+507 6000-1111');
  });

  it('el público nunca ve correos; el horario y «abierto ahora» vienen calculados', async () => {
    const created = await createCenter(env, { name: 'Centro visible' });
    const list = await new Client(env).get('/public/centers');
    const text = JSON.stringify(list.body);
    assert.ok(!text.includes('@x.test'));
    const mine = list.body.find((x: { id: string }) => x.id === created.id);
    assert.ok(mine, 'aparece de inmediato (la caché se invalida al importar)');
    assert.equal(mine.centerType, 'ACOPIO');
    assert.equal(mine.schedule.SAT.allDay, true);
    assert.equal(typeof mine.openNow, 'boolean');
    assert.match(list.headers.get('cache-control') ?? '', /public/);
  });

  it('repetir un lote no duplica: se salta lo que ya existe con el mismo nombre', async () => {
    await createCenter(env, { name: 'Gimnasio Las Tablas' });
    const again = await importBatch(env, [centerBody({ name: 'gimnasio las tablas' })]);
    assert.equal(again.ids.length, 0);
    assert.equal(again.skipped.length, 1);
  });
});

describe('reglas automáticas (auto-mantenimiento)', () => {
  it('lo publicado no caduca: sin confirmaciones sigue visible y en la lista, y la retención no lo borra', async () => {
    const c = await createCenter(env, { name: 'Centro sin confirmar' });
    await env.db
      .updateTable('centers')
      .set({ managerConfirmedAt: ago(200 * 24) })
      .where('id', '=', c.id)
      .execute();
    invalidate();
    assert.equal((await pub(c.slug)).body.visibility, 'VISIBLE');
    assert.equal(await listed(c.id), true);
    await env.app.get(JobsService).retention();
    assert.ok(await env.db.selectFrom('centers').select('id').where('id', '=', c.id).executeTakeFirst());
  });

  it('confirmaciones: una por persona y día', async () => {
    const c = await createCenter(env, { name: 'Centro confirmado' });
    const p = person(env);
    await p.post(`/public/centers/${c.id}/confirm`);
    await p.post(`/public/centers/${c.id}/confirm`);
    await person(env).post(`/public/centers/${c.id}/confirm`);
    assert.equal((await pub(c.slug)).body.confirmations, 2);
  });

  it('reportes: 2 personas → marcado; 3 graves que superan confirmaciones → oculto (410); más confirmaciones lo vuelven a mostrar', async () => {
    const c = await createCenter(env, { name: 'Centro reportado' });
    const r1 = person(env);
    assert.equal((await r1.post(`/public/centers/${c.id}/report`, { reason: 'ASKS_MONEY' })).body.duplicate, false);
    assert.equal(
      (await r1.post(`/public/centers/${c.id}/report`, { reason: 'FAKE' })).body.duplicate,
      true,
      'misma persona no cuenta dos veces',
    );
    assert.equal((await pub(c.slug)).body.flagged, false);
    await person(env).post(`/public/centers/${c.id}/report`, { reason: 'FAKE' });
    assert.equal((await pub(c.slug)).body.flagged, true);
    await person(env).post(`/public/centers/${c.id}/report`, { reason: 'CLOSED' });
    const hidden = await pub(c.slug);
    assert.equal(hidden.status, 410);
    assert.equal(await listed(c.id), false);
    // Contrapeso: la comunidad puede confirmar aunque esté oculto; más confirmaciones que reportes → visible.
    for (let i = 0; i < 5; i++) assert.equal((await person(env).post(`/public/centers/${c.id}/confirm`)).status, 200);
    assert.equal((await pub(c.slug)).status, 200);
  });

  it('«se aprovechan» es grave: 3 personas distintas ocultan el centro', async () => {
    const c = await createCenter(env, { name: 'Centro que desvía' });
    const meta = await new Client(env).get('/public/meta');
    assert.ok(meta.body.reportReasons.DIVERTED);
    for (let i = 0; i < 3; i++) await person(env).post(`/public/centers/${c.id}/report`, { reason: 'DIVERTED' });
    assert.equal((await pub(c.slug)).status, 410);
  });
});

describe('abuso', () => {
  it('la misma persona no suma un reporte nuevo cada día; IPv6 del mismo /64 cuenta como una', async () => {
    const c = await createCenter(env, { name: 'Centro atacado' });
    const ip6 = (n: number) => `2001:db8:abcd:12::${n.toString(16)}`;
    for (let i = 1; i <= 5; i++) {
      const r = await new Client(env).req(
        'POST',
        `/public/centers/${c.id}/report`,
        { reason: 'FAKE' },
        { headers: { 'x-forwarded-for': ip6(i) } },
      );
      assert.equal(r.status, 200);
    }
    const n = await env.db
      .selectFrom('reports')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('centerId', '=', c.id)
      .executeTakeFirstOrThrow();
    assert.equal(Number(n.n), 1);
    assert.equal((await pub(c.slug)).status, 200);
  });

  it('textos con enlaces, HTML o dinero disfrazado se rechazan indicando el campo', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ name: '<a href=//evil.example>Dona aquí</a>' }, 'name'],
      [{ notes: 'Más info en donaaqui.com' }, 'notes'],
      [{ community: 'Y a p p y 6000-0000' }, 'community'],
      [{ district: 'Yаppy' }, 'district'],
      [{ needs: [{ item: 'WATER', level: 'URGENT', note: 'BG ahorros 04.01.01.123456.7' }] }, 'needs.0.note'],
    ];
    for (const [over, field] of cases) {
      const r = await importError(env, over);
      assert.equal(r.status, 400, JSON.stringify(over));
      assert.ok(r.fields?.[field], `${field}: ${JSON.stringify(r)}`);
    }
    // Referencias normales sí.
    await createCenter(env, {
      name: 'Frente al banco',
      address: 'Frente al Banco Nacional, al lado del depósito municipal',
    });
  });

  it('«publicaron mis datos sin permiso» oculta el contacto al instante', async () => {
    const c = await createCenter(env, {
      name: 'Centro con datos',
      contactName: 'Tercero',
      contactPhone: '6000-2222',
      contactConsent: true,
    });
    assert.equal((await pub(c.slug)).body.contactName, 'Tercero');
    await person(env).post(`/public/centers/${c.id}/report`, { reason: 'MY_DATA' });
    const p = await pub(c.slug);
    assert.equal(p.body.contactName, '');
    assert.equal(p.body.contactPhone, '');
  });

  it('el segundo factor se bloquea 15 min tras 10 códigos incorrectos', async () => {
    const m = await modLogin(env, 'mod@x.test');
    for (let i = 0; i < 10; i++) await m.post('/auth/mfa/verify', { code: '000000' });
    const locked = await m.post('/auth/mfa/verify', { code: '000000' });
    assert.equal(locked.status, 429);
    await env.db
      .updateTable('users')
      .set({ mfaLockedUntil: null, mfaFailedCount: 0 })
      .where('email', '=', 'mod@x.test')
      .execute();
  });
});

describe('moderación (último recurso)', () => {
  it('solo moderación con segundo factor; retirar, ver en la cola, restaurar', async () => {
    const u = await login(env, 'victim@x.test');
    const c = await createCenter(env, { name: 'Centro moderado' });
    assert.equal((await u.get('/mod/queue')).status, 404);
    const noMfa = await login(env, 'mod@x.test');
    assert.equal((await noMfa.get('/mod/queue')).status, 403);
    const mod = await modLogin(env, 'mod@x.test');
    const q = await mod.get('/mod/queue');
    assert.equal(q.status, 200);
    assert.ok(!JSON.stringify(q.body).includes('@x.test'), 'la cola no expone correos');
    assert.equal((await mod.post(`/mod/centers/${c.id}/remove`, { reason: 'Estafa evidente' })).status, 200);
    assert.equal((await pub(c.slug)).status, 404);
    assert.ok(
      (await mod.get('/mod/queue')).body.some(
        (x: { id: string; status: string }) => x.id === c.id && x.status === 'REMOVED',
      ),
    );
    assert.equal((await mod.post(`/mod/centers/${c.id}/restore`, { reason: 'Error' })).status, 200);
    assert.equal((await pub(c.slug)).status, 200);
  });

  it('bloquear a quien publicó: retira sus centros y corta su sesión (exige confirmación reciente)', async () => {
    const c1 = await createCenter(env, { name: 'Spam 1' }, 'spam@x.test');
    const c2 = await createCenter(env, { name: 'Spam 2' }, 'spam@x.test');
    const spam = await login(env, 'spam@x.test');
    const mod = await modLogin(env, 'mod@x.test');
    await env.db
      .updateTable('sessions')
      .set({ stepUpAt: ago(1) })
      .execute();
    assert.equal((await mod.post('/mod/users/block', { centerId: c1.id, reason: 'Spam' })).status, 403);
    await env.db.updateTable('sessions').set({ stepUpAt: new Date() }).execute();
    assert.equal((await mod.post('/mod/users/block', { centerId: c1.id, reason: 'Spam' })).status, 200);
    assert.equal((await spam.get('/me')).status, 401);
    assert.equal(await listed(c2.id), false);
    // No puede volver a entrar.
    const again = new Client(env);
    await again.post('/auth/request-code', { email: 'spam@x.test' });
    assert.equal((await again.post('/auth/verify-code', { code: lastCode(env, 'spam@x.test') })).status, 400);
  });

  it('solo el admin nombra moderadores', async () => {
    const mod = await modLogin(env, 'mod@x.test');
    assert.equal((await mod.get('/mod/moderators')).status, 404);
    const admin = await modLogin(env, 'admin@x.test');
    const r = await admin.post('/mod/moderators', { email: 'mod2@x.test', moderator: true });
    assert.equal(r.status, 200);
    assert.equal(
      (
        await env.db
          .selectFrom('users')
          .select('isModerator')
          .where('email', '=', 'mod2@x.test')
          .executeTakeFirstOrThrow()
      ).isModerator,
      true,
    );
  });
});

describe('horario', () => {
  // 2026-10-12 es lunes. Hora de Panamá = UTC−5.
  const at = (isoLocal: string) => new Date(`${isoLocal}-05:00`);
  it('abierto/cerrado según el día y la hora de Panamá, incluido 24 h y tramos que cruzan medianoche', () => {
    const s = {
      MON: { open: '08:00', close: '17:00' },
      TUE: { open: '20:00', close: '02:00' },
      SAT: { allDay: true as const },
      SUN: null,
    };
    assert.equal(openNow(s, at('2026-10-12T09:00:00')), true);
    assert.equal(openNow(s, at('2026-10-12T17:00:00')), false);
    assert.equal(openNow(s, at('2026-10-12T07:59:00')), false);
    assert.equal(openNow(s, at('2026-10-13T23:30:00')), true, 'martes de noche');
    assert.equal(openNow(s, at('2026-10-14T01:30:00')), true, 'miércoles de madrugada (tramo del martes)');
    assert.equal(openNow(s, at('2026-10-14T03:00:00')), false);
    assert.equal(openNow(s, at('2026-10-17T03:00:00')), true, 'sábado 24 h');
    assert.equal(openNow(s, at('2026-10-18T12:00:00')), false, 'domingo cerrado');
    assert.equal(openNow({}, at('2026-10-12T09:00:00')), null, 'sin horario');
  });

  it('rechaza horarios mal formados', async () => {
    assert.equal((await importError(env, { schedule: { MON: { open: '25:00', close: '17:00' } } })).status, 400);
    assert.equal((await importError(env, { schedule: { FUNDAY: null } })).status, 400);
  });
});

describe('identidad de origen', () => {
  it('IPv6 se agrupa por /64; IPv4 completa', () => {
    assert.equal(clientKey('2001:db8:abcd:12::1'), clientKey('2001:db8:abcd:12:ffff::9'));
    assert.notEqual(clientKey('2001:db8:abcd:12::1'), clientKey('2001:db8:abcd:13::1'));
    assert.equal(clientKey('::ffff:10.0.0.1'), '10.0.0.1');
    assert.notEqual(clientKey('10.0.0.1'), clientKey('10.0.0.2'));
  });
});

describe('retención', () => {
  it('borra cuentas no verificadas, confirmaciones viejas y centros cerrados hace más de 180 días', async () => {
    await new Client(env).post('/auth/request-code', { email: 'nunca@x.test' });
    await env.db
      .updateTable('users')
      .set({ createdAt: ago(48) })
      .where('email', '=', 'nunca@x.test')
      .execute();
    await login(env, 'old@x.test');
    const c = await createCenter(env, { name: 'Centro cerrado hace tiempo' });
    await env.db
      .updateTable('centers')
      .set({ status: 'CLOSED', updatedAt: ago(200 * 24) })
      .where('id', '=', c.id)
      .execute();
    await env.db
      .insertInto('confirmations')
      .values({ centerId: c.id, originHmac: 'x', createdAt: ago(40 * 24) })
      .execute();
    const counts = await env.app.get(JobsService).retention();
    assert.ok(counts.unverifiedUsers >= 1);
    assert.equal(
      await env.db.selectFrom('users').select('id').where('email', '=', 'nunca@x.test').executeTakeFirst(),
      undefined,
    );
    assert.equal(await env.db.selectFrom('centers').select('id').where('id', '=', c.id).executeTakeFirst(), undefined);
    assert.ok(
      await env.db.selectFrom('users').select('id').where('email', '=', 'old@x.test').executeTakeFirst(),
      'la cuenta verificada se conserva',
    );
    await assert.rejects(sql`UPDATE audit_events SET action = 'x'`.execute(env.db), /solo inserción/);
  });
});
