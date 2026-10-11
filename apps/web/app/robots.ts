import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// En tiempo de ejecución, para leer APP_ORIGIN del servidor y no del momento de construir.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Pantallas privadas o de un solo uso: sin valor en los buscadores.
        disallow: ['/api/', '/entrar', '/confirmar', '/mis-centros', '/moderacion', '/seguridad'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
