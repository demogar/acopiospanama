import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Badge } from '@demogar/mola-ui';
import { centerTypeShort, formatKm, organizerLabel, placeLine } from '@/lib/public-format';
import { OpenLine } from './open-status';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';
import { FreshnessLine, StatusBadges } from './freshness';
import { NeedsSummary } from './needs';

export function CenterCard({
  center,
  meta,
  distanceKm,
  highlightItem,
}: {
  center: PublicCenter;
  meta: PublicMeta | null;
  distanceKm?: number | null;
  highlightItem?: string | null;
}) {
  const urgent = center.needs.some((n) => n.level === 'URGENT');
  return (
    <article
      className={`relative flex flex-col gap-3 bg-cloth-pale p-4 shadow-cut transition-shadow focus-within:shadow-[var(--focus-ring)] hover:shadow-[0_0_0_2px_var(--color-ink)] ${
        urgent ? 'border-s-4 border-rojo' : 'border-s-4 border-keyline-soft'
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent" variant="outline">
            {centerTypeShort(meta, center.centerType)}
          </Badge>
          <StatusBadges center={center} />
        </div>
        <h3 className="font-ui text-lg font-bold leading-snug text-ink">
          <Link
            href={`/c/${center.slug}`}
            className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none"
          >
            {center.name}
          </Link>
        </h3>
        <p className="text-sm text-ink-2">
          {organizerLabel(meta, center.organizerType)}
          {center.organizerName && center.organizerName !== center.name ? ` · ${center.organizerName}` : ''}
        </p>
        <p className="flex items-start gap-1 text-sm text-ink">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-2" />
          <span>
            {placeLine(meta, center)}
            {distanceKm != null && (
              <strong className="ms-1 whitespace-nowrap font-semibold">· {formatKm(distanceKm)}</strong>
            )}
          </span>
        </p>
        <OpenLine center={center} />
      </div>
      <NeedsSummary center={center} meta={meta} highlight={highlightItem} />
      <FreshnessLine center={center} />
    </article>
  );
}
