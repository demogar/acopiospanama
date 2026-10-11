import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Respuestas de error uniformes: { code, message, ... }.
 * Los errores inesperados se registran sin cuerpo de la solicitud ni datos personales.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<{ method: string; route?: { path?: string } }>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body && 'code' in body) {
        res.status(status).json(body);
        return;
      }
      const message =
        status === 404
          ? 'No encontrado.'
          : status === 429
            ? 'Demasiadas solicitudes. Espera un momento.'
            : status === 413
              ? 'El archivo es demasiado grande.'
              : 'Solicitud inválida.';
      const code =
        status === 404 ? 'NOT_FOUND' : status === 429 ? 'RATE_LIMITED' : status === 413 ? 'TOO_LARGE' : 'BAD_REQUEST';
      res.status(status).json({ code, message });
      return;
    }
    const err = exception as { name?: string; code?: string; message?: string };
    this.logger.error(
      `${req.method} ${req.route?.path ?? '?'} → ${err.name ?? 'Error'}${err.code ? ` [${err.code}]` : ''}`,
    );
    res.status(500).json({
      code: 'INTERNAL',
      message: 'Ocurrió un error. Intenta de nuevo; si persiste, avisa a la administración.',
    });
  }
}
