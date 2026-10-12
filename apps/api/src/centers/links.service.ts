import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, hkdfSync } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { CONFIG, DATABASE } from '../common/core.module';
import { safeEqual } from '../common/crypto';
import { ApiError } from '../common/http';
import type { AppConfig } from '../config';
import type { DB } from '../db/db';
import { MailService } from '../mail/mail.service';
import { CentersService } from './centers.service';

const TOKEN_HOURS = 72;
const REPORT_NOTICE_GAP_HOURS = 6;

/**
 * Enlaces firmados de un solo propósito: «¿sigue funcionando?» con un toque. Ya no se envían
 * recordatorios, pero los enlaces de correos anteriores siguen sirviendo hasta que vencen.
 * No inician sesión ni dan acceso a nada más: solo confirman o cierran ese centro.
 */
@Injectable()
export class LinksService {
  private readonly logger = new Logger('Links');
  private readonly key: Buffer;
  private readonly lastReportNotice = new Map<string, number>();

  constructor(
    @Inject(DATABASE) private readonly db: DB,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly centers: CentersService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        Buffer.from(config.SECRET_KEY),
        Buffer.from('acopio-panama'),
        Buffer.from('confirm-link-v1'),
        32,
      ),
    );
  }

  makeToken(centerId: string, userId: string): string {
    const payload = Buffer.from(
      JSON.stringify({ c: centerId, u: userId, i: Date.now(), e: Date.now() + TOKEN_HOURS * 3_600_000 }),
    ).toString('base64url');
    const sig = createHmac('sha256', this.key).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  private verify(token: string): { c: string; u: string; i: number } {
    const [payload, sig] = token.split('.');
    const bad = () =>
      new ApiError(
        400,
        'BAD_LINK',
        'El enlace no es válido o ya venció. Entra con tu correo para actualizar el centro.',
      );
    if (!payload || !sig) throw bad();
    const expected = createHmac('sha256', this.key).update(payload).digest('base64url');
    if (!safeEqual(sig, expected)) throw bad();
    let data: { c: string; u: string; i: number; e: number };
    try {
      data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw bad();
    }
    if (!data.e || data.e < Date.now()) throw bad();
    return data;
  }

  private async load(token: string) {
    const { c, u, i } = this.verify(token);
    const row = await this.db
      .selectFrom('centers')
      .innerJoin('centerManagers', 'centerManagers.centerId', 'centers.id')
      .innerJoin('users', 'users.id', 'centerManagers.userId')
      .select(['centers.id', 'centers.name', 'centers.slug', 'centers.status', 'centers.updatedAt', 'users.disabledAt'])
      .where('centers.id', '=', c)
      .where('centerManagers.userId', '=', u)
      .where('centerManagers.acceptedAt', 'is not', null)
      .executeTakeFirst();
    if (!row || row.disabledAt || row.status === 'REMOVED') {
      throw new ApiError(
        400,
        'BAD_LINK',
        'El enlace no es válido o ya venció. Entra con tu correo para actualizar el centro.',
      );
    }
    return { ...row, userId: u, issuedAt: i ?? 0 };
  }

  async peekToken(token: string) {
    const r = await this.load(token);
    return { name: r.name, slug: r.slug, status: r.status };
  }

  async useToken(token: string, action: 'CONFIRM' | 'CLOSE') {
    const r = await this.load(token);
    if (action === 'CONFIRM') {
      if (r.status !== 'PUBLISHED')
        throw new ApiError(409, 'NOT_OPEN', 'Este centro está cerrado. Entra con tu correo si quieres reabrirlo.');
      await this.db.updateTable('centers').set({ managerConfirmedAt: new Date() }).where('id', '=', r.id).execute();
      await this.audit.log({
        actorId: r.userId,
        action: 'center.confirmed_link',
        objectType: 'center',
        objectId: r.id,
      });
    } else {
      // Cerrar con un enlace solo vale una vez: si el centro cambió después de enviar el correo
      // (se reabrió, se editó), un enlace viejo reenviado ya no puede cerrarlo.
      if (r.updatedAt.getTime() > r.issuedAt) {
        throw new ApiError(
          409,
          'LINK_USED',
          'Este enlace ya no sirve para cerrar el centro porque cambió después. Entra con tu correo para hacerlo.',
        );
      }
      await this.db
        .updateTable('centers')
        .set({ status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() })
        .where('id', '=', r.id)
        .execute();
      await this.audit.log({ actorId: r.userId, action: 'center.closed_link', objectType: 'center', objectId: r.id });
    }
    this.centers.invalidate();
    return { ok: true, name: r.name, slug: r.slug, action };
  }

  /** Aviso genérico a los responsables cuando alguien reporta su centro (como mucho uno cada 6 h). */
  async notifyManagersOfReport(centerId: string) {
    const mail = this.mail;
    const last = this.lastReportNotice.get(centerId);
    if (last && Date.now() - last < REPORT_NOTICE_GAP_HOURS * 3_600_000) return;
    this.lastReportNotice.set(centerId, Date.now());
    if (this.lastReportNotice.size > 10_000) this.lastReportNotice.clear();
    const c = await this.db.selectFrom('centers').select(['name']).where('id', '=', centerId).executeTakeFirst();
    if (!c) return;
    const managers = await this.db
      .selectFrom('centerManagers')
      .innerJoin('users', 'users.id', 'centerManagers.userId')
      .select('users.email')
      .where('centerManagers.centerId', '=', centerId)
      .where('centerManagers.acceptedAt', 'is not', null)
      .where('users.disabledAt', 'is', null)
      .execute();
    for (const m of managers) {
      await mail.send({
        to: m.email,
        subject: 'Alguien reportó uno de tus centros de acopio',
        text: `Una persona reportó un problema con «${c.name}» en Acopio Panamá. Revisa que la información esté al día en ${this.config.appOrigin}/mis-centros\n\nSi varias personas lo reportan, el centro se marca o se oculta automáticamente.`,
      });
    }
  }
}
