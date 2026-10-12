import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessService } from './access/access.service';
import { AccountController } from './auth/account.controller';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { SessionGuard } from './auth/session.guard';
import { CentersService } from './centers/centers.service';
import { ModerationController } from './centers/moderation.controller';
import { PublicController } from './centers/public.controller';
import { CoreModule } from './common/core.module';
import { SystemController } from './common/system.controller';
import { AppThrottlerGuard } from './common/throttler.guard';
import { JobsService } from './jobs/jobs.service';
import { MailService } from './mail/mail.service';

@Module({
  imports: [
    CoreModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }] }),
  ],
  controllers: [SystemController, AuthController, PublicController, AccountController, ModerationController],
  providers: [
    AccessService,
    AuditService,
    AuthService,
    MailService,
    CentersService,
    JobsService,
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
