import { readFileSync } from 'node:fs';
import type { INestApplicationContext } from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CentersService } from '../centers/centers.service';
import { DATABASE } from '../common/core.module';
import { normalizeEmail } from '../common/crypto';
import { parse, shortText } from '../common/http';
import type { DB } from '../db/db';

/**
 * Lote de cierre: centros cargados desde fuentes públicas que ya no podemos dar por abiertos.
 * Se cierran (no se retiran): siguen en «Mis centros» y su responsable puede abrirlos de nuevo.
 * Solo se cierran los que siguen en manos de quien los cargó: si una organización los reclamó
 * (tiene otro responsable) o alguien confirmó que siguen abiertos, se saltan.
 */
export const closeBatchSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD'),
    close: z.array(z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/), reason: shortText(200) }).strict()).min(1),
  })
  .strict();

export type CloseResult = { closed: string[]; skipped: string[] };

/** ¿Es un lote de cierre (`{ close: [...] }`) y no uno de alta (`[...]`)? */
export const isCloseBatch = (data: unknown) => !!data && typeof data === 'object' && !Array.isArray(data);

export async function closeCenters(
  ctx: INestApplicationContext,
  opts: { email: string; file: string },
): Promise<CloseResult> {
  const batch = parse(closeBatchSchema, JSON.parse(readFileSync(opts.file, 'utf8')));
  const db = ctx.get<DB>(DATABASE);
  const audit = ctx.get(AuditService);
  const email = normalizeEmail(opts.email);
  const user = await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();

  const result: CloseResult = { closed: [], skipped: [] };
  for (const { slug, reason } of batch.close) {
    const c = await db
      .selectFrom('centers')
      .select(['id', 'status', 'createdAt', 'managerConfirmedAt'])
      .where('slug', '=', slug)
      .executeTakeFirst();
    if (!c || c.status !== 'PUBLISHED') {
      result.skipped.push(`${slug} (${c ? 'ya no está publicado' : 'no existe'})`);
      continue;
    }
    const others = await db
      .selectFrom('centerManagers')
      .select('userId')
      .where('centerId', '=', c.id)
      .where('acceptedAt', 'is not', null)
      .$if(!!user, (q) => q.where('userId', '!=', user!.id))
      .executeTakeFirst();
    const confirmed = c.managerConfirmedAt.getTime() - c.createdAt.getTime() > 60_000;
    if (others || confirmed) {
      result.skipped.push(`${slug} (${others ? 'lo lleva su organización' : 'su responsable lo confirmó'})`);
      continue;
    }
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('centers')
        .set({ status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() })
        .where('id', '=', c.id)
        .execute();
      await trx
        .updateTable('reports')
        .set({ status: 'RESOLVED', resolvedAt: new Date() })
        .where('centerId', '=', c.id)
        .where('status', '=', 'OPEN')
        .where('reason', 'in', ['CLOSED', 'NOT_RECEIVING'])
        .execute();
      await audit.log(
        {
          actorId: user?.id ?? null,
          action: 'center.closed',
          objectType: 'center',
          objectId: c.id,
          meta: { reason, verifiedOn: batch.date },
        },
        trx,
      );
    });
    result.closed.push(slug);
  }
  ctx.get(CentersService).invalidate();
  return result;
}
