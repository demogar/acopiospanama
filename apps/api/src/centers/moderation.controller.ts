import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { sql } from 'kysely';
import { z } from 'zod';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { CONFIG, DATABASE } from '../common/core.module';
import { normalizeEmail } from '../common/crypto';
import { Auth, AuthContext, notFound, parse, parseId, shortText } from '../common/http';
import type { AppConfig } from '../config';
import type { DB } from '../db/db';
import { CentersService } from './centers.service';

/**
 * Moderación: último recurso. El directorio se mantiene solo con las reglas automáticas; esto es
 * para los casos que la comunidad no resuelve (estafa evidente, abuso). Exige segundo factor.
 */
@Controller('mod')
export class ModerationController {
  constructor(
    @Inject(DATABASE) private readonly db: DB,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly access: AccessService,
    private readonly centers: CentersService,
    private readonly audit: AuditService,
  ) {}

  /** Lo que conviene mirar: centros con reportes abiertos y los creados en las últimas 24 h. */
  @Get('queue')
  async queue(@Auth() a: AuthContext) {
    this.access.requireModerator(a);
    const rows = await this.db
      .selectFrom('centers')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb.and([
            eb('status', '!=', 'REMOVED'),
            eb.or([
              eb.exists(
                eb
                  .selectFrom('reports')
                  .select('reports.id')
                  .whereRef('reports.centerId', '=', 'centers.id')
                  .where('reports.status', '=', 'OPEN'),
              ),
              eb('createdAt', '>', sql<Date>`now() - interval '24 hours'`),
            ]),
          ]),
          // Retirados en los últimos 7 días: para poder restaurarlos si fue un error.
          eb.and([eb('status', '=', 'REMOVED'), eb('updatedAt', '>', sql<Date>`now() - interval '7 days'`)]),
        ]),
      )
      .orderBy('updatedAt', 'desc')
      .limit(200)
      .execute();
    const list = await this.centers.withStats(rows);
    const reports = rows.length
      ? await this.db
          .selectFrom('reports')
          .select(['id', 'centerId', 'reason', 'details', 'createdAt'])
          .where(
            'centerId',
            'in',
            rows.map((r) => r.id),
          )
          .where('status', '=', 'OPEN')
          .orderBy('createdAt', 'desc')
          .execute()
      : [];
    return list.map((c) => {
      const row = rows.find((r) => r.id === c.id)!;
      return {
        ...c,
        status: row.status,
        removedReason: row.removedReason,
        reports: reports.filter((r) => r.centerId === c.id),
      };
    });
  }

  @Post('centers/:id/remove')
  @HttpCode(200)
  async remove(@Auth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    this.access.requireModerator(a);
    const { reason } = parse(
      z.object({ reason: shortText(300).refine((s) => s.length >= 3, 'Indica el motivo') }),
      body,
    );
    const r = await this.db
      .updateTable('centers')
      .set({ status: 'REMOVED', removedReason: reason, updatedAt: new Date() })
      .where('id', '=', parseId(id))
      .returning('id')
      .executeTakeFirst();
    if (!r) throw notFound();
    await this.audit.log({
      actorId: a.user.id,
      action: 'mod.center_removed',
      objectType: 'center',
      objectId: r.id,
      reason,
    });
    this.centers.invalidate();
    return { ok: true };
  }

  @Post('centers/:id/restore')
  @HttpCode(200)
  async restore(@Auth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    this.access.requireModerator(a);
    const { reason } = parse(
      z.object({ reason: shortText(300).refine((s) => s.length >= 3, 'Indica el motivo') }),
      body,
    );
    const centerId = parseId(id);
    const r = await this.db
      .updateTable('centers')
      .set({ status: 'PUBLISHED', removedReason: '', managerConfirmedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', centerId)
      .returning('id')
      .executeTakeFirst();
    if (!r) throw notFound();
    // Restaurar descarta los reportes abiertos (si no, volvería a ocultarse solo).
    await this.db
      .updateTable('reports')
      .set({ status: 'DISMISSED', resolvedBy: a.user.id, resolvedAt: new Date() })
      .where('centerId', '=', centerId)
      .where('status', '=', 'OPEN')
      .execute();
    await this.audit.log({
      actorId: a.user.id,
      action: 'mod.center_restored',
      objectType: 'center',
      objectId: r.id,
      reason,
    });
    this.centers.invalidate();
    return { ok: true };
  }

  @Post('centers/:id/dismiss-reports')
  @HttpCode(200)
  async dismiss(@Auth() a: AuthContext, @Param('id') id: string) {
    this.access.requireModerator(a);
    const centerId = parseId(id);
    const r = await this.db
      .updateTable('reports')
      .set({ status: 'DISMISSED', resolvedBy: a.user.id, resolvedAt: new Date() })
      .where('centerId', '=', centerId)
      .where('status', '=', 'OPEN')
      .executeTakeFirst();
    await this.audit.log({
      actorId: a.user.id,
      action: 'mod.reports_dismissed',
      objectType: 'center',
      objectId: centerId,
      meta: { n: Number(r.numUpdatedRows) },
    });
    this.centers.invalidate();
    return { dismissed: Number(r.numUpdatedRows) };
  }

  /** Bloquea una cuenta por abuso: no puede entrar y sus centros se retiran. */
  @Post('users/block')
  @HttpCode(200)
  async block(@Auth() a: AuthContext, @Body() body: unknown) {
    this.access.requireModerator(a);
    this.access.requireStepUp(a, this.config.STEP_UP_MINUTES);
    const input = parse(
      z.object({
        centerId: z.string().uuid().optional(),
        email: z.string().trim().max(254).email().transform(normalizeEmail).optional(),
        reason: shortText(300).refine((s) => s.length >= 3, 'Indica el motivo'),
      }),
      body,
    );
    let userIds: string[] = [];
    if (input.email) {
      const u = await this.db.selectFrom('users').select('id').where('email', '=', input.email).executeTakeFirst();
      if (u) userIds = [u.id];
    } else if (input.centerId) {
      // Bloquear «a quien creó este centro» sin que el moderador vea el correo.
      const c = await this.db
        .selectFrom('centers')
        .select('createdBy')
        .where('id', '=', input.centerId)
        .executeTakeFirst();
      if (c?.createdBy) userIds = [c.createdBy];
    }
    if (userIds.length === 0) throw notFound();
    const protectedUser = await this.db
      .selectFrom('users')
      .select('id')
      .where('id', 'in', userIds)
      .where((eb) => eb.or([eb('isModerator', '=', true), eb('isAdmin', '=', true)]))
      .executeTakeFirst();
    if (protectedUser) throw notFound();
    await this.db.transaction().execute(async (trx) => {
      await trx.updateTable('users').set({ disabledAt: new Date() }).where('id', 'in', userIds).execute();
      await trx
        .updateTable('sessions')
        .set({ revokedAt: new Date() })
        .where('userId', 'in', userIds)
        .where('revokedAt', 'is', null)
        .execute();
      await trx
        .updateTable('centers')
        .set({ status: 'REMOVED', removedReason: `Cuenta bloqueada: ${input.reason}`, updatedAt: new Date() })
        .where('createdBy', 'in', userIds)
        .where('status', '!=', 'REMOVED')
        .execute();
      for (const id of userIds)
        await this.audit.log(
          { actorId: a.user.id, action: 'mod.user_blocked', objectType: 'user', objectId: id, reason: input.reason },
          trx,
        );
    });
    this.centers.invalidate();
    return { ok: true };
  }

  // ───── Administración: nombrar moderadores ─────

  @Get('moderators')
  async moderators(@Auth() a: AuthContext) {
    this.access.requireAdmin(a);
    return this.db
      .selectFrom('users')
      .select(['id', 'email', 'name', 'isAdmin', 'totpEnabledAt'])
      .where((eb) => eb.or([eb('isModerator', '=', true), eb('isAdmin', '=', true)]))
      .orderBy('email')
      .execute();
  }

  @Post('moderators')
  @HttpCode(200)
  async setModerator(@Auth() a: AuthContext, @Body() body: unknown) {
    this.access.requireAdmin(a);
    this.access.requireStepUp(a, this.config.STEP_UP_MINUTES);
    const { email, moderator } = parse(
      z.object({ email: z.string().trim().max(254).email().transform(normalizeEmail), moderator: z.boolean() }),
      body,
    );
    await this.db
      .insertInto('users')
      .values({ email })
      .onConflict((oc) => oc.column('email').doNothing())
      .execute();
    const u = await this.db
      .updateTable('users')
      .set({ isModerator: moderator })
      .where('email', '=', email)
      .where('isAdmin', '=', false)
      .returning('id')
      .executeTakeFirst();
    if (!u) throw notFound();
    if (!moderator)
      await this.db
        .updateTable('sessions')
        .set({ revokedAt: new Date() })
        .where('userId', '=', u.id)
        .where('revokedAt', 'is', null)
        .execute();
    await this.audit.log({
      actorId: a.user.id,
      action: moderator ? 'admin.moderator_added' : 'admin.moderator_removed',
      objectType: 'user',
      objectId: u.id,
    });
    return { ok: true };
  }
}
