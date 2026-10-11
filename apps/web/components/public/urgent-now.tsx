'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@demogar/mola-ui';
import { itemLabel, placeLine } from '@/lib/public-format';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';
import { statusFor, useNow } from './open-status';

const SHOWN = 6;

/**
 * «Urgente ahora»: lo que más falta según los propios centros, artículo por artículo, con el centro que
 * lo pide y si está abierto. Sigue los mismos filtros que la lista, así que al elegir «Agua» solo queda
 * el agua. Si no hay nada urgente con esos filtros, no se muestra.
 */
export function UrgentNow({
  centers,
  meta,
  item,
}: {
  centers: PublicCenter[];
  meta: PublicMeta | null;
  /** Artículo elegido, o `ALL`. */
  item: string;
}) {
  const now = useNow();
  const [expanded, setExpanded] = useState(false);
  const rows: { key: string; item: string; center: PublicCenter }[] = [];
  for (const c of centers)
    for (const n of c.needs)
      if (n.level === 'URGENT' && (item === 'ALL' || n.item === item))
        rows.push({ key: `${c.id}-${n.item}`, item: n.item, center: c });
  if (rows.length === 0) return null;
  const shown = expanded ? rows : rows.slice(0, SHOWN);
  const rest = rows.length - shown.length;

  return (
    <section aria-labelledby="urgente-ahora" className="grid gap-4 bg-ink p-5 text-on-ink">
      <div className="grid gap-1">
        <h2 id="urgente-ahora" className="flex items-center gap-2 font-ui text-xl font-bold">
          <span aria-hidden="true" className="inline-block size-3 bg-oro" />
          Urgente ahora
        </h2>
        <p className="text-sm text-on-ink/75">Lo que más falta, según los propios centros.</p>
      </div>
      <ul className="grid gap-0 divide-y divide-on-ink/20 md:grid-cols-2 md:gap-x-8 md:divide-y-0">
        {shown.map((r) => {
          const st = statusFor(r.center, now);
          return (
            <li key={r.key} className="grid gap-0.5 py-3 leading-snug md:border-b md:border-on-ink/20">
              <span className="font-ui font-bold text-oro">{itemLabel(meta, r.item)}</span>
              <Link
                href={`/c/${r.center.slug}`}
                className="text-on-ink underline decoration-on-ink/50 underline-offset-2 hover:decoration-on-ink"
              >
                {r.center.name}
              </Link>
              <span className="text-sm text-on-ink/75">
                {placeLine(meta, r.center)}
                {st ? ` · ${st.label.toLowerCase()}` : ' · sin horario publicado'}
              </span>
            </li>
          );
        })}
      </ul>
      {(rest > 0 || expanded) && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 text-on-ink hover:bg-on-ink/10"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Ver menos' : rest === 1 ? 'Ver 1 más' : `Ver ${rest} más`}
          </Button>
        </div>
      )}
    </section>
  );
}
