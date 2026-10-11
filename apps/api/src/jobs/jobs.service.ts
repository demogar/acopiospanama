import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { sql } from 'kysely';
import { AuditService } from '../audit/audit.service';
import { CentersService } from '../centers/centers.service';
import { LinksService } from '../centers/links.service';
import { CONFIG, DATABASE } from '../common/core.module';
import type { AppConfig } from '../config';
import type { DB } from '../db/db';

/**
 * Tareas automáticas (lo que hace que nadie tenga que estar pendiente):
 *  - cada hora: recordatorio «¿sigue funcionando?» a responsables de centros sin confirmar;
 *  - cada día: retención (borra lo que ya no hace falta).
 */
@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger('Jobs');

  constructor(
    @Inject(DATABASE) private readonly db: DB,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly scheduler: SchedulerRegistry,
    private readonly links: LinksService,
    private readonly centers: CentersService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (this.config.NODE_ENV === 'test') return;
    const reminders = new CronJob('0 15 * * * *', () => {
      this.links.sendReminders().catch((e) => this.logger.error(`Recordatorios: ${(e as Error).name}`));
    });
    const retention = new CronJob(this.config.RETENTION_CRON, () => {
      this.retention().catch((e) => this.logger.error(`Retención: ${(e as Error).name}`));
    });
    this.scheduler.addCronJob('reminders', reminders);
    this.scheduler.addCronJob('retention', retention);
    reminders.start();
    retention.start();
  }

  async retention() {
    const counts: Record<string, number> = {};
    const add = (k: string, n: bigint | number | undefined) => (counts[k] = Number(n ?? 0));
    add(
      'challenges',
      (
        await this.db
          .deleteFrom('authChallenges')
          .where('createdAt', '<', sql<Date>`now() - interval '1 day'`)
          .executeTakeFirst()
      ).numDeletedRows,
    );
    add(
      'sessions',
      (
        await this.db
          .deleteFrom('sessions')
          .where((eb) =>
            eb.or([
              eb('expiresAt', '<', sql<Date>`now() - interval '30 days'`),
              eb('revokedAt', '<', sql<Date>`now() - interval '30 days'`),
            ]),
          )
          .executeTakeFirst()
      ).numDeletedRows,
    );
    // Correos que pidieron código pero nunca entraron y no administran nada.
    add(
      'unverifiedUsers',
      (
        await this.db
          .deleteFrom('users')
          .where('verifiedAt', 'is', null)
          .where('isModerator', '=', false)
          .where('isAdmin', '=', false)
          .where('createdAt', '<', sql<Date>`now() - interval '1 day'`)
          .where((eb) =>
            eb.not(
              eb.exists(
                eb
                  .selectFrom('centerManagers')
                  .select('centerManagers.userId')
                  .whereRef('centerManagers.userId', '=', 'users.id'),
              ),
            ),
          )
          .executeTakeFirst()
      ).numDeletedRows,
    );
    add(
      'confirmations',
      (
        await this.db
          .deleteFrom('confirmations')
          .where('createdAt', '<', sql<Date>`now() - interval '30 days'`)
          .executeTakeFirst()
      ).numDeletedRows,
    );
    add(
      'reports',
      (
        await this.db
          .deleteFrom('reports')
          .where('createdAt', '<', sql<Date>`now() - interval '90 days'`)
          .executeTakeFirst()
      ).numDeletedRows,
    );
    // Centros cerrados, retirados o abandonados (sin actividad) por más de 180 días.
    add(
      'centers',
      (
        await this.db
          .deleteFrom('centers')
          .where((eb) =>
            eb.or([
              eb.and([eb('status', '!=', 'PUBLISHED'), eb('updatedAt', '<', sql<Date>`now() - interval '180 days'`)]),
              eb('managerConfirmedAt', '<', sql<Date>`now() - interval '180 days'`),
            ]),
          )
          .executeTakeFirst()
      ).numDeletedRows,
    );
    add(
      'blockedEmails',
      (
        await this.db
          .deleteFrom('blockedEmails')
          .where('createdAt', '<', sql<Date>`now() - interval '365 days'`)
          .executeTakeFirst()
      ).numDeletedRows,
    );
    add(
      'audit',
      (
        await this.db
          .deleteFrom('auditEvents')
          .where('createdAt', '<', sql<Date>`now() - interval '365 days'`)
          .executeTakeFirst()
      ).numDeletedRows,
    );
    this.centers.invalidate();
    await this.audit.log({ action: 'retention.run', objectType: 'system', meta: counts });
    return counts;
  }
}
