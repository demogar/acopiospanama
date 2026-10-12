import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { z } from 'zod';
import { CONFIG, DATABASE, KEYS } from '../common/core.module';
import { clientKey, hmac, Keys } from '../common/crypto';
import { ApiError, shortText, text } from '../common/http';
import type { AppConfig } from '../config';
import type { DB } from '../db/db';
import type { Center } from '../db/types';
import {
  textProblem,
  FLAG_THRESHOLD,
  HIDE_THRESHOLD,
  ITEM_KEYS,
  Item,
  NEED_LEVELS,
  NeedLevel,
  CENTER_TYPE_KEYS,
  openNow,
  ORGANIZER_KEYS,
  PROVINCE_KEYS,
  Schedule,
  ReportReason,
  SERIOUS_REASONS,
} from '../domain';

const WINDOW_HOURS = 72;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)');
const daySchema = z.union([
  z.null(),
  z.object({ allDay: z.literal(true) }).strict(),
  z
    .object({ open: hhmm, close: hhmm })
    .strict()
    .refine((d) => d.open !== d.close, 'La hora de apertura y cierre no pueden ser iguales'),
]);
export const scheduleSchema = z
  .object({
    MON: daySchema,
    TUE: daySchema,
    WED: daySchema,
    THU: daySchema,
    FRI: daySchema,
    SAT: daySchema,
    SUN: daySchema,
  })
  .partial()
  .strict();

const phone = z
  .string()
  .max(30)
  .regex(/^[0-9+()\-\s]*$/, 'Solo números, espacios, + y -')
  .transform((s) => s.trim())
  .refine((s) => s === '' || s.replace(/\D/g, '').length >= 7, 'Número incompleto')
  .default('');

export const centerInputSchema = z.object({
  name: shortText(120).refine((s) => s.length >= 3, 'Escribe el nombre del centro'),
  centerType: z.enum(CENTER_TYPE_KEYS, { errorMap: () => ({ message: 'Elige el tipo de centro' }) }),
  organizerType: z.enum(ORGANIZER_KEYS, { errorMap: () => ({ message: 'Elige quién lo organiza' }) }),
  organizerName: shortText(120).default(''),
  province: z.enum(PROVINCE_KEYS, { errorMap: () => ({ message: 'Elige la provincia o comarca' }) }),
  district: shortText(60).default(''),
  community: shortText(80).default(''),
  address: shortText(300).refine((s) => s.length >= 3, 'Escribe la dirección o una referencia'),
  lat: z.number().min(7.0, 'Fuera de Panamá').max(9.8, 'Fuera de Panamá').nullable().default(null),
  lng: z.number().min(-83.1, 'Fuera de Panamá').max(-77.1, 'Fuera de Panamá').nullable().default(null),
  schedule: scheduleSchema.default({}),
  hoursNote: shortText(200).default(''),
  contactName: shortText(80).default(''),
  contactPhone: phone,
  contactWhatsapp: phone,
  /** El contacto se publica solo si esa persona lo acepta expresamente. */
  contactConsent: z.boolean().default(false),
  notes: text(600).default(''),
});

/** Al publicar, la ubicación exacta es obligatoria (es lo primero que busca quien quiere llevar algo). */
export const createCenterSchema = centerInputSchema.extend({
  lat: z
    .number({ invalid_type_error: 'Marca la ubicación exacta', required_error: 'Marca la ubicación exacta' })
    .min(7.0, 'Fuera de Panamá')
    .max(9.8, 'Fuera de Panamá'),
  lng: z
    .number({ invalid_type_error: 'Marca la ubicación exacta', required_error: 'Marca la ubicación exacta' })
    .min(-83.1, 'Fuera de Panamá')
    .max(-77.1, 'Fuera de Panamá'),
});

export function contactFields(input: {
  contactName?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  contactConsent?: boolean;
}) {
  const any = !!(input.contactName || input.contactPhone || input.contactWhatsapp);
  if (any && !input.contactConsent) {
    throw new ApiError(
      400,
      'VALIDATION',
      'Confirma que la persona de contacto acepta que su nombre y teléfono sean públicos.',
      {
        fields: { contactConsent: 'Obligatorio para publicar el contacto' },
      },
    );
  }
  return any ? { contactConsentAt: new Date() } : {};
}
export type CenterInput = z.infer<typeof centerInputSchema>;

