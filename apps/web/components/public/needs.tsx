import { Badge } from '@demogar/mola-ui';
import { itemLabel, needsAt } from '@/lib/public-format';
import type { NeedLevel, PublicCenter, PublicMeta } from '@/lib/public-types';

const ROWS: {
  level: NeedLevel;
  label: string;
  tone: 'danger' | 'warn' | 'neutral';
  variant: 'solid' | 'soft' | 'outline';
}[] = [
  { level: 'URGENT', label: 'Urgente', tone: 'danger', variant: 'solid' },
  { level: 'NEEDED', label: 'Necesitan', tone: 'warn', variant: 'soft' },
  { level: 'ENOUGH', label: 'Ya no necesitan', tone: 'neutral', variant: 'outline' },
];

/** Resumen compacto para las tarjetas: una línea por nivel, con la etiqueta en texto (no solo color). */
export function NeedsSummary({
  center,
  meta,
  highlight,
}: {
  center: Pick<PublicCenter, 'needs'>;
  meta: PublicMeta | null;
  highlight?: string | null;
}) {
  const rows = ROWS.map((r) => ({ ...r, needs: needsAt(center, r.level) })).filter((r) => r.needs.length > 0);
  if (rows.length === 0)
    return <p className="text-sm text-ink-2">Sin necesidades publicadas. Pregunta antes de llevar algo.</p>;
  return (
    <dl className="grid gap-1.5 text-sm">
      {rows.map((r) => (
        <div key={r.level} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <dt className="shrink-0">
            <Badge tone={r.tone} variant={r.variant}>
              {r.label}:
            </Badge>
          </dt>
          <dd
            className={
              r.level === 'ENOUGH' ? 'text-ink-2' : r.level === 'URGENT' ? 'font-semibold text-ink' : 'text-ink'
            }
          >
            {r.needs.map((n, i) => (
              <span key={n.item}>
                {i > 0 && ', '}
                {highlight === n.item && r.level !== 'ENOUGH' ? (
                  <mark className="bg-oro-soft px-0.5 text-ink">{itemLabel(meta, n.item)}</mark>
                ) : (
                  itemLabel(meta, n.item)
                )}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Lista completa para la ficha: grupos con encabezado y la nota de cada artículo. */
export function NeedsDetail({ center, meta }: { center: Pick<PublicCenter, 'needs'>; meta: PublicMeta | null }) {
  const groups = [
    { ...ROWS[0], title: 'Urgente', hint: 'Lo que más falta ahora.' },
    { ...ROWS[1], title: 'Necesitan', hint: 'También les sirve.' },
    { ...ROWS[2], title: 'Ya no necesitan', hint: 'Por ahora tienen suficiente: no lo lleves.' },
  ]
    .map((g) => ({ ...g, needs: needsAt(center, g.level) }))
    .filter((g) => g.needs.length > 0);
  if (groups.length === 0) {
    return <p className="text-ink-2">Este centro no ha publicado qué necesita. Pregunta antes de llevar algo.</p>;
  }
  return (
    <div className="grid gap-5">
      {groups.map((g) => (
        <section key={g.level} aria-labelledby={`need-${g.level}`}>
          <h3 id={`need-${g.level}`} className="flex flex-wrap items-center gap-2 font-ui text-base font-bold">
            <Badge tone={g.tone} variant={g.variant}>
              {g.title}
            </Badge>
            <span className="text-sm font-normal text-ink-2">{g.hint}</span>
          </h3>
          <ul className="mt-2 grid gap-1.5">
            {g.needs.map((n) => (
              <li
                key={n.item}
                className={`border-s-4 ps-3 ${g.level === 'URGENT' ? 'border-rojo' : g.level === 'NEEDED' ? 'border-oro' : 'border-keyline'}`}
              >
                <span className={g.level === 'ENOUGH' ? 'text-ink-2' : 'font-semibold'}>{itemLabel(meta, n.item)}</span>
                {n.note && <span className="block text-sm text-ink-2">{n.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
