import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { Throttle } from '@nestjs/throttler';
import { randomInt } from 'node:crypto';
import { sql } from 'kysely';
import { z } from 'zod';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { CONFIG, DATABASE } from '../common/core.module';
import { normalizeEmail } from '../common/crypto';
import { ApiError, Auth, AuthContext, conflict, notFound, parse, parseId, shortText } from '../common/http';
import type { AppConfig } from '../config';
import type { DB } from '../db/db';
import { PROVINCE_KEYS, slugify } from '../domain';
import { MailService } from '../mail/mail.service';
import { centerInputSchema, CentersService, contactFields, createCenterSchema, needsSchema } from './centers.service';

const MAX_NEW_PER_DAY = 3;
const MAX_MANAGED = 20;
const MAX_MANAGERS = 5;

/** Lo que hace cualquier persona con correo verificado: publicar y mantener sus centros. */
@Controller()
export class ManageController {
  constructor(
    @Inject(DATABASE) private readonly db: DB,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly centers: CentersService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
  ) {}

  private async manager(a: AuthContext, id: string) {
    const centerId = parseId(id);
    const c = await this.db.selectFrom('centers').selectAll().where('id', '=', centerId).executeTakeFirst();
    if (!c || c.status === 'REMOVED' || !(await this.access.isManager(a.user.id, centerId))) throw notFound();
    return c;
  }

  @Get('me')
  async me(@Auth() a: AuthContext) {
    const rows = await this.db
      .selectFrom('centers')
      .innerJoin('centerManagers', 'centerManagers.centerId', 'centers.id')
      .selectAll('centers')
      .where('centerManagers.userId', '=', a.user.id)
      .where('centers.status', '!=', 'REMOVED')
      .orderBy('centers.updatedAt', 'desc')
      .execute();
    const centers = await this.centers.withStats(rows);
    const stats = await this.centers.stats(rows.map((r) => r.id));
    return {
      user: {
        id: a.user.id,
        email: a.user.email,
        name: a.user.name,
        isModerator: a.user.isModerator || a.user.isAdmin,
        isAdmin: a.user.isAdmin,
      },
      centers: centers.map((c) => ({ ...c, reportReasons: stats.get(c.id)?.reportReasons ?? {} })),
    };
  }

  /** Borrar mi cuenta: deja de ser responsable; los centros donde era el único quedan cerrados. */
  @Delete('me')
  @HttpCode(200)
  async deleteMe(@Auth() a: AuthContext, @Res({ passthrough: true }) res: Response) {
    if (a.user.isModerator || a.user.isAdmin)
      throw new ApiError(400, 'STAFF', 'Las cuentas de moderación se retiran por línea de comandos.');
    await this.db.transaction().execute(async (trx) => {
      const mine = await trx.selectFrom('centerManagers').select('centerId').where('userId', '=', a.user.id).execute();
      for (const { centerId } of mine) {
        const n = await trx
          .selectFrom('centerManagers')
          .select((eb) => eb.fn.countAll<number>().as('n'))
          .where('centerId', '=', centerId)
          .executeTakeFirstOrThrow();
        if (Number(n.n) <= 1) {
          await trx
            .updateTable('centers')
            .set({ status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() })
            .where('id', '=', centerId)
            .where('status', '=', 'PUBLISHED')
            .execute();
        }
      }
      await trx.updateTable('centers').set({ createdBy: null }).where('createdBy', '=', a.user.id).execute();
      await this.audit.log(
        { actorId: null, action: 'user.deleted_self', objectType: 'user', objectId: a.user.id },
        trx,
      );
      await trx.deleteFrom('users').where('id', '=', a.user.id).execute();
    });
    this.centers.invalidate();
    res.clearCookie(this.auth.cookieNames().session, {
      path: '/',
      secure: this.config.cookieSecure,
      httpOnly: true,
      sameSite: 'lax',
    });
    return { ok: true };
  }

