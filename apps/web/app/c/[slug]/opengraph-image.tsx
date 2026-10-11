import { ogImage, OG_SIZE } from '@/lib/og';
import { centerTypeShort, itemLabel, placeLine } from '@/lib/public-format';
import { todayText } from '@/lib/public-schedule';
import { getPublicCenter, getPublicMeta } from '@/lib/public-server';
import { SITE_TAGLINE } from '@/lib/site';

export const alt = 'Ficha del centro en Acopio Panamá';
export const size = OG_SIZE;
export const contentType = 'image/png';
// Se dibuja al pedirla (datos vivos: necesidades y horario de hoy), nunca en la construcción.
export const dynamic = 'force-dynamic';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [c, meta] = await Promise.all([getPublicCenter(slug), getPublicMeta()]);
  if (!c.ok) return ogImage({ title: SITE_TAGLINE, lines: ['Centros de acopio en todo Panamá.'] });
  const m = meta.ok ? meta.data : null;
  const urgent = c.data.needs.filter((n) => n.level === 'URGENT').map((n) => itemLabel(m, n.item));
  const needed = c.data.needs.filter((n) => n.level === 'NEEDED').map((n) => itemLabel(m, n.item));
  const chips = urgent.length ? urgent : needed;
  return ogImage({
    kicker: centerTypeShort(m, c.data.centerType),
    title: c.data.name,
    lines: [placeLine(m, c.data), todayText(c.data.schedule) ?? ''],
    chips: chips.map((x) => (urgent.length ? `Urgente: ${x}` : x)),
    chipTone: urgent.length ? 'rojo' : 'oro',
  });
}