export const needsSchema = z
  .array(z.object({ item: z.enum(ITEM_KEYS), level: z.enum(NEED_LEVELS), note: shortText(120).default('') }))
  .max(ITEM_KEYS.length);

export interface CenterStats {
  confirmations: number; // personas distintas en 72 h
  lastCommunityConfirmation: Date | null;
  openReports: number;
  seriousReports: number;
  lastSeriousReportAt: Date | null;
  reportReasons: Partial<Record<ReportReason, number>>;
}

export type Visibility = 'VISIBLE' | 'COMMUNITY_HIDDEN' | 'CLOSED' | 'REMOVED';

export interface CenterState {
  visibility: Visibility;
  flagged: boolean;
  isNew: boolean;
  lastActivity: Date;
}

/**
 * Reglas automáticas (la comunidad mantiene el directorio; nadie tiene que estar pendiente):
 *  - Lo publicado se da por bueno: un centro no caduca por falta de confirmaciones. Sigue en la
 *    lista hasta que su responsable lo cierre o la comunidad lo reporte.
 *  - Reportes: 2 o más personas distintas en 72 h → aviso «reportado, verifica antes de ir».
 *    3 o más reportes graves (pide dinero, falso, cerrado) que superen las confirmaciones → oculto,
 *    SALVO que un responsable lo haya confirmado después del último reporte grave: entonces queda
 *    visible con el aviso (en disputa). Así nadie oculta un centro legítimo sin que su responsable
 *    pueda responder; la moderación decide los casos de estafa real.
 *  - Nada de pedidos de dinero en las fichas (se bloquea al guardar).
 */
export function computeState(
  c: Pick<Center, 'status' | 'managerConfirmedAt' | 'createdAt'>,
  s: CenterStats,
  now = Date.now(),
): CenterState {
  const lastActivity = new Date(Math.max(c.managerConfirmedAt.getTime(), s.lastCommunityConfirmation?.getTime() ?? 0));
  const flagged = s.openReports >= FLAG_THRESHOLD || s.seriousReports >= HIDE_THRESHOLD;
  const isNew = now - c.createdAt.getTime() < 24 * 3_600_000 && s.confirmations === 0;
  let visibility: Visibility;
  if (c.status === 'REMOVED') visibility = 'REMOVED';
  else if (c.status === 'CLOSED') visibility = 'CLOSED';
  else if (
    s.seriousReports >= HIDE_THRESHOLD &&
    s.seriousReports > s.confirmations &&
    !(s.lastSeriousReportAt && c.managerConfirmedAt > s.lastSeriousReportAt)
  )
    visibility = 'COMMUNITY_HIDDEN';
  else visibility = 'VISIBLE';
  return { visibility, flagged, isNew, lastActivity };
}

export interface PublicCenter {
  id: string;
  slug: string;
  name: string;
  centerType: string;
  organizerType: string;
  organizerName: string;
  province: string;
  district: string;
  community: string;
  address: string;
  lat: number | null;
  lng: number | null;
  schedule: Schedule;
  hoursNote: string;
  openNow: boolean | null;
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
  notes: string;
  needs: { item: Item; level: NeedLevel; note: string }[];
  confirmations: number;
  lastActivity: string;
  visibility: Visibility;
  flagged: boolean;
  isNew: boolean;
  updatedAt: string;
  createdAt: string;
}

@Injectable()
export class CentersService {
  private cache: { at: number; list: PublicCenter[] } | null = null;
  private static readonly CACHE_MS = 30_000;

