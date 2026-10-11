import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/json-ld';
import { SiteFrame } from '@/components/site-frame';
import { CenterDetail } from '@/components/public/center-detail';
import { getPublicCenter, getPublicMeta } from '@/lib/public-server';
import { centerTypeShort, itemLabel, placeLine } from '@/lib/public-format';
import { openStatus, todayText } from '@/lib/public-schedule';
import { centerJsonLd, pageMeta } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';

type Props = { params: Promise<{ slug: string }> };

/** Una línea que sirve igual en la pestaña, al compartir y en los datos estructurados. */
function describe(c: PublicCenter, m: PublicMeta | null): string {
  const urgent = c.needs.filter((n) => n.level === 'URGENT').map((n) => itemLabel(m, n.item));
  const needed = c.needs.filter((n) => n.level === 'NEEDED').map((n) => itemLabel(m, n.item));
  const today = todayText(c.schedule);
  const status = openStatus(c.schedule);
  // El enlace se comparte y se ve más tarde: se usa el horario de hoy, no «abierto ahora».
  // «4:00 p. m.» ya termina en punto: no se añade otro.
  const hoy = today ? ` ${today}${today.endsWith('.') ? '' : '.'}` : status ? ` ${status.label}.` : '';
  const needsText = urgent.length
    ? ` Urgente: ${urgent.join(', ')}.`
    : needed.length
      ? ` Necesitan: ${needed.join(', ')}.`
      : '';
  return `${centerTypeShort(m, c.centerType)} en ${placeLine(m, c)}.${hoy}${needsText}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [c, meta] = await Promise.all([getPublicCenter(slug), getPublicMeta()]);
  if (!c.ok) {
    if (c.status === 404) return pageMeta({ title: 'No encontrado', noindex: true });
    if (c.status === 410) return pageMeta({ title: 'Centro oculto', noindex: true });
    return pageMeta({
      title: 'Centro de acopio',
      description: 'Dónde llevar donaciones en Panamá y qué necesitan hoy.',
    });
  }
  const m = meta.ok ? meta.data : null;
  return pageMeta({
    title: c.data.name,
    ogTitle: c.data.name,
    description: describe(c.data, m),
    path: `/c/${c.data.slug}`,
  });
}

export default async function CenterPage({ params }: Props) {
  const { slug } = await params;
  const [c, meta] = await Promise.all([getPublicCenter(slug), getPublicMeta()]);
  if (!c.ok && c.status === 404) notFound();
  const m = meta.ok ? meta.data : null;
  return (
    <SiteFrame back={{ href: '/', label: 'Todos los centros' }} width="page">
      {c.ok && <JsonLd data={centerJsonLd(c.data, m, `${SITE_URL}/c/${c.data.slug}`, describe(c.data, m))} />}
      <CenterDetail slug={slug} initial={c} initialMeta={m} />
    </SiteFrame>
  );
}
