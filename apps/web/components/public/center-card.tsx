import Link from 'next/link';
import { MapPin, Navigation } from 'lucide-react';
import { buttonVariants } from '@demogar/mola-ui';
import { centerTypeShort, directionsLinks, formatKm, organizerLabel, placeLine } from '@/lib/public-format';
import { OpenLine } from './open-status';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';
import { FreshnessLine, StatusBadges } from './freshness';
import { NeedsSummary } from './needs';

/**
 * Tarjeta de la lista. Pensada para leerse de un vistazo en el teléfono: primero si está abierto, luego el
 * nombre, una línea discreta con el tipo y quién organiza, dónde está, y lo que necesitan como lista (no como
 * frase), con aire entre bloques. Cierra con «Cómo llegar» y «Ver centro», que es lo que la gente hace después.
 */
export function CenterCard({
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
  const organizer =
    center.organizerName && center.organizerName !== center.name
      ? center.organizerName
      : organizerLabel(meta, center.organizerType);
  const dir = directionsLinks(center, meta);
  return (
    <article
      className={`flex flex-col gap-5 bg-cloth-pale p-5 shadow-cut transition-shadow focus-within:shadow-[var(--focus-ring)] ${
        urgent ? 'border-s-4 border-rojo' : 'border-s-4 border-keyline-soft'
      }`}
    >
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadges center={center} />
        </div>
        <OpenLine center={center} />
        <Heading className="font-ui text-xl font-bold leading-snug text-ink">
          <Link href={`/c/${center.slug}`} className="text-ink no-underline hover:underline">
            {center.name}
          </Link>
        </Heading>
        <p className="text-sm leading-relaxed text-ink-2">
          {centerTypeShort(meta, center.centerType)} · {organizer}
        </p>
        <p className="flex items-start gap-2 text-sm leading-relaxed text-ink">
          <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-ink-2" />
          <span>
            {placeLine(meta, center)}
            {distanceKm != null && (
              <strong className="ms-1 whitespace-nowrap font-semibold">· {formatKm(distanceKm)}</strong>
            )}
          </span>
        </p>
      </header>

      <NeedsSummary center={center} meta={meta} highlight={highlightItem} />

      <footer className="mt-auto grid gap-3 border-t border-keyline-soft pt-4">
        <FreshnessLine center={center} />
        <div className="grid grid-cols-2 gap-2">
          <a
            href={dir.google}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
          >
            <Navigation aria-hidden="true" className="size-4" />
            Cómo llegar
          </a>
          <Link href={`/c/${center.slug}`} className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
            Ver centro
          </Link>
        </div>
      </footer>
    </article>
  );
}
