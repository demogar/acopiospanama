'use client';

import { Badge, Callout } from '@demogar/mola-ui';
import { type MyCenter, REPORT_FOR_OWNER, type ReportReason, VISIBILITY_INFO } from '@/lib/account-types';

export function StatusBadges({ c }: { c: Pick<MyCenter, 'visibility' | 'flagged'> }) {
  const v = VISIBILITY_INFO[c.visibility];
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={v.tone} variant="soft" dot>
        {v.label}
      </Badge>
      {c.flagged && c.visibility !== 'COMMUNITY_HIDDEN' && (
        <Badge tone="warn" variant="outline">
          Con reportes
        </Badge>
      )}
    </span>
  );
}

/** Reportes abiertos contados al responsable, sin culpar, con qué hacer en cada caso. */
export function OwnerReports({
  c,
  headingLevel = 3,
}: {
  c: Pick<MyCenter, 'reportReasons' | 'visibility'>;
  headingLevel?: 2 | 3 | 4;
}) {
  const entries = Object.entries(c.reportReasons ?? {}).filter(([, n]) => (n ?? 0) > 0) as [ReportReason, number][];
  if (entries.length === 0 && c.visibility !== 'COMMUNITY_HIDDEN') return null;
  const hidden = c.visibility === 'COMMUNITY_HIDDEN';
  return (
    <Callout
      tone={hidden ? 'danger' : 'warn'}
      headingLevel={headingLevel}
      title={hidden ? 'Está oculto mientras se aclaran unos reportes' : 'Algunas personas avisaron algo'}
    >
      <p>Puede ser un malentendido. Esto es lo que dijeron:</p>
      <ul className="mt-2 list-disc space-y-2 ps-5">
        {entries.map(([r, n]) => (
          <li key={r}>
            <strong>
              {n === 1 ? '1 persona dijo' : `${n} personas dijeron`} que {REPORT_FOR_OWNER[r].text}.
            </strong>{' '}
            {REPORT_FOR_OWNER[r].fix}
          </li>
        ))}
      </ul>
      {hidden && (
        <p className="mt-2">
          Corrige la ficha. Vuelve a mostrarse cuando más personas confirmen en la ficha que funciona que las que lo
          reportaron, o cuando esos reportes cumplan 3 días. Pide a quienes lo visitan que toquen «Sigue funcionando».
        </p>
      )}
    </Callout>
  );
}
