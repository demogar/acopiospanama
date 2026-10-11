import { NextRequest, NextResponse } from 'next/server';
import { analyticsOrigin } from '@/lib/site';

/**
 * CSP estricta con nonce por solicitud: solo se ejecutan los scripts de la propia app y el de la
 * analítica propia (Medama, sin cookies; ver `lib/site.ts`). Sin otros terceros, sin iframes.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  // Teselas del mapa (opcional, solo se piden al pulsar «Ver mapa»). Solo el origen, sin rutas.
  const tileHost = mapTileOrigin();
  // Analítica: el script lleva el nonce; el origen se lista además para navegadores sin 'strict-dynamic'.
  const stats = analyticsOrigin();
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}${stats ? ` ${stats}` : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${tileHost ? ` ${tileHost}` : ''}`,
    "font-src 'self'",
    `connect-src 'self'${stats ? ` ${stats}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function mapTileOrigin(): string {
  try {
    return new URL(process.env.MAP_TILE_HOST || 'https://tile.openstreetmap.org').origin;
  } catch {
    return '';
  }
}

export const config = {
  matcher: [
    {
      // Archivos de metadatos (iconos, robots, sitemap, manifest): sin CSP ni «no-store», se pueden cachear.
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|icon1|apple-icon|opengraph-image|robots.txt|sitemap.xml|manifest.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
