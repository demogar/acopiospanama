import { Controller, Delete, Get, HttpCode, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { CONFIG, DATABASE } from '../common/core.module';
import { ApiError, Auth, AuthContext } from '../common/http';
import type { AppConfig } from '../config';
import type { DB } from '../db/db';
import { CentersService } from '../centers/centers.service';

/**
 * La cuenta propia. Ya no se publican ni se administran centros desde la web (se cargan por lotes con
 * `import-centers`), así que una cuenta sirve para moderar; quien publicó antes puede borrar la suya.
 */
@Controller()
export class AccountController {
  constructor(
    @Inject(DATABASE) private readonly db: DB,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly centers: CentersService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  @Get('me')
  me(@Auth() a: AuthContext) {
    return {
      user: {
        id: a.user.id,
        email: a.user.email,
        name: a.user.name,
        isModerator: a.user.isModerator || a.user.isAdmin,
        isAdmin: a.user.isAdmin,
      },
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
}
