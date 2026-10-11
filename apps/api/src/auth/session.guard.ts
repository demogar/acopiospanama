import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { CONFIG } from '../common/core.module';
import { ApiError, AuthedRequest, IS_PUBLIC } from '../common/http';
import type { AppConfig } from '../config';
import { AuthService } from './auth.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard global:
 *  1. CSRF: toda mutación exige la cabecera X-PHR y, si el navegador envía Origin, que sea el nuestro.
 *  2. Sesión: toda ruta exige sesión válida salvo las marcadas @Public().
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();

    if (!SAFE_METHODS.has(req.method)) {
      if (req.headers['x-acp'] !== '1') {
        throw new ApiError(403, 'CSRF', 'Solicitud no permitida.');
      }
      const origin = req.headers.origin;
      if (origin && origin !== this.config.appOrigin) {
        throw new ApiError(403, 'CSRF', 'Solicitud no permitida.');
      }
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const token = req.cookies?.[this.auth.cookieNames().session] as string | undefined;
    const resolved = await this.auth.resolveSession(token);
    if (resolved) {
      req.auth = resolved;
      return true;
    }
    if (token) {
      res.clearCookie(this.auth.cookieNames().session, {
        path: '/',
        secure: this.config.cookieSecure,
        httpOnly: true,
        sameSite: 'lax',
      });
    }
    if (isPublic) return true;
    throw new ApiError(401, 'UNAUTHENTICATED', 'Tu sesión terminó. Vuelve a entrar con tu correo.');
  }
}
