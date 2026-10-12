import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { normalizeEmail } from '../common/crypto';
import { createDb, migrate } from '../db/db';

const HELP = `Acopio Panamá — línea de comandos

  migrate                         Aplica migraciones pendientes.
  make-admin --email <correo>     Administrador (nombra moderadores; incluye moderación).
  make-moderator --email <correo> Moderador (retira centros, bloquea abusos).
  revoke-role --email <correo>    Quita moderación y administración.
  reset-mfa --email <correo>      Quita el segundo factor (si se perdió el teléfono).
  retention                       Aplica la retención ahora.
  revoke-all-sessions             Cierra todas las sesiones (tras restaurar un respaldo).
  import-centers --email <correo> [--file centros.json]
                                  Importa centros anunciados públicamente (JSON por archivo o stdin)
                                  a nombre de ese correo. Ver data/centros/README.md.
  import-batches                  Importa los lotes de data/centros aún no aplicados, a nombre de
                                  CENTROS_EMAIL. La API lo ejecuta al arrancar, tras migrate.
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help') return console.log(HELP);
  const { values } = parseArgs({
    args: rest,
    options: { email: { type: 'string' }, file: { type: 'string' } },
    strict: true,
  });

  if (cmd === 'retention' || cmd === 'import-centers' || cmd === 'import-batches') {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../app.module');
    const ctx = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
    if (cmd === 'retention') {
      const { JobsService } = await import('../jobs/jobs.service');
      console.log('Retención aplicada:', await ctx.get(JobsService).retention());
    } else if (cmd === 'import-batches') {
      const { importBatches } = await import('./import-batches');
      const r = await importBatches(ctx, { email: process.env.CENTROS_EMAIL, log: console.log });
      if (!r.length) console.log('No hay lotes de centros pendientes.');
    } else {
      const { importCenters } = await import('./import-centers');
      const r = await importCenters(ctx, { email: values.email ?? '', file: values.file });
      for (const c of r.created) console.log(`+ ${c}`);
      for (const c of r.skipped) console.log(`= ${c}`);
      console.log(`${r.created.length} centro(s) importado(s), ${r.skipped.length} ya existían.`);
    }
    await ctx.close();
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const db = createDb(url, 2);
  try {
    const email = values.email ? normalizeEmail(values.email) : '';
    const needEmail = () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Falta --email válido');
    };
    const audit = (action: string, objectId: string | null) =>
      db
        .insertInto('auditEvents')
        .values({ actorId: null, action, objectType: 'user', objectId, meta: JSON.stringify({}) })
        .execute();
    switch (cmd) {
      case 'migrate': {
        const applied = await migrate(db, console.log);
        console.log(
          applied.length ? `${applied.length} migración(es) aplicada(s).` : 'La base de datos ya está al día.',
        );
        break;
      }
      case 'make-admin':
      case 'make-moderator': {
        needEmail();
        await db
          .insertInto('users')
          .values({ email })
          .onConflict((oc) => oc.column('email').doNothing())
          .execute();
        const set = cmd === 'make-admin' ? { isAdmin: true, isModerator: true } : { isModerator: true };
        const u = await db
          .updateTable('users')
          .set(set)
          .where('email', '=', email)
          .returning('id')
          .executeTakeFirstOrThrow();
        await audit(`cli.${cmd}`, u.id);
        console.log(
          `${email}: ${cmd === 'make-admin' ? 'administrador' : 'moderador'}. Al entrar configurará su segundo factor.`,
        );
        break;
      }
      case 'revoke-role': {
        needEmail();
        const u = await db
          .updateTable('users')
          .set({ isAdmin: false, isModerator: false })
          .where('email', '=', email)
          .returning('id')
          .executeTakeFirst();
        if (!u) throw new Error('Usuario no encontrado');
        await db
          .updateTable('sessions')
          .set({ revokedAt: new Date() })
          .where('userId', '=', u.id)
          .where('revokedAt', 'is', null)
          .execute();
        await audit('cli.revoke_role', u.id);
        console.log(`${email}: sin rol de moderación.`);
        break;
      }
      case 'reset-mfa': {
        needEmail();
        const u = await db
          .updateTable('users')
          .set({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] })
          .where('email', '=', email)
          .returning('id')
          .executeTakeFirst();
        if (!u) throw new Error('Usuario no encontrado');
        await db
          .updateTable('sessions')
          .set({ revokedAt: new Date() })
          .where('userId', '=', u.id)
          .where('revokedAt', 'is', null)
          .execute();
        await audit('cli.reset_mfa', u.id);
        console.log(`Segundo factor restablecido para ${email}.`);
        break;
      }
      case 'revoke-all-sessions': {
        const r = await db
          .updateTable('sessions')
          .set({ revokedAt: new Date() })
          .where('revokedAt', 'is', null)
          .executeTakeFirst();
        console.log(`${Number(r.numUpdatedRows)} sesión(es) cerrada(s).`);
        break;
      }
      default:
        console.error(`Comando desconocido: ${cmd}\n\n${HELP}`);
        process.exitCode = 2;
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
