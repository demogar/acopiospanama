import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { Throttle } from '@nestjs/throttler';
import { randomInt } from 'node:crypto';
import { sql } from 'kysely';
import { z } from 'zod';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { CONFIG, DATABASE, KEYS } from '../common/core.module';
import { hmac, Keys, normalizeEmail } from '../common/crypto';
import { ApiError, Auth, AuthContext, conflict, notFound, parse, parseId, shortText } from '../common/http';
import type { AppConfig } from '../config';
import type { DB } from '../db/db';
import { PROVINCE_KEYS, slugify } from '../domain';
import { MailService } from '../mail/mail.service';
import { centerInputSchema, CentersService, contactFields, createCenterSchema, needsSchema } from './centers.service';

const MAX_NEW_PER_DAY = 3;
const MAX_MANAGED = 20;
const MAX_MANAGERS = 5;
const MAX_INVITES_PER_DAY = 10;

/** Lo que hace cualquier persona con correo verificado: publicar y mantener sus centros. */
@Controller()
export class ManageController {
  constructor(
    @Inject(DATABASE) private readonly db: DB,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(KEYS) private readonly keys: Keys,
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
      .where('centerManagers.acceptedAt', 'is not', null)
      .where('centers.status', '!=', 'REMOVED')
      .orderBy('centers.updatedAt', 'desc')
      .execute();
    const invitations = await this.db
      .selectFrom('centerManagers')
      .innerJoin('centers', 'centers.id', 'centerManagers.centerId')
      .select([
        'centers.id',
        'centers.name',
        'centers.slug',
        'centers.province',
        'centers.community',
        'centerManagers.createdAt',
      ])
      .where('centerManagers.userId', '=', a.user.id)
      .where('centerManagers.acceptedAt', 'is', null)
      .where('centers.status', '!=', 'REMOVED')
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
      invitations,
    };
  }

  /** Borrar mi cuenta: deja de ser responsable; los centros donde era el único quedan cerrados. */
  @Delete('me')
  @HttpCode(200)
  async deleteMe(@Auth() a: AuthContext, @Res({ passthrough: true }) res: Response) {
    if (a.user.isModerator || a.user.isAdmin)
      throw new ApiError(400, 'STAFF', 'Las cuentas de moderación se retiran por línea de comandos.');
    await this.db.transaction().execute(async (trx) => {
      const mine = await trx
        .selectFrom('centerManagers')
        .select('centerId')
        .where('userId', '=', a.user.id)
        .where('acceptedAt', 'is not', null)
        .execute();
      for (const { centerId } of mine) {
        const n = await trx
          .selectFrom('centerManagers')
          .select((eb) => eb.fn.countAll<number>().as('n'))
          .where('centerId', '=', centerId)
          .where('acceptedAt', 'is not', null)
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
    // Por correo (HMAC), no por cuenta: borrar la cuenta y volver a entrar no reinicia el límite.
    const creatorEmailHmac = hmac(this.keys.email, a.user.email);
    const recent = await this.db
      .selectFrom('centers')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('creatorEmailHmac', '=', creatorEmailHmac)
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
        .values({ ...fields, slug, createdBy: a.user.id, creatorEmailHmac, publishedAt: new Date() })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('centerManagers')
        .values({ centerId: c.id, userId: a.user.id, createdBy: a.user.id, acceptedAt: new Date() })
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
        .where(
          'reason',
          'in',
          touchesContact
            ? ['WRONG_INFO', 'NOT_RECEIVING', 'OTHER', 'MY_DATA']
            : ['WRONG_INFO', 'NOT_RECEIVING', 'OTHER'],
        )
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
      .select(['users.id', 'users.email', 'users.name', 'centerManagers.createdAt', 'centerManagers.acceptedAt'])
      .where('centerManagers.centerId', '=', c.id)
      .orderBy('centerManagers.createdAt')
      .execute();
    return rows.map((r) => ({ ...r, you: r.id === a.user.id, pending: !r.acceptedAt }));
  }

  /**
   * Invitar a un co-responsable. Es una INVITACIÓN: no tiene acceso hasta aceptarla al entrar.
   * El correo es genérico (sin el nombre del centro en el asunto) y como mucho uno por destinatario
   * cada 24 h, para que nadie use esto para enviar correos no deseados desde el remitente oficial.
   */
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @Post('centers/:id/managers')
  async addManager(@Auth() a: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    const c = await this.manager(a, id);
    const { email } = parse(
      z.object({ email: z.string().trim().max(254).email('Correo inválido').transform(normalizeEmail) }),
      body,
    );
    if (email === a.user.email) throw conflict('Ya eres responsable de este centro.');
    const count = await this.db
      .selectFrom('centerManagers')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('centerId', '=', c.id)
      .executeTakeFirstOrThrow();
    if (Number(count.n) >= MAX_MANAGERS)
      throw new ApiError(
        400,
        'TOO_MANY',
        `Un centro puede tener hasta ${MAX_MANAGERS} responsables (incluidas invitaciones pendientes).`,
      );
    const sentToday = await this.db
      .selectFrom('auditEvents')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('actorId', '=', a.user.id)
      .where('action', '=', 'center.manager_invited')
      .where('createdAt', '>', sql<Date>`now() - interval '24 hours'`)
      .executeTakeFirstOrThrow();
    if (Number(sentToday.n) >= MAX_INVITES_PER_DAY)
      throw new ApiError(429, 'TOO_MANY', `Puedes enviar hasta ${MAX_INVITES_PER_DAY} invitaciones por día.`);
    await this.db
      .insertInto('users')
      .values({ email })
      .onConflict((oc) => oc.column('email').doNothing())
      .execute();
    const u = await this.db
      .selectFrom('users')
      .select(['id', 'disabledAt', 'lastInvitedAt'])
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    // Misma respuesta si la cuenta está bloqueada: no se revela qué correos lo están.
    if (!u.disabledAt) {
      const ins = await this.db
        .insertInto('centerManagers')
        .values({ centerId: c.id, userId: u.id, createdBy: a.user.id, acceptedAt: null })
        .onConflict((oc) => oc.columns(['centerId', 'userId']).doNothing())
        .returning('userId')
        .executeTakeFirst();
      if (!ins) throw conflict('Esa persona ya es responsable o ya tiene una invitación pendiente.');
      const recently = u.lastInvitedAt && Date.now() - u.lastInvitedAt.getTime() < 24 * 3_600_000;
      if (!recently) {
        await this.db.updateTable('users').set({ lastInvitedAt: new Date() }).where('id', '=', u.id).execute();
        await this.mail.send({
          to: email,
          subject: 'Te invitaron a administrar un centro de acopio',
          text: `Alguien que administra un centro de acopio en Acopio Panamá te invitó a ser co-responsable.\n\nPara ver la invitación y aceptarla (o rechazarla), entra en ${this.config.appOrigin}/mis-centros con este correo. Sin contraseñas.\n\nSi no esperabas esta invitación, ignora este correo: no tendrás ningún rol si no la aceptas.`,
        });
      }
    }
    await this.audit.log({
      actorId: a.user.id,
      action: 'center.manager_invited',
      objectType: 'center',
      objectId: c.id,
    });
    return { ok: true };
  }

  @Post('centers/:id/invitation/accept')
  @HttpCode(200)
  async acceptInvitation(@Auth() a: AuthContext, @Param('id') id: string) {
    const centerId = parseId(id);
    const r = await this.db
      .updateTable('centerManagers')
      .set({ acceptedAt: new Date() })
      .where('centerId', '=', centerId)
      .where('userId', '=', a.user.id)
      .where('acceptedAt', 'is', null)
      .returning('centerId')
      .executeTakeFirst();
    if (!r) throw notFound();
    await this.audit.log({
      actorId: a.user.id,
      action: 'center.manager_accepted',
      objectType: 'center',
      objectId: centerId,
    });
    return { ok: true };
  }

  @Post('centers/:id/invitation/decline')
  @HttpCode(200)
  async declineInvitation(@Auth() a: AuthContext, @Param('id') id: string) {
    const centerId = parseId(id);
    const r = await this.db
      .deleteFrom('centerManagers')
      .where('centerId', '=', centerId)
      .where('userId', '=', a.user.id)
      .where('acceptedAt', 'is', null)
      .executeTakeFirst();
    if (Number(r.numDeletedRows) === 0) throw notFound();
    return { ok: true };
  }

  /**
   * Quitar a un responsable. Para evitar que alguien recién añadido «tome» un centro: solo puede
   * quitar a otros quien es responsable desde antes que esa persona (o retirar invitaciones
   * pendientes). Cualquiera puede retirarse a sí mismo. Se avisa por correo a quien se quita.
   */
  @Delete('centers/:id/managers/:userId')
  @HttpCode(200)
  async removeManager(@Auth() a: AuthContext, @Param('id') id: string, @Param('userId') u: string) {
    const c = await this.manager(a, id);
    const userId = parseId(u);
    const rows = await this.db.selectFrom('centerManagers').selectAll().where('centerId', '=', c.id).execute();
    const target = rows.find((r) => r.userId === userId);
    const me = rows.find((r) => r.userId === a.user.id)!;
    if (!target) throw notFound();
    const accepted = rows.filter((r) => r.acceptedAt);
    if (target.acceptedAt && accepted.length <= 1)
      throw conflict('No puedes quitar al único responsable. Añade otro primero o cierra el centro.');
    if (userId !== a.user.id && target.acceptedAt && !(me.acceptedAt! < target.acceptedAt)) {
      throw new ApiError(
        403,
        'NOT_ALLOWED',
        'Solo puede quitar a un responsable quien lo es desde antes. Puedes retirarte tú.',
      );
    }
    await this.db.deleteFrom('centerManagers').where('centerId', '=', c.id).where('userId', '=', userId).execute();
    await this.audit.log({
      actorId: a.user.id,
      action: 'center.manager_removed',
      objectType: 'center',
      objectId: c.id,
    });
    if (userId !== a.user.id && target.acceptedAt) {
      const removed = await this.db.selectFrom('users').select('email').where('id', '=', userId).executeTakeFirst();
      if (removed) {
        await this.mail.send({
          to: removed.email,
          subject: 'Ya no eres responsable de un centro de acopio',
          text: `Otro responsable te quitó de un centro que administrabas en Acopio Panamá.\n\nSi crees que es un error o un abuso, usa «Reportar un problema» en la ficha del centro o responde a la moderación desde ${this.config.appOrigin}/como-funciona.`,
        });
      }
    }
    return { ok: true };
  }
}
