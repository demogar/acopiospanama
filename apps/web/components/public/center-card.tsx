import { memo } from 'react';
import Link from 'next/link';
import { MapPin, Navigation } from 'lucide-react';
import { buttonVariants } from '@demogar/mola-ui';
import { NewTab } from '@/components/ui/new-tab';
import { directionsLinks, formatKm, placeLine } from '@/lib/public-format';
import { OpenStatusBadge } from './open-status';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';
import { FreshnessShort, StatusBadges } from './freshness';
import { NeedsSummary } from './needs';

/**
 * Tarjeta de la lista. Pensada para escanearse, no para leerse: cada dato tiene una forma y un lugar fijos.
 * Nombre, dónde está, el estado en etiquetas y lo que necesitan como etiquetas (lo urgente en rojo). Tipo y
 * organizador quedan para la ficha. Cierra con «Cómo llegar» y «Ver», que es lo que la gente hace después.
 *
 * Memorizada: al filtrar, las tarjetas que siguen en la lista no se vuelven a pintar.
 */
export const CenterCard = memo(function CenterCard({
  center,
  meta,
  distanceKm,
  highlightItem,
  headingLevel = 3,
}: {
  center: PublicCenter;
  meta: PublicMeta | null;
  distanceKm?: number | null;
  highlightItem?: string | null;
  /** 4 cuando la tarjeta va bajo un encabezado de provincia. */
  headingLevel?: 3 | 4;
}) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const urgent = center.needs.some((n) => n.level === 'URGENT');
  const dir = directionsLinks(center, meta);
  return (
    <article
      className={`flex flex-col gap-4 bg-cloth-pale p-4 shadow-cut transition-shadow focus-within:shadow-[var(--focus-ring)] ${
        urgent ? 'border-s-4 border-rojo' : 'border-s-4 border-keyline-soft'
      }`}
    >
      <header className="grid gap-2">
        <Heading className="font-ui text-xl font-bold leading-snug text-ink">
          <Link href={`/c/${center.slug}`} className="text-ink no-underline hover:underline">
            {center.name}
          </Link>
        </Heading>
        <p className="flex items-start gap-1.5 text-sm text-ink-2">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {placeLine(meta, center)}
            {distanceKm != null && (
              <strong className="ms-1 whitespace-nowrap font-semibold text-ink">· {formatKm(distanceKm)}</strong>
            )}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
          <OpenStatusBadge center={center} />
          <StatusBadges center={center} />
        </div>
      </header>

      <NeedsSummary center={center} meta={meta} highlight={highlightItem} />

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-keyline-soft pt-4">
        <FreshnessShort center={center} />
        <div className="flex gap-2">
          <a
            href={dir.google}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonVariants({ variant: 'secondary' })} px-4 no-underline`}
          >
            <Navigation aria-hidden="true" className="size-4" />
            Cómo llegar
            <span className="sr-only"> a {center.name}</span>
            <NewTab label="se abre en Google Maps" />
          </a>
          <Link href={`/c/${center.slug}`} className={`${buttonVariants({ variant: 'primary' })} px-4 no-underline`}>
            Ver<span className="sr-only"> {center.name}</span>
          </Link>
        </div>
      </footer>
    </article>
  );
});
