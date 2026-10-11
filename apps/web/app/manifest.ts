import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'Acopio',
    description: SITE_DESCRIPTION,
    lang: 'es-PA',
    start_url: '/',
    display: 'standalone',
    background_color: '#edeee8',
    theme_color: THEME_COLOR,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon1', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
