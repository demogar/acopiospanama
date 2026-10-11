import { Controller, Get, Inject, Query } from '@nestjs/common';
import { sql } from 'kysely';
import { CONFIG, DATABASE } from './core.module';
import { notFound, Public } from './http';
import type { AppConfig } from '../config';
import type { DB } from '../db/db';
import { MailService } from '../mail/mail.service';

@Controller()
export class SystemController {
  constructor(
    @Inject(DATABASE) private readonly db: DB,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly mail: MailService,
  ) {}

  @Public()
  @Get('health')
  async health() {
    await sql`SELECT 1`.execute(this.db);
    return { ok: true, version: this.config.APP_VERSION };
  }

  /** Solo desarrollo: ver los correos que la app «envió». Deshabilitado en producción por configuración. */
  @Public()
  @Get('dev/outbox')
  outbox(@Query('to') to?: string) {
    if (!this.config.ENABLE_DEV_OUTBOX || this.config.NODE_ENV === 'production' || this.config.MAIL_MODE !== 'outbox')
      throw notFound();
    return this.mail.readOutbox(to);
  }
}
