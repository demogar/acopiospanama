/**
 * Identidad del sitio para metadatos, imágenes para compartir, sitemap y manifest.
 * Sin dependencias de Node: también lo importa `proxy.ts`.
 */

export const SITE_NAME = 'Acopio Panamá';

/** Origen público, sin barra final. En producción viene de APP_ORIGIN (ver deploy/.env.example). */
export const SITE_URL = (process.env.APP_ORIGIN || 'https://acopiospanama.com').replace(/\/+$/, '');

/** Solo el dominio, para mostrarlo (pie de las imágenes para compartir). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

export const SITE_TAGLINE = 'Dónde llevar donaciones y qué necesitan hoy';

export const SITE_TITLE = `${SITE_NAME}: ${SITE_TAGLINE.charAt(0).toLowerCase()}${SITE_TAGLINE.slice(1)}`;

export const SITE_DESCRIPTION =
  'Directorio abierto de centros de acopio, puntos de distribución, comedores y albergues en Panamá tras el ' +
  'terremoto del 9 de octubre de 2026. Qué aceptan, qué es urgente, horario y cómo llegar, confirmado por la comunidad.';

/** Color del encabezado (`bg-cloth-pale` de Mola UI): barra del navegador y manifest. */
export const THEME_COLOR = '#f6f7f2';

/**
 * Analítica propia (Medama: código abierto, sin cookies ni identificadores personales).
 * `ANALYTICS_HOST` vacío la desactiva; sin definir, usa el servidor del proyecto.
 * Se añade a la CSP en `proxy.ts` y al `<Script>` del layout raíz.
 */
export function analyticsOrigin(): string {
  const raw = process.env.ANALYTICS_HOST ?? 'https://stats.demogar.software';
  if (!raw.trim()) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

export function analyticsScriptUrl(): string {
  const origin = analyticsOrigin();
  return origin ? `${origin}/script.js` : '';
}
