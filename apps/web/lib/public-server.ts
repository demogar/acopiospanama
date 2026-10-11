import type { PublicCenter, PublicMeta } from './public-types';

/**
 * Lecturas públicas desde el servidor de Next (primer pintado sin esperar otra ida y vuelta,
 * y metadatos para compartir). Si fallan, la página carga los datos desde el navegador.
 */
const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3011';

export type Loaded<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code?: string; message?: string; extra?: Record<string, unknown> };

async function get<T>(path: string, timeoutMs = 2500): Promise<Loaded<T>> {
  try {
    const res = await fetch(`${API}/api${path}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok)
      return {
        ok: false,
        status: res.status,
        code: body.code as string | undefined,
        message: body.message as string | undefined,
        extra: body,
      };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

export const getPublicCenters = () => get<PublicCenter[]>('/public/centers');
export const getPublicMeta = () => get<PublicMeta>('/public/meta');
export const getPublicCenter = (slug: string) =>
  /^[a-z0-9-]{1,80}$/.test(slug)
    ? get<PublicCenter>(`/public/centers/${slug}`)
    : Promise.resolve<Loaded<PublicCenter>>({ ok: false, status: 404 });

/** Origen de las teselas del mapa (también se usa en la CSP de `proxy.ts`). */
export function mapTileHost(): string {
  const raw = process.env.MAP_TILE_HOST || 'https://tile.openstreetmap.org';
  return raw.replace(/\/+$/, '');
}