  constructor(
    @Inject(DATABASE) private readonly db: DB,
    @Inject(KEYS) private readonly keys: Keys,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  invalidate() {
    this.cache = null;
  }

  /**
   * Identificador del origen sin guardar IPs (HMAC con clave propia; IPv6 agrupada por /64).
   * Confirmaciones: cambia cada día (una por persona y día). Reportes: estable, para que la misma
   * persona no pueda sumar un reporte nuevo cada día sobre el mismo centro.
   */
  origin(ip: string | undefined, daily = true): string {
    const day = daily ? new Date().toISOString().slice(0, 10) : 'reports';
    return hmac(this.keys.origin, `${clientKey(ip)}|${day}`);
  }

  /**
   * Revisa cada texto libre y devuelve el error junto al campo exacto: pedidos de dinero, enlaces
   * o HTML no se permiten en las fichas (vías típicas de estafa).
   */
  validateTexts(input: Partial<CenterInput>, needs: { note: string }[] = []) {
    const fields: Record<string, string> = {};
    let money = false;
    const check = (key: string, value: unknown) => {
      if (typeof value !== 'string' || !value) return;
      const p = textProblem(value);
      if (!p) return;
      if (p === 'MONEY') money = true;
      fields[key] =
        p === 'MONEY'
          ? 'No se puede pedir dinero, transferencias ni cuentas. Indica solo artículos.'
          : p === 'URL'
            ? 'No se permiten enlaces ni direcciones web.'
            : 'No se permiten los caracteres < y >.';
    };
    for (const k of [
      'name',
      'organizerName',
      'district',
      'community',
      'address',
      'hoursNote',
      'contactName',
      'notes',
    ] as const)
      check(k, input[k]);
    needs.forEach((n, i) => check(`needs.${i}.note`, n.note));
    if (Object.keys(fields).length) {
      throw new ApiError(
        400,
        money ? 'MONEY_NOT_ALLOWED' : 'TEXT_NOT_ALLOWED',
        money
          ? 'Las fichas no pueden pedir dinero, transferencias ni números de cuenta: así evitamos estafas. Indica solo qué artículos necesitan.'
          : 'Hay texto que no se puede publicar. Revisa los campos marcados.',
        { fields },
      );
    }
  }

  /** Compatibilidad con llamadas anteriores. */
  validateNoMoney(input: Partial<CenterInput>, needs: { note: string }[] = []) {
    this.validateTexts(input, needs);
  }

  async stats(centerIds: string[]): Promise<Map<string, CenterStats>> {
    const out = new Map<string, CenterStats>();
    for (const id of centerIds)
      out.set(id, {
        confirmations: 0,
        lastCommunityConfirmation: null,
        openReports: 0,
        seriousReports: 0,
        lastSeriousReportAt: null,
        reportReasons: {},
      });
    if (centerIds.length === 0) return out;
    const since = sql<Date>`now() - make_interval(hours => ${WINDOW_HOURS})`;
    const conf = await this.db
      .selectFrom('confirmations')
      .select((eb) => ['centerId', eb.fn.countAll<number>().as('n')])
      .where('centerId', 'in', centerIds)
      .where('createdAt', '>', since)
      .groupBy('centerId')
      .execute();
    const lastConf = await this.db
      .selectFrom('confirmations')
      .select((eb) => ['centerId', eb.fn.max('createdAt').as('last')])
      .where('centerId', 'in', centerIds)
      .groupBy('centerId')
      .execute();
    const reps = await this.db
      .selectFrom('reports')
      .select((eb) => ['centerId', 'reason', eb.fn.countAll<number>().as('n'), eb.fn.max('createdAt').as('last')])
      .where('centerId', 'in', centerIds)
      .where('status', '=', 'OPEN')
      .where('createdAt', '>', since)
      .groupBy(['centerId', 'reason'])
      .execute();
    for (const r of conf) out.get(r.centerId)!.confirmations = Number(r.n);
    for (const r of lastConf)
      out.get(r.centerId)!.lastCommunityConfirmation = r.last ? new Date(r.last as unknown as string) : null;
    for (const r of reps) {
      const s = out.get(r.centerId)!;
      const n = Number(r.n);
      s.openReports += n;
      if (SERIOUS_REASONS.includes(r.reason)) {
        s.seriousReports += n;
        const last = r.last ? new Date(r.last as unknown as string) : null;
        if (last && (!s.lastSeriousReportAt || last > s.lastSeriousReportAt)) s.lastSeriousReportAt = last;
      }
      s.reportReasons[r.reason] = n;
    }
    return out;
  }

  private async toPublic(rows: Center[]): Promise<PublicCenter[]> {
    const ids = rows.map((r) => r.id);
    const [stats, needs] = await Promise.all([
      this.stats(ids),
      ids.length
        ? this.db
            .selectFrom('centerNeeds')
            .select(['centerId', 'item', 'level', 'note'])
            .where('centerId', 'in', ids)
            .execute()
        : Promise.resolve([]),
    ]);
    return rows.map((c) => {
      const s = stats.get(c.id)!;
      const st = computeState(c, s);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        centerType: c.centerType,
        organizerType: c.organizerType,
        organizerName: c.organizerName,
        province: c.province,
        district: c.district,
        community: c.community,
        address: c.address,
        lat: c.lat,
        lng: c.lng,
        schedule: c.schedule ?? {},
        hoursNote: c.hoursNote,
        openNow: openNow(c.schedule ?? {}),
        contactName: c.contactConsentAt ? c.contactName : '',
        contactPhone: c.contactConsentAt ? c.contactPhone : '',
        contactWhatsapp: c.contactConsentAt ? c.contactWhatsapp : '',
        notes: c.notes,
        needs: needs
          .filter((n) => n.centerId === c.id)
          .map((n) => ({ item: n.item, level: n.level, note: n.note }))
          .sort((a, b) => NEED_LEVELS.indexOf(a.level) - NEED_LEVELS.indexOf(b.level)),
        confirmations: s.confirmations,
        lastActivity: st.lastActivity.toISOString(),
        visibility: st.visibility,
        flagged: st.flagged,
        isNew: st.isNew,
        updatedAt: c.updatedAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  /** Lista pública (en caché 30 s): solo visibles; nunca ocultos, cerrados ni retirados. */
  async publicList(): Promise<PublicCenter[]> {
    if (this.cache && Date.now() - this.cache.at < CentersService.CACHE_MS) return this.cache.list;
    const rows = await this.db.selectFrom('centers').selectAll().where('status', '=', 'PUBLISHED').execute();
    const list = (await this.toPublic(rows))
      .filter((c) => c.visibility === 'VISIBLE')
      .sort((a, b) => {
        if (a.flagged !== b.flagged) return a.flagged ? 1 : -1;
        const ua = a.needs.filter((n) => n.level === 'URGENT').length;
        const ub = b.needs.filter((n) => n.level === 'URGENT').length;
        if (ua !== ub) return ub - ua;
        return b.lastActivity.localeCompare(a.lastActivity);
      });
    this.cache = { at: Date.now(), list };
    return list;
  }

  async publicDetail(slug: string): Promise<PublicCenter | null> {
    const c = await this.db.selectFrom('centers').selectAll().where('slug', '=', slug).executeTakeFirst();
    if (!c) return null;
    return (await this.toPublic([c]))[0];
  }

  async one(id: string): Promise<PublicCenter | null> {
    const c = await this.db.selectFrom('centers').selectAll().where('id', '=', id).executeTakeFirst();
    if (!c) return null;
    return (await this.toPublic([c]))[0];
  }

  async withStats(rows: Center[]) {
    return this.toPublic(rows);
  }

  async addConfirmation(centerId: string, originHmac: string) {
    await this.db
      .insertInto('confirmations')
      .values({ centerId, originHmac })
      .onConflict((oc) => oc.columns(['centerId', 'originHmac']).doNothing())
      .execute();
    this.invalidate();
  }

  /** Devuelve true si es un reporte nuevo (la misma persona no cuenta dos veces mientras siga abierto). */
  async addReport(centerId: string, reason: ReportReason, details: string, originHmac: string): Promise<boolean> {
    const res = await this.db
      .insertInto('reports')
      .values({ centerId, reason, details, originHmac })
      .onConflict((oc) => oc.columns(['centerId', 'originHmac']).where('status', '=', 'OPEN').doNothing())
      .returning('id')
      .executeTakeFirst();
    if (res && reason === 'MY_DATA') {
      // Privacidad primero: el contacto se oculta al instante; el responsable puede volver a
      // publicarlo con consentimiento.
      await this.db.updateTable('centers').set({ contactConsentAt: null }).where('id', '=', centerId).execute();
    }
    this.invalidate();
    return !!res;
  }

  async replaceNeeds(trx: DB, centerId: string, needs: z.infer<typeof needsSchema>) {
    const seen = new Set<string>();
    for (const n of needs) {
      if (seen.has(n.item)) throw new ApiError(400, 'VALIDATION', 'Hay un artículo repetido.');
      seen.add(n.item);
    }
    await trx.deleteFrom('centerNeeds').where('centerId', '=', centerId).execute();
    if (needs.length) {
      await trx
        .insertInto('centerNeeds')
        .values(needs.map((n) => ({ centerId, item: n.item, level: n.level, note: n.note })))
        .execute();
    }
  }
}
