import type { MetadataRoute } from 'next';
import { getPublicCenters, getPublicMeta } from '@/lib/public-server';
import { SITE_URL } from '@/lib/site';

// Datos vivos: la lista de centros cambia a diario.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [centers, meta] = await Promise.all([getPublicCenters(), getPublicMeta()]);
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/publicar`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/como-funciona`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/accesibilidad`, changeFrequency: 'yearly', priority: 0.3 },
  ];
  // Una entrada por provincia («centros de acopio en Chiriquí»): la portada filtrada tiene su propio título.
  const provinces: MetadataRoute.Sitemap = Object.keys(meta.ok ? meta.data.provinces : {}).map((p) => ({
    url: `${SITE_URL}/?p=${p}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.7,
  }));
  const list: MetadataRoute.Sitemap = (centers.ok ? centers.data : []).map((c) => ({
    url: `${SITE_URL}/c/${c.slug}`,
    lastModified: new Date(c.updatedAt),
    changeFrequency: 'daily',
    priority: 0.8,
  }));
  return [...fixed, ...provinces, ...list];
}
