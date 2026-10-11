import { createParamDecorator, ExecutionContext, HttpException, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { z, ZodTypeAny } from 'zod';
import type { SessionRow, User } from '../db/types';

export interface AuthContext {
  session: SessionRow;
  user: User;
}

export type AuthedRequest = Request & { auth?: AuthContext };

/** Error de API con código estable y mensaje en español para mostrar al usuario. */
export class ApiError extends HttpException {
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super({ code, message, ...extra }, status);
  }
}

export const notFound = () => new ApiError(404, 'NOT_FOUND', 'No encontrado.');
export const badRequest = (message: string, code = 'BAD_REQUEST', extra: Record<string, unknown> = {}) =>
  new ApiError(400, code, message, extra);
export const conflict = (message: string, code = 'CONFLICT') => new ApiError(409, code, message);

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const issue of r.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new ApiError(400, 'VALIDATION', 'Revisa los datos enviados.', { fields });
  }
  return r.data;
}

export const uuid = z.string().uuid('Identificador inválido');

export function parseId(value: string): string {
  const r = uuid.safeParse(value);
  if (!r.success) throw notFound();
  return r.data;
}

export const IS_PUBLIC = 'acp:public';
/** Ruta accesible sin sesión. Todo lo demás exige sesión (denegación por defecto). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  return req.auth;
});

/** Texto libre acotado: sin caracteres de control salvo saltos de línea. */
export const text = (max: number) =>
  z
    .string()
    .max(max, `Máximo ${max} caracteres`)
    .transform((s) =>
      s
        .replace(/\r\n/g, '\n')
        // eslint-disable-next-line no-control-regex -- elimina caracteres de control a propósito
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim(),
    );

export const shortText = (max: number) =>
  z
    .string()
    .max(max, `Máximo ${max} caracteres`)
    .transform((s) =>
      s
        // eslint-disable-next-line no-control-regex -- elimina caracteres de control a propósito
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
