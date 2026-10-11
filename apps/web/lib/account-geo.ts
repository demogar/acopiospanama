/** Lectura de ubicaciones pegadas desde Google Maps (o coordenadas sueltas). Todo local, sin red. */

export const PANAMA_BOUNDS = { minLat: 7.0, maxLat: 9.8, minLng: -83.1, maxLng: -77.1 };

export function inPanama(lat: number, lng: number): boolean {
  return (
    lat >= PANAMA_BOUNDS.minLat &&
    lat <= PANAMA_BOUNDS.maxLat &&
    lng >= PANAMA_BOUNDS.minLng &&
    lng <= PANAMA_BOUNDS.maxLng
  );
}

export type ParsedLocation =
  { ok: true; lat: number; lng: number } | { ok: false; reason: 'SHORT_LINK' | 'NOT_FOUND' | 'OUTSIDE' };

const NUM = '(-?\\d{1,2}(?:\\.\\d+)?)';
const PAIR = `${NUM}\\s*,\\s*(-?\\d{1,3}(?:\\.\\d+)?)`;

/**
 * Formatos admitidos: `…/@lat,lng,17z`, `…/place/Nombre/@lat,lng…` (y `!3dlat!4dlng`, más preciso),
 * `?q=lat,lng`, `?ll=lat,lng`, `?query=lat,lng`, `?center=lat,lng`, `?destination=lat,lng`, o
 * coordenadas sueltas «8.98, -79.52». Los enlaces cortos (maps.app.goo.gl) no se pueden leer sin
 * abrirlos, y eso exigiría pedirle algo a Google desde el servidor: se explica en la interfaz.
 */
export function parseMapsLocation(raw: string): ParsedLocation {
  let s = raw.trim();
  if (!s) return { ok: false, reason: 'NOT_FOUND' };
  try {
    s = decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    /* se usa tal cual */
  }
  if (/(^|\/\/|\.)(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(s)) return { ok: false, reason: 'SHORT_LINK' };

  const candidates: RegExp[] = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // posición exacta del lugar en enlaces /place/
    new RegExp(`[?&](?:q|ll|query|center|destination|daddr|sll)=(?:loc:)?${PAIR}`, 'i'),
    new RegExp(`@${PAIR}`),
    new RegExp(`^${PAIR}$`),
  ];
  for (const re of candidates) {
    const m = re.exec(s);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!inPanama(lat, lng)) return { ok: false, reason: 'OUTSIDE' };
    return { ok: true, lat: round(lat), lng: round(lng) };
  }
  return { ok: false, reason: 'NOT_FOUND' };
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
