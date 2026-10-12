'use client';

import { Badge } from '@demogar/mola-ui';
import { type MyCenter, VISIBILITY_INFO } from '@/lib/account-types';

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
