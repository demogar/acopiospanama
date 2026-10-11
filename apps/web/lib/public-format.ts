import type { NeedLevel, PublicCenter, PublicMeta } from './public-types';
import { CENTER_TYPES_FALLBACK, shortTypeLabel } from './public-schedule';

/** «hace 3 h», «hace 5 min», «hace 2 días». */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

export function needsAt(c: Pick<PublicCenter, 'needs'>, level: NeedLevel) {
  return c.needs.filter((n) => n.level === level);
}

export function itemLabel(meta: PublicMeta | null | undefined, key: string): string {
  return meta?.items[key] ?? key;
}

export function provinceLabel(meta: PublicMeta | null | undefined, key: string): string {
  return meta?.provinces[key] ?? key;
}

export function centerTypeLabel(meta: PublicMeta | null | undefined, key: string): string {
  return meta?.centerTypes?.[key] ?? CENTER_TYPES_FALLBACK[key] ?? key;
}

export function centerTypeShort(meta: PublicMeta | null | undefined, key: string): string {
  return shortTypeLabel(centerTypeLabel(meta, key));
}

export function organizerLabel(meta: PublicMeta | null | undefined, key: string): string {
  return meta?.organizerTypes[key] ?? key;
}

/** «Tonosí cabecera, Tonosí, Los Santos» sin repetir partes iguales. */
export function placeLine(
  meta: PublicMeta | null | undefined,
  c: Pick<PublicCenter, 'community' | 'district' | 'province'>,
): string {
  const parts = [c.community, c.district, provinceLabel(meta, c.province)]
    .map((s) => s?.trim())
    .filter(Boolean) as string[];
  return parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i).join(', ');
}

/** Distancia en km entre dos puntos (fórmula de Haversine). Se calcula solo en el navegador. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatKm(km: number): string {
  if (km < 1) return 'a menos de 1 km';
  if (km < 10) return `a ${km.toLocaleString('es-PA', { maximumFractionDigits: 1 })} km`;
  return `a ${Math.round(km).toLocaleString('es-PA')} km`;
}

/** Texto sin tildes ni mayúsculas, para buscar «tonosi» y encontrar «Tonosí». */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function hasCoords(c: Pick<PublicCenter, 'lat' | 'lng'>): c is { lat: number; lng: number } {
  return typeof c.lat === 'number' && typeof c.lng === 'number' && Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

export function directionsLinks(
  c: Pick<PublicCenter, 'lat' | 'lng' | 'address' | 'community' | 'district' | 'province' | 'name'>,
  meta?: PublicMeta | null,
) {
  if (hasCoords(c)) {
    const ll = `${c.lat},${c.lng}`; // coma literal: Waze y Google la esperan así
    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
    };
  }
  const q = [c.address, placeLine(meta, c), 'Panamá'].filter(Boolean).join(', ');
  return { google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, waze: null };
}
