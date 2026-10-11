import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { CONFIG, DATABASE, KEYS } from '../common/core.module';
import {
  decrypt,
  encrypt,
  hmac,
  Keys,
  normalizeEmail,
  numericCode,
  randomToken,
  recoveryCode,
  safeEqual,
  sha256,
} from '../common/crypto';
import { ApiError } from '../common/http';
import type { AppConfig } from '../config';
import type { DB } from '../db/db';
import type { SessionRow, User } from '../db/types';
import { MailService } from '../mail/mail.service';

export const CODE_TTL_MS = 10 * 60_000;
export const RESEND_COOLDOWN_MS = 60_000;
export const MAX_ATTEMPTS = 5;
export const MAX_CHALLENGES_PER_HOUR = 5; // códigos NUEVOS por correo y hora
export const MAX_GROUP_ATTEMPTS = 15; // intentos totales sobre un mismo código, sumando navegadores
export const MAX_SENDS_PER_CODE = 3; // envíos (incluidos reenvíos) de un mismo código
const TOTP_STEP_SECONDS = 30;

authenticator.options = { step: TOTP_STEP_SECONDS, window: 1, digits: 6 };

export const genericCodeError = () =>
  new ApiError(400, 'INVALID_CODE', 'El código es incorrecto o ya venció. Pide uno nuevo si hace falta.');

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private readonly db: DB,
    @Inject(KEYS) private readonly keys: Keys,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly mail: MailService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  cookieNames() {
    const p = this.config.cookieSecure ? '__Host-' : '';
    return { session: `${p}acp_s`, challenge: `${p}acp_c` };
  }

  /**
   * Pide un código de acceso. Siempre responde igual, exista o no el correo, y el correo se envía
   * fuera del camino de la respuesta para que el tiempo tampoco revele nada.
   *
   * Mientras haya un código vigente para ese correo, una nueva solicitud NO genera otro: crea un
   * desafío para este navegador ligado al mismo código (y como mucho lo reenvía, con límites).
   * Así, que otra persona pida códigos para tu correo no te bloquea ni te llena el buzón.
   */
  async requestCode(rawEmail: string): Promise<{ challengeCookie: string; cooldownSeconds: number }> {
    const email = normalizeEmail(rawEmail);
    const emailHmac = hmac(this.keys.email, email);
    const relaxed = this.config.RELAX_RATE_LIMITS;
    const resendGapMs = relaxed ? 0 : RESEND_COOLDOWN_MS;
    const maxCodesPerHour = relaxed ? 1000 : MAX_CHALLENGES_PER_HOUR;

    // Directorio abierto: cualquiera puede entrar con su correo. La cuenta se crea al pedir el código
    // y queda «sin verificar» hasta usarlo (la retención borra las no verificadas en 1 día).
    const blocked = await this.db
      .selectFrom('blockedEmails')
      .select('emailHmac')
      .where('emailHmac', '=', emailHmac)
      .executeTakeFirst();
    if (!blocked)
      await this.db
        .insertInto('users')
        .values({ email })
        .onConflict((oc) => oc.column('email').doNothing())
        .execute();
    const user = blocked
      ? undefined
      : await this.db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
    const eligible = !!user && !user.disabledAt && (await this.access.hasAnyAccess(user.id));

    const id = randomUUID();
    const nonce = randomToken();
    const now = new Date();

    const outcome = await this.db.transaction().execute(async (trx) => {
      // Serializa las solicitudes del mismo correo.
      await sql`SELECT pg_advisory_xact_lock(hashtext(${emailHmac}))`.execute(trx);
      const leader = await trx
        .selectFrom('authChallenges')
        .selectAll()
        .where('emailHmac', '=', emailHmac)
        .whereRef('id', '=', 'codeGroup')
        .where('consumedAt', 'is', null)
        .where('expiresAt', '>', now)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .executeTakeFirst();
      const groupAttempts = leader ? await this.groupAttempts(trx, leader.id) : 0;

      // Solo se reutiliza si la situación de la cuenta no cambió (p. ej. alguien que pidió código antes
      // de que la administración lo vinculara debe recibir uno nuevo al pedirlo ya vinculado).
      const sameTarget = !!leader && leader.userId === (eligible ? user!.id : null);
      if (leader && sameTarget && groupAttempts < MAX_GROUP_ATTEMPTS) {
        await trx
          .insertInto('authChallenges')
          .values({
            id,
            emailHmac,
            userId: leader.userId,
            codeHmac: leader.codeHmac,
            codeGroup: leader.id,
            nonceHash: sha256(nonce),
            expiresAt: leader.expiresAt,
          })
          .execute();
        const canResend =
          !!leader.userId &&
          !!leader.codeEnc &&
          leader.sentCount < MAX_SENDS_PER_CODE &&
          (!leader.lastSentAt || now.getTime() - leader.lastSentAt.getTime() >= resendGapMs);
        if (canResend) {
          await trx
            .updateTable('authChallenges')
            .set({ sentCount: sql`sent_count + 1`, lastSentAt: now })
            .where('id', '=', leader.id)
            .execute();
          return { send: decrypt(this.keys.codeEnc, leader.codeEnc!), expiresAt: leader.expiresAt };
        }
        return { send: null, expiresAt: leader.expiresAt };
      }

      const codesLastHour = await trx
        .selectFrom('authChallenges')
        .select((eb) => eb.fn.countAll<number>().as('n'))
        .where('emailHmac', '=', emailHmac)
        .whereRef('id', '=', 'codeGroup')
        .where('createdAt', '>', new Date(now.getTime() - 60 * 60_000))
        .executeTakeFirstOrThrow();
      if (codesLastHour.n >= maxCodesPerHour) {
        throw new ApiError(
          429,
          'TOO_MANY',
          'Se pidieron demasiados códigos para este correo. Usa el último que recibiste o intenta en una hora.',
        );
      }
      // Los códigos anteriores dejan de valer.
      await trx
        .updateTable('authChallenges')
        .set({ consumedAt: now, codeEnc: null })
        .where('emailHmac', '=', emailHmac)
        .where('consumedAt', 'is', null)
        .execute();
      const code = numericCode(8);
      const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
      await trx
        .insertInto('authChallenges')
        .values({
          id,
          emailHmac,
          userId: eligible ? user!.id : null,
          codeHmac: hmac(this.keys.otp, `${id}:${code}`),
          codeGroup: id,
          codeEnc: eligible ? encrypt(this.keys.codeEnc, code) : null,
          sentCount: eligible ? 1 : 0,
          lastSentAt: eligible ? now : null,
          nonceHash: sha256(nonce),
          expiresAt,
        })
        .execute();
      return { send: eligible ? code : null, expiresAt };
    });

    if (outcome.send) {
      const code = outcome.send;
      // Sin await: la respuesta tarda lo mismo haya o no envío.
      void this.mail
        .send({
          to: email,
          subject: `Tu código de acceso: ${code}`,
          text: [
            `Tu código para entrar a Acopio Panamá es: ${code}`,
            '',
            'Vence en 10 minutos. Si pediste el código varias veces, es el mismo.',
            'Si no lo pediste, ignora este correo: sin el código nadie puede entrar. Nadie de la administración te pedirá este código.',
          ].join('\n'),
        })
        .catch(() => undefined);
    }
    return { challengeCookie: `${id}.${nonce}`, cooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000) };
  }

  private async groupAttempts(trx: DB, groupId: string): Promise<number> {
    const r = await trx
      .selectFrom('authChallenges')
      .select((eb) => eb.fn.coalesce(eb.fn.sum<number>('attempts'), eb.lit(0)).as('n'))
      .where('codeGroup', '=', groupId)
      .executeTakeFirstOrThrow();
    return Number(r.n);
  }

  async verifyCode(challengeCookie: string | undefined, rawCode: string, userAgent: string) {
    const [id, nonce] = (challengeCookie ?? '').split('.');
    if (!id || !nonce || !/^[0-9a-f-]{36}$/.test(id)) throw genericCodeError();
    const code = rawCode.replace(/\D/g, '');
    if (code.length !== 8) throw genericCodeError();

    const ch = await this.db.selectFrom('authChallenges').selectAll().where('id', '=', id).executeTakeFirst();
    if (!ch || !safeEqual(ch.nonceHash, sha256(nonce))) throw genericCodeError();

    // Todo bajo el candado del código (fila líder): intentos y consumo son atómicos. Los errores se
    // devuelven como valor para no deshacer el conteo del intento al lanzar dentro de la transacción.
    const r = await this.db.transaction().execute(async (trx) => {
      const leader = await trx
        .selectFrom('authChallenges')
        .selectAll()
        .where('id', '=', ch.codeGroup)
        .forUpdate()
        .executeTakeFirst();
      const mine = await trx.selectFrom('authChallenges').selectAll().where('id', '=', ch.id).executeTakeFirstOrThrow();
      if (!leader || leader.consumedAt || leader.expiresAt <= new Date() || mine.consumedAt)
        return { kind: 'invalid' as const };
      const total = await this.groupAttempts(trx, leader.id);
      if (total >= MAX_GROUP_ATTEMPTS || mine.attempts >= MAX_ATTEMPTS) return { kind: 'exhausted' as const };
      await trx
        .updateTable('authChallenges')
        .set({ attempts: sql`attempts + 1` })
        .where('id', '=', mine.id)
        .execute();
      if (!safeEqual(leader.codeHmac, hmac(this.keys.otp, `${leader.id}:${code}`))) {
        return {
          kind: 'wrong' as const,
          left: Math.min(MAX_ATTEMPTS - mine.attempts - 1, MAX_GROUP_ATTEMPTS - total - 1),
        };
      }
      // Un código sirve una sola vez: se consumen todos los desafíos ligados a él.
      await trx
        .updateTable('authChallenges')
        .set({ consumedAt: new Date(), codeEnc: null })
        .where('codeGroup', '=', leader.id)
        .where('consumedAt', 'is', null)
        .execute();
      return { kind: 'ok' as const, userId: leader.userId };
    });

    if (r.kind === 'invalid') throw genericCodeError();
    if (r.kind === 'exhausted') throw new ApiError(400, 'INVALID_CODE', 'Agotaste los intentos. Pide un código nuevo.');
    if (r.kind === 'wrong') {
      if (r.left <= 0) throw new ApiError(400, 'INVALID_CODE', 'Agotaste los intentos. Pide un código nuevo.');
      throw new ApiError(400, 'INVALID_CODE', `Código incorrecto. Te quedan ${r.left} intentos.`, {
        attemptsLeft: r.left,
      });
    }
    if (!r.userId) throw genericCodeError();

    const user = await this.db.selectFrom('users').selectAll().where('id', '=', r.userId).executeTakeFirst();
    if (!user || user.disabledAt || !(await this.access.hasAnyAccess(user.id))) throw genericCodeError();
    if (!user.verifiedAt)
      await this.db.updateTable('users').set({ verifiedAt: new Date() }).where('id', '=', user.id).execute();

    const isStaff = await this.access.hasAnyStaffMembership(user.id);
    const token = randomToken();
    const maxMs = (isStaff ? this.config.STAFF_MAX_HOURS : this.config.RESIDENT_MAX_HOURS) * 3_600_000;
    await this.db
      .insertInto('sessions')
      .values({
        tokenHash: sha256(token),
        userId: user.id,
        isStaff,
        expiresAt: new Date(Date.now() + maxMs),
        userAgent: userAgent.slice(0, 160),
      })
      .execute();
    await this.audit.log({
      actorId: user.id,
      action: 'auth.login',
      objectType: 'user',
      objectId: user.id,
      meta: { staff: isStaff },
    });
    return { token, user, isStaff, maxAgeMs: maxMs };
  }

  /** Valida la sesión en cada solicitud. Devuelve null si no es válida (y la revoca si venció por inactividad). */
  async resolveSession(token: string | undefined): Promise<{ session: SessionRow; user: User } | null> {
    if (!token || token.length > 100) return null;
    const row = await this.db
      .selectFrom('sessions')
      .selectAll()
      .where('tokenHash', '=', sha256(token))
      .executeTakeFirst();
    if (!row || row.revokedAt) return null;
    const now = Date.now();
    const idleMs = (row.isStaff ? this.config.STAFF_IDLE_MINUTES : this.config.RESIDENT_IDLE_MINUTES) * 60_000;
    if (row.expiresAt.getTime() <= now || now - row.lastSeenAt.getTime() > idleMs) {
      await this.db.updateTable('sessions').set({ revokedAt: new Date() }).where('id', '=', row.id).execute();
      return null;
    }
    const user = await this.db.selectFrom('users').selectAll().where('id', '=', row.userId).executeTakeFirst();
    if (!user || user.disabledAt) return null;
    if (now - row.lastSeenAt.getTime() > 30_000) {
      await this.db.updateTable('sessions').set({ lastSeenAt: new Date() }).where('id', '=', row.id).execute();
      row.lastSeenAt = new Date();
    }
    return { session: row, user };
  }

  async logout(sessionId: string) {
    await this.db.updateTable('sessions').set({ revokedAt: new Date() }).where('id', '=', sessionId).execute();
  }

  idleMinutes(session: SessionRow) {
    return session.isStaff ? this.config.STAFF_IDLE_MINUTES : this.config.RESIDENT_IDLE_MINUTES;
  }

  // ───────────── MFA (TOTP) ─────────────

  async mfaSetup(user: User) {
    if (user.totpEnabledAt) throw new ApiError(409, 'MFA_ALREADY_ENABLED', 'Ya tienes un segundo factor activo.');
    const secret = authenticator.generateSecret(20);
    await this.db
      .updateTable('users')
      .set({ totpSecretEnc: encrypt(this.keys.totpEnc, secret), totpLastStep: null })
      .where('id', '=', user.id)
      .execute();
    const uri = authenticator.keyuri(user.email, 'Acopio Panamá', secret);
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
    return { secret, uri, qr };
  }

  /** Verifica un TOTP con protección contra reuso del mismo código. */
  private async checkTotp(user: User, token: string): Promise<boolean> {
    if (!user.totpSecretEnc) return false;
    const clean = token.replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) return false;
    const secret = decrypt(this.keys.totpEnc, user.totpSecretEnc);
    const delta = authenticator.checkDelta(clean, secret);
    if (delta === null) return false;
    const step = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) + delta;
    const updated = await this.db
      .updateTable('users')
      .set({ totpLastStep: step })
      .where('id', '=', user.id)
      .where((eb) => eb.or([eb('totpLastStep', 'is', null), eb('totpLastStep', '<', step)]))
      .returning('id')
      .executeTakeFirst();
    return !!updated;
  }

  async mfaEnable(user: User, sessionId: string, code: string): Promise<string[]> {
    if (user.totpEnabledAt) throw new ApiError(409, 'MFA_ALREADY_ENABLED', 'Ya tienes un segundo factor activo.');
    if (!user.totpSecretEnc) throw new ApiError(400, 'MFA_NOT_SETUP', 'Primero genera el código QR.');
    if (!(await this.checkTotp(user, code))) throw new ApiError(400, 'INVALID_TOTP', 'Código incorrecto.');
    const codes = Array.from({ length: 10 }, () => recoveryCode());
    const now = new Date();
    await this.db
      .updateTable('users')
      .set({ totpEnabledAt: now, recoveryCodes: codes.map((c) => hmac(this.keys.recovery, c)) })
      .where('id', '=', user.id)
      .execute();
    await this.db
      .updateTable('sessions')
      .set({ mfaVerifiedAt: now, stepUpAt: now })
      .where('id', '=', sessionId)
      .execute();
    await this.audit.log({ actorId: user.id, action: 'mfa.enabled', objectType: 'user', objectId: user.id });
    return codes;
  }

  async mfaVerify(user: User, sessionId: string, input: { code?: string; recoveryCode?: string }) {
    if (!user.totpEnabledAt) throw new ApiError(400, 'MFA_NOT_ENABLED', 'Primero configura tu segundo factor.');
    const fresh = await this.db
      .selectFrom('users')
      .select(['mfaFailedCount', 'mfaLockedUntil'])
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow();
    if (fresh.mfaLockedUntil && fresh.mfaLockedUntil > new Date()) {
      throw new ApiError(429, 'MFA_LOCKED', 'Demasiados códigos incorrectos. Espera 15 minutos e inténtalo de nuevo.');
    }
    let ok = false;
    let usedRecovery = false;
    if (input.code) {
      ok = await this.checkTotp(user, input.code);
    } else if (input.recoveryCode) {
      const normalized = input.recoveryCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const formatted = normalized.length === 10 ? `${normalized.slice(0, 5)}-${normalized.slice(5)}` : normalized;
      const h = hmac(this.keys.recovery, formatted);
      // Eliminación atómica del código usado.
      const res = await sql<{ id: string }>`
        UPDATE users SET recovery_codes = array_remove(recovery_codes, ${h})
        WHERE id = ${user.id} AND ${h} = ANY(recovery_codes)
        RETURNING id`.execute(this.db);
      ok = res.rows.length === 1;
      usedRecovery = ok;
    }
    if (!ok) {
      // Bloqueo por cuenta (no por IP): 10 fallos → 15 minutos.
      const failed = fresh.mfaFailedCount + 1;
      await this.db
        .updateTable('users')
        .set(
          failed >= 10
            ? { mfaFailedCount: 0, mfaLockedUntil: new Date(Date.now() + 15 * 60_000) }
            : { mfaFailedCount: failed },
        )
        .where('id', '=', user.id)
        .execute();
      await this.audit.log({
        actorId: user.id,
        action: failed >= 10 ? 'mfa.locked' : 'mfa.failed',
        objectType: 'user',
        objectId: user.id,
      });
      throw new ApiError(400, 'INVALID_TOTP', 'Código incorrecto.');
    }
    await this.db
      .updateTable('users')
      .set({ mfaFailedCount: 0, mfaLockedUntil: null })
      .where('id', '=', user.id)
      .execute();
    const now = new Date();
    await this.db
      .updateTable('sessions')
      .set({ mfaVerifiedAt: now, stepUpAt: now })
      .where('id', '=', sessionId)
      .execute();
    if (usedRecovery) {
      await this.audit.log({
        actorId: user.id,
        action: 'mfa.recovery_code_used',
        objectType: 'user',
        objectId: user.id,
      });
    }
  }

  async regenerateRecoveryCodes(user: User): Promise<string[]> {
    const codes = Array.from({ length: 10 }, () => recoveryCode());
    await this.db
      .updateTable('users')
      .set({ recoveryCodes: codes.map((c) => hmac(this.keys.recovery, c)) })
      .where('id', '=', user.id)
      .execute();
    await this.audit.log({
      actorId: user.id,
      action: 'mfa.recovery_regenerated',
      objectType: 'user',
      objectId: user.id,
    });
    return codes;
  }
}
