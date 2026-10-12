import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { INestApplicationContext } from '@nestjs/common';
import { sql } from 'kysely';
import { DATABASE } from '../common/core.module';
import type { DB } from '../db/db';
import { importCenters } from './import-centers';

/** Nombre de un lote: `NNN_descripcion.json`, como las migraciones. Se aplican en orden. */
export const BATCH_FILE = /^\d{3}_[a-z0-9-]+\.json$/;

/** Busca `data/centros` subiendo desde aquí: en el repo y en la imagen (`/app/data/centros`). */
export function findBatchesDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'data', 'centros');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error('No se encontró la carpeta data/centros');
}

export type BatchResult = { name: string; created: string[]; skipped: string[] };

/**
 * Importa los lotes de centros que aún no se han aplicado, en orden, y anota cada uno en
 * `center_batches`. Lo ejecuta la API al arrancar, tras las migraciones, con un candado consultivo
 * para que dos contenedores no importen a la vez. Un lote que falla no se anota: se reintenta en el
 * siguiente arranque, y los centros que ya alcanzó a crear se saltan por nombre.
 */
export async function importBatches(
  ctx: INestApplicationContext,
  opts: { email?: string; dir?: string; log?: (m: string) => void } = {},
): Promise<BatchResult[]> {
  const dir = opts.dir ?? findBatchesDir();
  const log = opts.log ?? (() => {});
  const files = readdirSync(dir)
    .filter((f) => BATCH_FILE.test(f))
    .sort();
  const db = ctx.get<DB>(DATABASE);
  const results: BatchResult[] = [];
  await db.connection().execute(async (conn) => {
    await sql`SELECT pg_advisory_lock(727275)`.execute(conn);
    try {
      const done = await sql<{ name: string }>`SELECT name FROM center_batches`.execute(conn);
      const doneSet = new Set(done.rows.map((r) => r.name));
      const pending = files.filter((f) => !doneSet.has(f));
      if (pending.length && !opts.email) {
        throw new Error(`Hay lotes de centros pendientes (${pending.join(', ')}) y falta CENTROS_EMAIL`);
      }
      for (const name of pending) {
        const r = await importCenters(ctx, { email: opts.email!, file: join(dir, name) });
        await sql`INSERT INTO center_batches (name) VALUES (${name})`.execute(conn);
        results.push({ name, ...r });
        log(`lote aplicado: ${name} (${r.created.length} nuevo(s), ${r.skipped.length} ya existían)`);
      }
    } finally {
      await sql`SELECT pg_advisory_unlock(727275)`.execute(conn);
    }
  });
  return results;
}
