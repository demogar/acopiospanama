import { ogImage, OG_SIZE } from '@/lib/og';
import { SITE_TAGLINE } from '@/lib/site';

export const alt = 'Acopio Panamá: dónde llevar donaciones y qué necesitan hoy';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogImage({
    title: SITE_TAGLINE,
    lines: [
      'Centros de acopio, puntos de distribución, comedores y albergues en todo Panamá.',
      'Lo mantiene la comunidad: tú confirmas, tú reportas.',
    ],
  });
}