  /** Un centro que administro (con estado, reportes abiertos y todos los campos editables). */
  @Get('centers/:id')
  async getMine(@Auth() a: AuthContext, @Param('id') id: string) {
    const c = await this.manager(a, id);
    const [pub] = await this.centers.withStats([c]);
    const stats = await this.centers.stats([c.id]);
    return {
      ...pub,
      status: c.status,
      // El responsable ve el contacto aunque no tenga consentimiento todavía, para poder corregirlo.
      contactName: c.contactName,
      contactPhone: c.contactPhone,
      contactWhatsapp: c.contactWhatsapp,
      contactConsent: !!c.contactConsentAt,
      reportReasons: stats.get(c.id)?.reportReasons ?? {},
    };
  }

  @Patch('me')
  async updateMe(@Auth() a: AuthContext, @Body() body: unknown) {
    const { name } = parse(z.object({ name: shortText(80) }), body);
    await this.db.updateTable('users').set({ name }).where('id', '=', a.user.id).execute();
    return { ok: true };
  }

  /** Posibles duplicados (mismo nombre en la misma provincia) para avisar antes de crear. */
  @Post('centers/check-duplicates')
  @HttpCode(200)
  async duplicates(@Auth() _a: AuthContext, @Body() body: unknown) {
    const { name, province } = parse(z.object({ name: z.string().max(120), province: z.enum(PROVINCE_KEYS) }), body);
    const base = slugify(name);
    if (base.length < 3) return [];
    const rows = await this.db
      .selectFrom('centers')
      .select(['slug', 'name', 'community', 'district', 'address'])
      .where('province', '=', province)
      .where('status', '=', 'PUBLISHED')
      .where('slug', 'like', `${base.replace(/[%_]/g, '')}%`)
      .limit(5)
      .execute();
    return rows;
  }

  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Post('centers')
  async create(@Auth() a: AuthContext, @Body() body: unknown) {
    const input = parse(createCenterSchema.extend({ needs: needsSchema.default([]) }), body);
    const consent = contactFields(input);
    this.centers.validateNoMoney(input, input.needs);
    const recent = await this.db
      .selectFrom('centers')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('createdBy', '=', a.user.id)
      .where('createdAt', '>', sql<Date>`now() - interval '24 hours'`)
      .executeTakeFirstOrThrow();
    if (Number(recent.n) >= MAX_NEW_PER_DAY)
      throw new ApiError(429, 'TOO_MANY', `Puedes publicar hasta ${MAX_NEW_PER_DAY} centros por día.`);
    const managed = await this.db
      .selectFrom('centerManagers')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('userId', '=', a.user.id)
      .executeTakeFirstOrThrow();
    if (Number(managed.n) >= MAX_MANAGED) throw new ApiError(429, 'TOO_MANY', `Ya administras ${MAX_MANAGED} centros.`);

    const { needs, contactConsent: _c, schedule, ...rest } = input;
    const fields = { ...rest, ...consent, schedule: JSON.stringify(schedule) };
    const center = await this.db.transaction().execute(async (trx) => {
      const base = slugify(`${fields.name} ${fields.community || fields.district}`) || 'centro';
      let slug = base;
      for (let i = 0; i < 6; i++) {
        const taken = await trx.selectFrom('centers').select('id').where('slug', '=', slug).executeTakeFirst();
        if (!taken) break;
        slug = `${base}-${randomInt(100, 9999)}`;
      }
      const c = await trx
        .insertInto('centers')
        .values({ ...fields, slug, createdBy: a.user.id, publishedAt: new Date() })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('centerManagers')
        .values({ centerId: c.id, userId: a.user.id, createdBy: a.user.id })
        .execute();
      await this.centers.replaceNeeds(trx, c.id, needs);
      await this.audit.log({ actorId: a.user.id, action: 'center.created', objectType: 'center', objectId: c.id }, trx);
      return c;
    });
    this.centers.invalidate();
    return this.centers.one(center.id);
  }

