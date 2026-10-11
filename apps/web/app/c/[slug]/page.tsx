import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteFrame } from '@/components/site-frame';
import { CenterDetail } from '@/components/public/center-detail';
import { getPublicCenter, getPublicMeta } from '@/lib/public-server';
import { centerTypeShort, placeLine } from '@/lib/public-format';
import { openStatus, todayText } from '@/lib/public-schedule';

type Props = { params: Promise<{ slug: string }> };

const GENERIC: Metadata = {
  title: 'Centro de acopio · Acopio Panamá',
  description: 'Dónde llevar donaciones en Panamá y qué necesitan hoy.',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [c, meta] = await Promise.all([getPublicCenter(slug), getPublicMeta()]);
  if (!c.ok) {
    if (c.status === 404) return { title: 'No encontrado · Acopio Panamá', robots: { index: false } };
    if (c.status === 410) return { title: 'Centro oculto · Acopio Panamá', robots: { index: false } };
    return GENERIC;
  }
  const m = meta.ok ? meta.data : null;
  const label = (k: string) => m?.items[k] ?? k;
  const urgent = c.data.needs.filter((n) => n.level === 'URGENT').map((n) => label(n.item));
  const needed = c.data.needs.filter((n) => n.level === 'NEEDED').map((n) => label(n.item));
  const place = placeLine(m, c.data);
  const type = centerTypeShort(m, c.data.centerType);
  const today = todayText(c.data.schedule);
  const status = openStatus(c.data.schedule);
  // El enlace se comparte y se ve más tarde: se usa el horario de hoy, no «abierto ahora».
  const hoy = today ? ` ${today}.` : status ? ` ${status.label}.` : '';
  const needsText = urgent.length
    ? ` Urgente: ${urgent.join(', ')}.`
    : needed.length
      ? ` Necesitan: ${needed.join(', ')}.`
      : '';
  const description = `${type} en ${place}.${hoy}${needsText}`;
  const title = `${c.data.name} · Acopio Panamá`;
  return {
    title,
    description,
    openGraph: { title: c.data.name, description, type: 'website', siteName: 'Acopio Panamá', locale: 'es_PA' },
    twitter: { card: 'summary', title: c.data.name, description },
  };
}

export default async function CenterPage({ params }: Props) {
  const { slug } = await params;
  const [c, meta] = await Promise.all([getPublicCenter(slug), getPublicMeta()]);
  if (!c.ok && c.status === 404) notFound();
  return (
    <SiteFrame back={{ href: '/', label: 'Todos los centros' }} width="prose">
      <CenterDetail slug={slug} initial={c} initialMeta={meta.ok ? meta.data : null} />
    </SiteFrame>
  );
}
