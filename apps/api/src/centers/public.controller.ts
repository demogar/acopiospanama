import { Body, Controller, Get, Header, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { ApiError, notFound, parse, parseId, Public, text } from '../common/http';
import { CENTER_TYPES, DISTRICTS, ITEMS, ORGANIZER_TYPES, PROVINCES, REPORT_KEYS, REPORT_REASONS } from '../domain';
import { CentersService } from './centers.service';
import { LinksService } from './links.service';

/** Endpoints públicos: sin cuenta, en caché y con límites por origen. */
@Controller('public')
export class PublicController {
  constructor(
    private readonly centers: CentersService,
    private readonly links: LinksService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Get('meta')
  @Header('Cache-Control', 'public, max-age=3600')
  meta() {
    return {
      provinces: PROVINCES,
      districts: DISTRICTS,
      items: ITEMS,
      centerTypes: CENTER_TYPES,
      organizerTypes: ORGANIZER_TYPES,
      reportReasons: REPORT_REASONS,
    };
  }

  @Public()
  @Get('centers')
  @Header('Cache-Control', 'public, max-age=30, s-maxage=30')
  async list() {
    return this.centers.publicList();
  }

  @Public()
  @Get('centers/:slug')
  @Header('Cache-Control', 'public, max-age=15, s-maxage=15')
  async detail(@Param('slug') slug: string) {
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw notFound();
    const c = await this.centers.publicDetail(slug);
    if (!c || c.visibility === 'REMOVED') throw notFound();
    if (c.visibility === 'COMMUNITY_HIDDEN') {
      throw new ApiError(
        410,
        'HIDDEN',
        'Este centro está oculto porque varias personas lo reportaron. Si estuviste allí y sigue funcionando, puedes confirmarlo. Si eres su responsable, entra para revisarlo.',
        {
          id: c.id,
          name: c.name,
        },
      );
    }
    return c;
  }

  /** «Estuve aquí y sigue funcionando.» Una vez por persona (origen) y día. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60 * 60_000 } })
  @Post('centers/:id/confirm')
  @HttpCode(200)
  async confirm(@Param('id') id: string, @Req() req: Request) {
    const centerId = parseId(id);
    const c = await this.centers.one(centerId);
    // También se puede confirmar un centro oculto por reportes: es el contrapeso de la comunidad.
    if (!c || c.visibility === 'REMOVED' || c.visibility === 'CLOSED') throw notFound();
    await this.centers.addConfirmation(centerId, this.centers.origin(req.ip));
    return { message: 'Gracias. Tu confirmación ayuda a otras personas a saber que este centro sigue funcionando.' };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Post('centers/:id/report')
  @HttpCode(200)
  async report(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const centerId = parseId(id);
    const input = parse(
      z.object({
        reason: z.enum(REPORT_KEYS, { errorMap: () => ({ message: 'Elige un motivo' }) }),
        details: text(500).default(''),
      }),
      body,
    );
    const c = await this.centers.one(centerId);
    if (!c || c.visibility === 'REMOVED') throw notFound();
    const created = await this.centers.addReport(
      centerId,
      input.reason,
      input.details,
      this.centers.origin(req.ip, false),
    );
    if (created) {
      await this.audit.log({
        action: 'report.created',
        objectType: 'center',
        objectId: centerId,
        meta: { reason: input.reason },
      });
      this.links.notifyManagersOfReport(centerId).catch(() => undefined);
    }
    if (!created) return { duplicate: true, message: 'Ya habías reportado este centro. Gracias.' };
    return {
      duplicate: false,
      message: 'Gracias por avisar. Si más personas reportan lo mismo, el centro se marca o se oculta automáticamente.',
    };
  }

  /** Enlace de los correos de recordatorio: confirmar con un toque (POST, para que los antivirus de correo no lo activen solos). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60 * 60_000 } })
  @Post('confirm-link')
  @HttpCode(200)
  async confirmLink(@Body() body: unknown) {
    const { token, action } = parse(
      z.object({ token: z.string().max(400), action: z.enum(['CONFIRM', 'CLOSE']).default('CONFIRM') }),
      body,
    );
    const r = await this.links.useToken(token, action);
    return r;
  }

  /** Ver a qué centro corresponde el enlace (POST: el token no queda en registros de acceso). */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60 * 60_000 } })
  @Post('confirm-link/peek')
  @HttpCode(200)
  async peekLink(@Body() body: unknown) {
    const { token } = parse(z.object({ token: z.string().max(400) }), body);
    return this.links.peekToken(token);
  }
}
