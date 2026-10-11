import path from 'node:path';
import type { NextConfig } from 'next';

// En producción, Caddy envía /api/* directo a la API. Esta reescritura es para desarrollo
// (y como red de seguridad): el navegador siempre habla con un solo origen.
const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3011';

const config: NextConfig = {
  output: 'standalone',
  // Monorepo: el rastreo de dependencias parte de la raíz para incluir node_modules compartidos.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  // Fuentes de las imágenes para compartir (`lib/og.tsx`): que lleguen al `standalone` pase lo que pase.
  outputFileTracingIncludes: { '/*': ['./assets/fonts/*'] },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(self), microphone=(), payment=(), usb=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default config;
