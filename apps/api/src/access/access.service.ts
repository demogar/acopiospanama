import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../common/core.module';
import { ApiError, AuthContext, notFound } from '../common/http';
import type { DB } from '../db/db';

/**
 * Autorización. Cualquiera con correo verificado puede publicar centros y administrar los suyos;
 * moderación y administración (último recurso) exigen segundo factor.
 */
@Injectable()
export class AccessService {
  constructor(@Inject(DATABASE) private readonly db: DB) {}

  /** Cualquiera puede entrar salvo que esté bloqueado. */
  async hasAnyAccess(userId: string): Promise<boolean> {
    const u = await this.db.selectFrom('users').select('disabledAt').where('id', '=', userId).executeTakeFirst();
    return !!u && !u.disabledAt;
  }

  /** «Personal» = moderación o administración: segundo factor obligatorio. */
  async hasAnyStaffMembership(userId: string): Promise<boolean> {
    const u = await this.db
      .selectFrom('users')
      .select(['isModerator', 'isAdmin'])
      .where('id', '=', userId)
      .executeTakeFirst();
    return !!u && (u.isModerator || u.isAdmin);
  }

  requireModerator(auth: AuthContext) {
    if (!auth.user.isModerator && !auth.user.isAdmin) throw notFound();
    if (!auth.session.mfaVerifiedAt)
      throw new ApiError(403, 'MFA_REQUIRED', 'Verifica tu segundo factor para continuar.');
  }

  requireAdmin(auth: AuthContext) {
    if (!auth.user.isAdmin) throw notFound();
    if (!auth.session.mfaVerifiedAt)
      throw new ApiError(403, 'MFA_REQUIRED', 'Verifica tu segundo factor para continuar.');
  }

  requireStepUp(auth: AuthContext, minutes: number) {
    const at = auth.session.stepUpAt;
    if (!at || Date.now() - at.getTime() > minutes * 60_000) {
      throw new ApiError(403, 'STEP_UP_REQUIRED', 'Confirma con tu código de autenticación para continuar.');
    }
  }

  async isManager(userId: string, centerId: string): Promise<boolean> {
    const r = await this.db
      .selectFrom('centerManagers')
      .select('centerId')
      .where('userId', '=', userId)
      .where('centerId', '=', centerId)
      .executeTakeFirst();
    return !!r;
  }
}
