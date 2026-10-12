import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@demogar/mola-ui';
import { timeAgo } from '@/lib/public-format';
import type { PublicCenter } from '@/lib/public-types';

/** «✓ hace 3 h · 4 personas»: cuándo se confirmó por última vez y cuántas personas lo confirmaron. */
export function FreshnessShort({ center }: { center: Pick<PublicCenter, 'lastActivity' | 'confirmations'> }) {
  const n = center.confirmations;
  return (
    <p className="flex items-center gap-1.5 text-sm text-ink-2">
      <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
      <span>
        <span className="sr-only">Confirmado </span>
        <span suppressHydrationWarning>{timeAgo(center.lastActivity)}</span>
        {n > 0 && <> · {n === 1 ? '1 persona' : `${n} personas`}</>}
      </span>
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
