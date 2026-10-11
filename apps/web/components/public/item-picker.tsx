'use client';

import { useMemo, useState } from 'react';
import { Button } from '@demogar/mola-ui';
import { itemLabel } from '@/lib/public-format';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';

export const ANY_ITEM = 'ALL';

/** Cuántos de los artículos se ven de entrada en pantallas pequeñas; el resto, al tocar «Ver todos». */
const COMPACT = 6;

/**
 * «¿Qué quieres donar?»: una rejilla de artículos con cuántos centros los piden y en cuántos es urgente.
 * Es la entrada principal de la portada: la persona empieza por lo que tiene en la mano, no por una provincia.
 * Los conteos salen de los centros que cumplen el resto de filtros (`pool`), así siempre reflejan la lista de abajo.
 */
export function ItemPicker({
  meta,
  pool,
  value,
  onChange,
}: {
  meta: PublicMeta | null;
  pool: PublicCenter[];
  value: string;
  onChange: (item: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const tiles = useMemo(() => {
    const keys = Object.keys(meta?.items ?? {});
    return keys
      .map((key) => {
        let count = 0;
        let urgent = 0;
        for (const c of pool) {
          const n = c.needs.find((x) => x.item === key);
          if (!n || n.level === 'ENOUGH') continue;
          count++;
          if (n.level === 'URGENT') urgent++;
        }
        return { key, label: itemLabel(meta, key), count, urgent };
      })
      .sort((a, b) => b.urgent - a.urgent || b.count - a.count);
  }, [meta, pool]);

  const hiddenCount = Math.max(0, tiles.length - COMPACT);
  const tile = (key: string, label: string, count: number | null, urgent: number, extraClass = '') => {
    const on = value === key;
    const none = count === 0;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={on}
        onClick={() => onChange(on ? ANY_ITEM : key)}
        className={`flex min-h-[4.5rem] flex-col items-start justify-between gap-1.5 p-3 text-start leading-snug shadow-cut transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none ${
          on
            ? 'bg-ink text-on-ink forced-selected'
            : none
              ? 'bg-cloth-pale text-ink-2'
              : 'bg-cloth-pale text-ink hover:bg-cloth-shade'
        } ${extraClass}`}
      >
        <span className="font-ui text-base font-bold">{label}</span>
        {count !== null && (
          <span className={`text-xs ${on ? 'text-on-ink/80' : 'text-ink-2'}`}>
            {none ? 'Nadie lo pide ahora' : count === 1 ? '1 centro' : `${count} centros`}
            {urgent > 0 && (
              <>
                {' · '}
                <span className={`font-bold ${on ? 'text-oro' : 'text-ink-danger'}`}>
                  {urgent === 1 ? 'urgente en 1' : `urgente en ${urgent}`}
                </span>
              </>
            )}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="grid gap-3">
      <div
        role="group"
        aria-label="Artículos para donar"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
      >
        {tile(ANY_ITEM, 'Cualquier artículo', null, 0)}
        {tiles.map((t, i) =>
          tile(t.key, t.label, t.count, t.urgent, i >= COMPACT && !expanded ? 'hidden lg:flex' : ''),
        )}
      </div>
      {hiddenCount > 0 && (
        <div className="lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Ver menos artículos' : `Ver los ${tiles.length} artículos`}
          </Button>
        </div>
      )}
    </div>
  );
}