  @Patch('centers/:id')
  async update(@Auth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    const c = await this.manager(a, id);
    const input = parse(centerInputSchema.partial(), body);
    if (input.lat !== undefined || input.lng !== undefined) {
      if (typeof input.lat !== 'number' || typeof input.lng !== 'number') {
        throw new ApiError(400, 'VALIDATION', 'La ubicación exacta es obligatoria (latitud y longitud).', {
          fields: { lat: 'Marca la ubicación exacta' },
        });
      }
    }
    const touchesContact =
      input.contactName !== undefined || input.contactPhone !== undefined || input.contactWhatsapp !== undefined;
    const merged = {
      contactName: input.contactName ?? c.contactName,
      contactPhone: input.contactPhone ?? c.contactPhone,
      contactWhatsapp: input.contactWhatsapp ?? c.contactWhatsapp,
      contactConsent: input.contactConsent ?? (!touchesContact && !!c.contactConsentAt),
    };
    const consent = touchesContact ? contactFields(merged) : {};
    this.centers.validateNoMoney(input);
    const { contactConsent: _c, schedule, ...rest } = input;
    const fields = {
      ...rest,
      ...consent,
      ...(touchesContact && !merged.contactName && !merged.contactPhone && !merged.contactWhatsapp
        ? { contactConsentAt: null }
        : {}),
      ...(schedule !== undefined ? { schedule: JSON.stringify(schedule) } : {}),
    };
    const now = new Date();
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('centers')
        .set({ ...fields, updatedAt: now, managerConfirmedAt: now })
        .where('id', '=', c.id)
        .execute();
      // Corregir la ficha atiende los reportes de información; los graves (dinero, falso) no.
      await trx
        .updateTable('reports')
        .set({ status: 'RESOLVED', resolvedBy: a.user.id, resolvedAt: now })
        .where('centerId', '=', c.id)
        .where('status', '=', 'OPEN')
        .where('reason', 'in', ['WRONG_INFO', 'NOT_RECEIVING', 'OTHER'])
        .execute();
      await this.audit.log(
        {
          actorId: a.user.id,
          action: 'center.updated',
          objectType: 'center',
          objectId: c.id,
          meta: { fields: Object.keys(fields).join(',') },
        },
        trx,
      );
    });
    this.centers.invalidate();
    return this.centers.one(c.id);
  }

  @Put('centers/:id/needs')
  async needs(@Auth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    const c = await this.manager(a, id);
    const { needs } = parse(z.object({ needs: needsSchema }), body);
    this.centers.validateNoMoney({}, needs);
    const now = new Date();
    await this.db.transaction().execute(async (trx) => {
      await this.centers.replaceNeeds(trx, c.id, needs);
      await trx
        .updateTable('centers')
        .set({ updatedAt: now, managerConfirmedAt: now })
        .where('id', '=', c.id)
        .execute();
      await trx
        .updateTable('reports')
        .set({ status: 'RESOLVED', resolvedBy: a.user.id, resolvedAt: now })
        .where('centerId', '=', c.id)
        .where('status', '=', 'OPEN')
        .where('reason', '=', 'NOT_RECEIVING')
        .execute();
      await this.audit.log(
        {
          actorId: a.user.id,
          action: 'center.needs_updated',
          objectType: 'center',
          objectId: c.id,
          meta: { items: needs.length },
        },
        trx,
      );
    });
    this.centers.invalidate();
    return this.centers.one(c.id);
  }

  @Post('centers/:id/confirm')
  @HttpCode(200)
  async confirm(@Auth() a: AuthContext, @Param('id') id: string) {
    const c = await this.manager(a, id);
    if (c.status !== 'PUBLISHED') throw conflict('El centro está cerrado. Ábrelo de nuevo para confirmarlo.');
    await this.db.updateTable('centers').set({ managerConfirmedAt: new Date() }).where('id', '=', c.id).execute();
    await this.audit.log({ actorId: a.user.id, action: 'center.confirmed', objectType: 'center', objectId: c.id });
    this.centers.invalidate();
    return this.centers.one(c.id);
  }

  @Post('centers/:id/close')
  @HttpCode(200)
  async close(@Auth() a: AuthContext, @Param('id') id: string) {
    const c = await this.manager(a, id);
    await this.db
      .updateTable('centers')
      .set({ status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', c.id)
      .execute();
    await this.db
      .updateTable('reports')
      .set({ status: 'RESOLVED', resolvedBy: a.user.id, resolvedAt: new Date() })
      .where('centerId', '=', c.id)
      .where('status', '=', 'OPEN')
      .where('reason', 'in', ['CLOSED', 'NOT_RECEIVING'])
      .execute();
    await this.audit.log({ actorId: a.user.id, action: 'center.closed', objectType: 'center', objectId: c.id });
    this.centers.invalidate();
    return this.centers.one(c.id);
  }

  @Post('centers/:id/reopen')
  @HttpCode(200)
  async reopen(@Auth() a: AuthContext, @Param('id') id: string) {
    const c = await this.manager(a, id);
    if (c.status !== 'CLOSED') return this.centers.one(c.id);
    await this.db
      .updateTable('centers')
      .set({ status: 'PUBLISHED', closedAt: null, managerConfirmedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', c.id)
      .execute();
    await this.audit.log({ actorId: a.user.id, action: 'center.reopened', objectType: 'center', objectId: c.id });
    this.centers.invalidate();
    return this.centers.one(c.id);
  }

  // ───── Co-responsables: así el centro no depende de una sola persona ─────

  @Get('centers/:id/managers')
  async managers(@Auth() a: AuthContext, @Param('id') id: string) {
    const c = await this.manager(a, id);
    const rows = await this.db
      .selectFrom('centerManagers')
      .innerJoin('users', 'users.id', 'centerManagers.userId')
      .select(['users.id', 'users.email', 'users.name', 'centerManagers.createdAt'])
      .where('centerManagers.centerId', '=', c.id)
      .orderBy('centerManagers.createdAt')
      .execute();
    return rows.map((r) => ({ ...r, you: r.id === a.user.id }));
  }

  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @Post('centers/:id/managers')
  async addManager(@Auth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    const c = await this.manager(a, id);
    const { email } = parse(
      z.object({ email: z.string().trim().max(254).email('Correo inválido').transform(normalizeEmail) }),
      body,
    );
    const count = await this.db
      .selectFrom('centerManagers')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('centerId', '=', c.id)
      .executeTakeFirstOrThrow();
    if (Number(count.n) >= MAX_MANAGERS)
      throw new ApiError(400, 'TOO_MANY', `Un centro puede tener hasta ${MAX_MANAGERS} responsables.`);
    await this.db
      .insertInto('users')
      .values({ email })
      .onConflict((oc) => oc.column('email').doNothing())
      .execute();
    const u = await this.db
      .selectFrom('users')
      .select(['id', 'disabledAt'])
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    if (u.disabledAt) throw new ApiError(400, 'BLOCKED', 'Ese correo no puede administrar centros.');
    const ins = await this.db
      .insertInto('centerManagers')
      .values({ centerId: c.id, userId: u.id, createdBy: a.user.id })
      .onConflict((oc) => oc.columns(['centerId', 'userId']).doNothing())
      .returning('userId')
      .executeTakeFirst();
    if (!ins) throw conflict('Esa persona ya es responsable de este centro.');
    await this.audit.log({ actorId: a.user.id, action: 'center.manager_added', objectType: 'center', objectId: c.id });
    await this.mail.send({
      to: email,
      subject: `Te añadieron como responsable de «${c.name}»`,
      text: `Alguien que administra «${c.name}» en Acopio Panamá te añadió como responsable.\n\nPuedes actualizar lo que necesitan y confirmar que sigue funcionando en ${this.config.appOrigin}/mis-centros (entras con este correo, sin contraseña).\n\nSi no conoces este centro, ignora el correo.`,
    });
    return { ok: true };
  }

  @Delete('centers/:id/managers/:userId')
  @HttpCode(200)
  async removeManager(@Auth() a: AuthContext, @Param('id') id: string, @Param('userId') u: string) {
    const c = await this.manager(a, id);
    const userId = parseId(u);
    const count = await this.db
      .selectFrom('centerManagers')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('centerId', '=', c.id)
      .executeTakeFirstOrThrow();
    if (Number(count.n) <= 1)
      throw conflict('No puedes quitar al único responsable. Añade otro primero o cierra el centro.');
    const r = await this.db
      .deleteFrom('centerManagers')
      .where('centerId', '=', c.id)
      .where('userId', '=', userId)
      .executeTakeFirst();
    if (Number(r.numDeletedRows) === 0) throw notFound();
    await this.audit.log({
      actorId: a.user.id,
      action: 'center.manager_removed',
      objectType: 'center',
      objectId: c.id,
    });
    return { ok: true };
  }
}
