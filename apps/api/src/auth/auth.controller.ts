import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { AccessService } from '../access/access.service';
import { CONFIG } from '../common/core.module';
import { ApiError, Auth, AuthContext, AuthedRequest, parse, Public } from '../common/http';
import type { AppConfig } from '../config';
import { AuthService, CODE_TTL_MS } from './auth.service';

const emailSchema = z.object({ email: z.string().trim().max(254).email('Escribe un correo válido') });
const codeSchema = z.object({ code: z.string().max(20) });
const mfaSchema = z
  .object({ code: z.string().max(12).optional(), recoveryCode: z.string().max(20).optional() })
  .refine((v) => !!v.code || !!v.recoveryCode, 'Escribe el código');

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly access: AccessService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private cookieOpts(maxAge: number) {
    return { httpOnly: true, secure: this.config.cookieSecure, sameSite: 'lax' as const, path: '/', maxAge };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Post('request-code')
  @HttpCode(200)
  async requestCode(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { email } = parse(emailSchema, body);
    const r = await this.auth.requestCode(email);
    res.cookie(this.auth.cookieNames().challenge, r.challengeCookie, this.cookieOpts(CODE_TTL_MS));
    return {
      message: 'Te enviamos un código de 8 dígitos. Revisa también correo no deseado.',
      cooldownSeconds: r.cooldownSeconds,
    };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 15 * 60_000 } })
  @Post('verify-code')
  @HttpCode(200)
  async verifyCode(@Body() body: unknown, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const { code } = parse(codeSchema, body);
    const names = this.auth.cookieNames();
    const r = await this.auth.verifyCode(req.cookies?.[names.challenge], code, String(req.headers['user-agent'] ?? ''));
    if (req.auth) await this.auth.logout(req.auth.session.id); // rotación: la sesión anterior deja de valer
    res.clearCookie(names.challenge, { path: '/', secure: this.config.cookieSecure, httpOnly: true, sameSite: 'lax' });
    res.cookie(names.session, r.token, this.cookieOpts(r.maxAgeMs));
    return { isStaff: r.isStaff, mfaEnrolled: !!r.user.totpEnabledAt };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Auth() a: AuthContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(a.session.id);
    res.clearCookie(this.auth.cookieNames().session, {
      path: '/',
      secure: this.config.cookieSecure,
      httpOnly: true,
      sameSite: 'lax',
    });
    return { ok: true };
  }

  @Get('session')
  async session(@Auth() a: AuthContext) {
    const isStaff = await this.access.hasAnyStaffMembership(a.user.id);
    return {
      user: { id: a.user.id, email: a.user.email, name: a.user.name },
      isStaff,
      mfaEnrolled: !!a.user.totpEnabledAt,
      mfaVerified: !!a.session.mfaVerifiedAt,
      idleMinutes: this.auth.idleMinutes(a.session),
      expiresAt: a.session.expiresAt,
    };
  }

  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Post('mfa/setup')
  @HttpCode(200)
  async mfaSetup(@Auth() a: AuthContext) {
    if (!(await this.access.hasAnyStaffMembership(a.user.id))) {
      throw new ApiError(403, 'NOT_STAFF', 'El segundo factor es para moderación.');
    }
    const r = await this.auth.mfaSetup(a.user);
    return { secret: r.secret, qr: r.qr, uri: r.uri };
  }

  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @Post('mfa/enable')
  @HttpCode(200)
  async mfaEnable(@Auth() a: AuthContext, @Body() body: unknown) {
    const { code } = parse(codeSchema, body);
    const recoveryCodes = await this.auth.mfaEnable(a.user, a.session.id, code);
    return { recoveryCodes };
  }

  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @Post('mfa/verify')
  @HttpCode(200)
  async mfaVerify(@Auth() a: AuthContext, @Body() body: unknown) {
    const input = parse(mfaSchema, body);
    await this.auth.mfaVerify(a.user, a.session.id, input);
    return { ok: true };
  }

  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('mfa/recovery-codes')
  @HttpCode(200)
  async regenerate(@Auth() a: AuthContext) {
    if (!a.session.mfaVerifiedAt) throw new ApiError(403, 'MFA_REQUIRED', 'Verifica tu segundo factor para continuar.');
    this.access.requireStepUp(a, this.config.STEP_UP_MINUTES);
    return { recoveryCodes: await this.auth.regenerateRecoveryCodes(a.user) };
  }
}
