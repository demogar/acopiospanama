'use client';

/**
 * Cliente HTTP de la app. Todo va a /api del mismo origen: las cookies de sesión son
 * HttpOnly (el código del navegador nunca las ve) y cada mutación lleva la cabecera X-ACP
 * que la API exige como protección CSRF.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
  get fields(): Record<string, string> {
    return (this.data.fields as Record<string, string>) ?? {};
  }
}

type Json = Record<string, unknown> | unknown[];

async function request<T>(
  method: string,
  path: string,
  body?: Json | FormData,
  opts: { signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-ACP'] = '1';
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: payload,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'NETWORK',
      'Sin conexión. Revisa tu señal e intenta de nuevo; lo que guardaste no se pierde.',
    );
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : undefined;
  if (!res.ok) {
    const d = (data ?? {}) as { code?: string; message?: string };
    const err = new ApiError(
      res.status,
      d.code ?? 'ERROR',
      d.message ?? 'Ocurrió un error. Intenta de nuevo.',
      (data ?? {}) as Record<string, unknown>,
    );
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
      const next = window.location.pathname + window.location.search;
      // Fuera de React no hay router; la recarga completa además descarta el estado de la sesión vencida.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/entrar?siguiente=${encodeURIComponent(next)}`);
    }
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: { signal?: AbortSignal }) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body: Json | FormData = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: Json) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: Json) => request<T>('PATCH', path, body),
  del: <T>(path: string, body: Json = {}) => request<T>('DELETE', path, body),
};

/** Descarga un archivo de la API (p. ej. CSV) respetando cookies y cabeceras. */
export async function download(path: string, fallbackName: string) {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin', cache: 'no-store' });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, d.code ?? 'ERROR', d.message ?? 'No se pudo descargar.', d);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}

/** Clave aleatoria para envíos idempotentes (un reintento no duplica el reporte). */
export function idempotencyKey(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
