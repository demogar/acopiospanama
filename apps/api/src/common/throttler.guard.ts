import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { loadConfig } from '../config';
import { clientKey } from './crypto';

/** Límites por IP. Con RELAX_RATE_LIMITS (solo desarrollo/pruebas; prohibido en producción) se omiten. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  /** IPv6 por /64: rotar direcciones dentro del mismo prefijo no evade los límites. */
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientKey(req.ip as string | undefined);
  }

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (loadConfig().RELAX_RATE_LIMITS) return true;
    return super.shouldSkip(context);
  }
}
