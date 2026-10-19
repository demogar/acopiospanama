import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { sql } from 'kysely';
import { z } from 'zod';
import { BATCH_FILE, findBatchesDir, importBatches } from '../src/cli/import-batches';
import { closeBatchSchema, isCloseBatch } from '../src/cli/close-centers';
import { entrySchema } from '../src/cli/import-centers';
import { CentersService, checkDates } from '../src/centers/centers.service';
import { parse } from '../src/common/http';
import { centerBody, setup, TestEnv } from './helpers';

let env: TestEnv;
before(async () => (env = await setup()));
after(async () => env.close());

const entry = (name: string, over: Record<string, unknown> = {}) =>
  centerBody({ name, source: { title: 'Nota de prueba', date: '2026-10-11' }, ...over });

describe('lotes de data/centros', () => {
  // Un lote roto debe fallar aquí, en el PR, y no al arrancar la API en producción.
  it('todos los lotes del repo son válidos y siguen el formato NNN_nombre.json', () => {
    const dir = findBatchesDir();
    const centers = env.app.get(CentersService);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      assert.match(f, BATCH_FILE, `${f}: debe llamarse NNN_nombre.json para aplicarse`);
      const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (isCloseBatch(data)) {
        parse(closeBatchSchema, data);
        continue;
      }
      const entries = parse(z.array(entrySchema).min(1), data);
      for (const e of entries) {
        centers.validateNoMoney(e, e.needs);
        checkDates(e);
      }
    }
  });

  it('se aplican una sola vez, en orden, como las migraciones', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lotes-'));
    writeFileSync(join(dir, '002_b.json'), JSON.stringify([entry('Centro B')]));
    writeFileSync(join(dir, '001_a.json'), JSON.stringify([entry('Centro A')]));
    writeFileSync(join(dir, 'notas.txt'), 'se ignora');

    const r1 = await importBatches(env.app, { email: 'lotes@x.test', dir });
    assert.deepEqual(
      r1.map((r) => [r.name, r.created.length]),
      [
        ['001_a.json', 1],
        ['002_b.json', 1],
      ],
    );
    assert.deepEqual(await importBatches(env.app, { email: 'lotes@x.test', dir }), []);

    // Un lote nuevo: solo se aplica ese, y lo que ya existe por nombre se salta.
    writeFileSync(join(dir, '003_c.json'), JSON.stringify([entry('Centro C'), entry('Centro A')]));
    const r3 = await importBatches(env.app, { email: 'lotes@x.test', dir });
    assert.equal(r3.length, 1);
    assert.equal(r3[0].created.length, 1);
    assert.equal(r3[0].skipped.length, 1);

    const { rows } = await sql<{
      n: number;
    }>`SELECT count(*)::int AS n FROM centers WHERE name LIKE 'Centro _'`.execute(env.db);
    assert.equal(rows[0].n, 3);
  });

  it('un lote que falla no se anota y detiene el arranque', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lotes-'));
    writeFileSync(join(dir, '001_dinero.json'), JSON.stringify([entry('Centro D', { notes: 'Yappy al 6000-0000' })]));
    await assert.rejects(importBatches(env.app, { email: 'lotes@x.test', dir }));
    const { rows } = await sql`SELECT 1 FROM center_batches WHERE name = '001_dinero.json'`.execute(env.db);
    assert.equal(rows.length, 0);
  });

  it('un lote de cierre cierra los centros que siguen en manos de quien los cargó', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lotes-'));
    writeFileSync(join(dir, '001_altas.json'), JSON.stringify([entry('Centro F'), entry('Centro G')]));
    await importBatches(env.app, { email: 'lotes@x.test', dir });
    const slugs = await sql<{
      name: string;
      slug: string;
    }>`SELECT name, slug FROM centers WHERE name IN ('Centro F', 'Centro G')`.execute(env.db);
    const slug = (n: string) => slugs.rows.find((r) => r.name === n)!.slug;
    // Una organización reclamó el G: ese no se toca.
    await sql`INSERT INTO users (email) VALUES ('org@x.test')`.execute(env.db);
    await sql`INSERT INTO center_managers (center_id, user_id, accepted_at)
      SELECT c.id, u.id, now() FROM centers c, users u WHERE c.slug = ${slug('Centro G')} AND u.email = 'org@x.test'`.execute(
      env.db,
    );

    writeFileSync(
      join(dir, '002_cierre.json'),
      JSON.stringify({
        date: '2026-10-19',
        close: [
          { slug: slug('Centro F'), reason: 'Sin noticias desde el anuncio' },
          { slug: slug('Centro G'), reason: 'Sin noticias desde el anuncio' },
          { slug: 'no-existe', reason: 'Sin noticias desde el anuncio' },
        ],
      }),
    );
    const [r] = await importBatches(env.app, { email: 'lotes@x.test', dir });
    assert.deepEqual(r.closed, [slug('Centro F')]);
    assert.equal(r.skipped.length, 2);
    const { rows } = await sql<{
      name: string;
      status: string;
    }>`SELECT name, status FROM centers WHERE name IN ('Centro F', 'Centro G') ORDER BY name`.execute(env.db);
    assert.deepEqual(
      rows.map((x) => x.status),
      ['CLOSED', 'PUBLISHED'],
    );
  });

  it('sin CENTROS_EMAIL no arranca si hay lotes pendientes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lotes-'));
    writeFileSync(join(dir, '001_e.json'), JSON.stringify([entry('Centro E')]));
    await assert.rejects(importBatches(env.app, { dir }), /CENTROS_EMAIL/);
  });
});
