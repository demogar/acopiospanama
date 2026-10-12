import { Badge } from '@demogar/mola-ui';
import { timeAgo } from '@/lib/public-format';
import type { PublicCenter } from '@/lib/public-types';

/** «Confirmado hace 3 h · Confirmado por 4 personas». */
export function FreshnessLine({
  center,
  now,
}: {
  center: Pick<PublicCenter, 'lastActivity' | 'confirmations'>;
  now?: number;
}) {
  const n = center.confirmations;
  return (
    <p className="text-sm text-ink-2">
      Confirmado <span suppressHydrationWarning>{timeAgo(center.lastActivity, now)}</span>
      {n > 0 && <> · Confirmado por {n === 1 ? '1 persona' : `${n} personas`}</>}
    </p>
  );
}

/** Etiquetas de estado: «Nuevo», «Reportado: verifica antes de ir», «Cerrado». */
export function StatusBadges({ center }: { center: Pick<PublicCenter, 'isNew' | 'visibility' | 'flagged'> }) {
  const items: React.ReactNode[] = [];
  if (center.visibility === 'CLOSED')
    items.push(
      <Badge key="closed" tone="neutral" variant="solid">
        Cerrado
      </Badge>,
    );
  if (center.flagged)
    items.push(
      <Badge key="flag" tone="danger" variant="soft" dot>
        Reportado: verifica antes de ir
      </Badge>,
    );
  if (center.isNew)
    items.push(
      <Badge key="new" tone="info" variant="soft">
        Nuevo
      </Badge>,
    );
  if (items.length === 0) return null;
  return <>{items}</>;
}
