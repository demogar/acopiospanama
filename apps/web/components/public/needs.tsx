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

/** Cuántos artículos caben como etiquetas en la tarjeta antes de resumir el resto con «+N». */
const MAX_CHIPS = 6;

/**
 * Lo que necesitan, en la tarjeta: una etiqueta por artículo, para escanear sin leer. Lo urgente en rojo y
 * primero; lo demás en neutro. Lo que ya no necesitan no sale aquí (se leería como «piden esto»): va en la ficha.
 */
export function NeedsSummary({
  center,
  meta,
  highlight,
}: {
  center: Pick<PublicCenter, 'needs'>;
  meta: PublicMeta | null;
  highlight?: string | null;
}) {
  const urgent = needsAt(center, 'URGENT');
  const needed = needsAt(center, 'NEEDED');
  if (urgent.length + needed.length === 0)
    return <p className="text-sm text-ink-2">Sin necesidades publicadas. Pregunta antes de llevar algo.</p>;
  // Con un artículo filtrado, ese va primero para que no quede escondido en «+N».
  const all = [...urgent, ...needed].sort((a, b) => Number(b.item === highlight) - Number(a.item === highlight));
  const shown = all.slice(0, MAX_CHIPS);
  const rest = urgent.length + needed.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Qué necesitan">
      {shown.map((n) => {
        const isUrgent = n.level === 'URGENT';
        const hl = highlight === n.item;
        return (
          <li
            key={n.item}
            className={`inline-flex items-center gap-1.5 px-2 py-1 text-sm leading-tight ${
              isUrgent ? 'bg-rojo-soft font-semibold text-ink-danger' : 'bg-cloth-shade text-ink'
            } ${hl ? 'outline-2 outline-oro' : ''}`}
          >
            {isUrgent && <span aria-hidden="true" className="size-2 shrink-0 bg-rojo" />}
            {isUrgent && <span className="sr-only">Urgente: </span>}
            {itemLabel(meta, n.item)}
          </li>
        );
      })}
      {rest > 0 && (
        <li className="inline-flex items-center px-1 py-1 text-sm text-ink-2">
          +{rest}
          <span className="sr-only">{rest === 1 ? ' artículo más' : ' artículos más'}</span>
        </li>
      )}
    </ul>
  );
}

/** Lista completa para la ficha: grupos con encabezado y la nota de cada artículo. */
export function NeedsDetail({ center, meta }: { center: Pick<PublicCenter, 'needs'>; meta: PublicMeta | null }) {
  const groups = [
    { ...ROWS[0], title: 'Urgente', hint: '' },
    { ...ROWS[1], title: 'Necesitan', hint: '' },
    { ...ROWS[2], title: 'Ya no necesitan', hint: 'Por ahora tienen suficiente: no lo lleves.' },
  ]
    .map((g) => ({ ...g, needs: needsAt(center, g.level) }))
    .filter((g) => g.needs.length > 0);
  if (groups.length === 0) {
    return <p className="text-ink-2">Este centro no ha publicado qué necesita. Pregunta antes de llevar algo.</p>;
  }
  return (
    <div className="grid gap-6">
      {groups.map((g) => (
        <section key={g.level} aria-labelledby={`need-${g.level}`}>
          <h3 id={`need-${g.level}`} className="flex flex-wrap items-center gap-2 font-ui text-base font-bold">
            <Badge tone={g.tone} variant={g.variant}>
              {g.title}
            </Badge>
            {g.hint && <span className="text-sm font-normal text-ink-2">{g.hint}</span>}
          </h3>
          <ul className="mt-3 grid gap-2">
            {g.needs.map((n) => (
              <li
                key={n.item}
                className={`border-s-4 ps-3 leading-relaxed ${g.level === 'URGENT' ? 'border-rojo' : g.level === 'NEEDED' ? 'border-oro' : 'border-keyline'}`}
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
