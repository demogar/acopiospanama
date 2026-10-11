import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CamelCasePlugin, Kysely, PostgresDialect, sql } from 'kysely';
import { Pool, types } from 'pg';
import type { Database } from './types';

// int8 (count(*)) como número: los conteos de esta app nunca superan 2^53.
types.setTypeParser(20, (v) => Number(v));

export type DB = Kysely<Database>;

export function createDb(databaseUrl: string, max = 10): DB {
  const pool = new Pool({ connectionString: databaseUrl, max });
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()],
  });
}

function findMigrationsDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'migrations');
    if (existsSync(candidate) && existsSync(join(dir, 'package.json'))) return candidate;
    dir = dirname(dir);
  }
  throw new Error('No se encontró la carpeta migrations');
}

/**
 * Aplica migraciones SQL en orden, cada una en su transacción, con un candado consultivo
 * para que dos procesos no migren a la vez.
 */
export async function migrate(db: DB, log: (m: string) => void = () => {}): Promise<string[]> {
  const dir = findMigrationsDir();
  const files = readdirSync(dir)
    .filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f))
    .sort();
  const applied: string[] = [];
  await db.connection().execute(async (conn) => {
    await sql`SELECT pg_advisory_lock(727274)`.execute(conn);
    try {
      await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`.execute(
        conn,
      );
      const done = await sql<{ name: string }>`SELECT name FROM schema_migrations`.execute(conn);
      const doneSet = new Set(done.rows.map((r) => r.name));
      for (const file of files) {
        if (doneSet.has(file)) continue;
        const body = readFileSync(join(dir, file), 'utf8');
        await conn.transaction().execute(async (trx) => {
          await sql.raw(body).execute(trx);
          await sql`INSERT INTO schema_migrations (name) VALUES (${file})`.execute(trx);
        });
        applied.push(file);
        log(`migración aplicada: ${file}`);
      }
    } finally {
      await sql`SELECT pg_advisory_unlock(727274)`.execute(conn);
    }
  });
  return applied;
}
