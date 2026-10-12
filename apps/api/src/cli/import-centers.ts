import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { sql } from 'kysely';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CentersService, contactFields, createCenterSchema, needsSchema } from '../centers/centers.service';
import { DATABASE, KEYS } from '../common/core.module';
import { hmac, Keys, normalizeEmail } from '../common/crypto';
import { parse, shortText } from '../common/http';
import type { DB } from '../db/db';
import { slugify } from '../domain';

/**
 * Importa centros anunciados públicamente (prensa, redes de las organizaciones) desde un JSON.
 * Pasan por las mismas validaciones que el formulario de publicar (incluido el filtro antidinero)
 * y quedan a nombre del correo indicado, que puede editarlos o cerrarlos desde «Mis centros».
 * La fuente y su fecha se añaden a las notas del centro, para que cualquiera pueda contrastarla.
 */
const entrySchema = createCenterSchema
  .extend({
    needs: needsSchema.default([]),
    source: z.object({
      title: shortText(120),
      url: z.string().url().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD'),
    }),
  })
  .strict();

export type ImportResult = { created: string[]; skipped: string[] };

export async function importCenters(
  ctx: INestApplicationContext,
  opts: { email: string; file?: string },
): Promise<ImportResult> {
  const raw = readFileSync(opts.file ?? 0, 'utf8');
  const entries = parse(z.array(entrySchema).min(1), JSON.parse(raw));
  const db = ctx.get<DB>(DATABASE);
  const keys = ctx.get<Keys>(KEYS);
  const centers = ctx.get(CentersService);
  const audit = ctx.get(AuditService);

  const email = normalizeEmail(opts.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Falta --email válido del responsable');
  await db
    .insertInto('users')
    .values({ email })
    .onConflict((oc) => oc.column('email').doNothing())
    .execute();
  const user = await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow();
  const creatorEmailHmac = hmac(keys.email, email);

  const result: ImportResult = { created: [], skipped: [] };
  for (const entry of entries) {
    const { needs, source, contactConsent: _c, schedule, ...rest } = entry;
    centers.validateNoMoney(rest, needs);
    const consent = contactFields(entry);
    const existing = await db
      .selectFrom('centers')
      .select(['slug'])
      .where(sql<string>`lower(name)`, '=', entry.name.toLowerCase())
      .where('status', '!=', 'REMOVED')
      .executeTakeFirst();
    if (existing) {
      result.skipped.push(`${entry.name} (ya existe: /c/${existing.slug})`);
      continue;
    }
    const date = new Date(`${source.date}T12:00:00Z`).toLocaleDateString('es-PA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const notes = [rest.notes, `Fuente: ${source.title} (${date}).${source.url ? ` ${source.url}` : ''}`]
      .filter(Boolean)
      .join('\n\n');
    if (notes.length > 600) throw new Error(`${entry.name}: las notas más la fuente superan 600 caracteres`);
    const fields = { ...rest, ...consent, notes, schedule: JSON.stringify(schedule) };

    const center = await db.transaction().execute(async (trx) => {
      const base = slugify(`${fields.name} ${fields.community || fields.district}`) || 'centro';
      let slug = base;
      for (let i = 0; i < 6; i++) {
        const taken = await trx.selectFrom('centers').select('id').where('slug', '=', slug).executeTakeFirst();
        if (!taken) break;
        slug = `${base}-${randomInt(100, 9999)}`;
      }
      const c = await trx
        .insertInto('centers')
        .values({ ...fields, slug, createdBy: user.id, creatorEmailHmac, publishedAt: new Date() })
        .returning(['id', 'slug', 'name'])
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('centerManagers')
        .values({ centerId: c.id, userId: user.id, createdBy: user.id, acceptedAt: new Date() })
        .execute();
      await centers.replaceNeeds(trx, c.id, needs);
      await audit.log(
        {
          actorId: user.id,
          action: 'center.imported',
          objectType: 'center',
          objectId: c.id,
          meta: { source: source.url ?? source.title },
        },
        trx,
      );
      return c;
    });
    result.created.push(`${center.name} → /c/${center.slug}`);
  }
  centers.invalidate();
  return result;
}
