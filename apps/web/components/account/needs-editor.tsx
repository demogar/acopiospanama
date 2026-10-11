'use client';

import { useId, useState } from 'react';
import type { Need, NeedLevel } from '@/lib/account-types';

export type NeedsState = Record<string, { level: NeedLevel | ''; note: string }>;

export function needsToState(items: Record<string, string>, needs: Need[]): NeedsState {
  const s: NeedsState = {};
  for (const k of Object.keys(items)) s[k] = { level: '', note: '' };
  for (const n of needs) s[n.item] = { level: n.level, note: n.note };
  return s;
}

/** Lista completa para la API: solo artículos con estado indicado, en el orden del catálogo. */
export function stateToNeeds(items: Record<string, string>, s: NeedsState): Need[] {
  return Object.keys(items)
    .filter((k) => s[k]?.level)
    .map((k) => ({ item: k, level: s[k].level as NeedLevel, note: s[k].note.trim() }));
}

/** Traduce errores `needs.<i>.note` de la API a la clave del artículo enviado en esa posición. */
export function needErrors(fields: Record<string, string>, sent: Need[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, msg] of Object.entries(fields)) {
    const m = /^needs\.(\d+)/.exec(k);
    if (m && sent[Number(m[1])]) out[sent[Number(m[1])].item] = msg;
  }
  return out;
}

const OPTIONS: { value: NeedLevel | ''; short: string; full: string; on: string }[] = [
  { value: '', short: 'Sin indicar', full: 'Sin indicar', on: 'bg-cloth-deep text-ink' },
  { value: 'URGENT', short: 'Urgente', full: 'Urgente', on: 'bg-rojo text-on-ink' },
  { value: 'NEEDED', short: 'Aceptan', full: 'Aceptan', on: 'bg-oro text-on-oro' },
  { value: 'ENOUGH', short: 'Ya no', full: 'Ya no aceptan', on: 'bg-verde text-on-ink' },
];

/**
 * Un control de 4 estados por artículo, pensado para tocar rápido con el pulgar: 4 botones de radio
 * en una fila que cabe en 375 px, con una nota opcional que solo aparece al indicar un estado.
 */
export function NeedsEditor({
  items,
  value,
  onChange,
  errors = {},
}: {
  items: Record<string, string>;
  value: NeedsState;
  onChange: (next: NeedsState) => void;
  /** Errores por artículo (clave del catálogo); ver `needErrors`. */
  errors?: Record<string, string>;
}) {
  return (
    <ul className="divide-y divide-keyline-soft border-y border-keyline-soft">
      {Object.entries(items).map(([key, label]) => (
        <NeedRow
          key={key}
          itemKey={key}
          label={label}
          state={value[key] ?? { level: '', note: '' }}
          error={errors[key]}
          onChange={(st) => onChange({ ...value, [key]: st })}
        />
      ))}
    </ul>
  );
}

function NeedRow({
  itemKey,
  label,
  state,
  error,
  onChange,
}: {
  itemKey: string;
  label: string;
  state: { level: NeedLevel | ''; note: string };
  error?: string;
  onChange: (s: { level: NeedLevel | ''; note: string }) => void;
}) {
  const id = useId();
  const [noteOpen, setNoteOpen] = useState(!!state.note);
  const showNote = state.level !== '' && (noteOpen || !!state.note);
  return (
    <li className="py-3">
      <fieldset>
        <legend className="mb-2 font-semibold text-ink">{label}</legend>
        <div className="grid grid-cols-4 gap-1">
          {OPTIONS.map((o) => {
            const checked = state.level === o.value;
            return (
              <label
                key={o.value || 'none'}
                className={`relative flex min-h-11 cursor-pointer items-center justify-center px-1 text-center text-sm leading-tight shadow-cut has-[:focus-visible]:shadow-[var(--focus-ring)] ${
                  checked ? `${o.on} font-semibold` : 'bg-cloth-pale text-ink-2 hover:bg-cloth-shade'
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-${itemKey}`}
                  value={o.value}
                  checked={checked}
                  onChange={() => onChange({ ...state, level: o.value })}
                  className="sr-only"
                />
                {o.short === o.full ? (
                  o.short
                ) : (
                  <>
                    <span aria-hidden="true">{o.short}</span>
                    <span className="sr-only">{o.full}</span>
                  </>
                )}
              </label>
            );
          })}
        </div>
        {state.level !== '' && !showNote && (
          <button
            type="button"
            className="mt-1 inline-flex min-h-11 items-center text-sm text-ink-2 underline"
            onClick={() => setNoteOpen(true)}
          >
            Añadir nota <span className="sr-only">sobre {label}</span>
          </button>
        )}
        {showNote && (
          <div className="mt-2">
            <label htmlFor={`${id}-note`} className="mb-1 block text-sm text-ink-2">
              Nota sobre {label.toLowerCase()} (opcional)
            </label>
            <input
              id={`${id}-note`}
              value={state.note}
              maxLength={120}
              placeholder="Ej.: solo tallas de niño, sin vidrio"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-err` : undefined}
              onChange={(e) => onChange({ ...state, note: e.target.value })}
              className="h-11 w-full min-w-0 bg-cloth-pale px-3 text-base text-ink shadow-cut placeholder:text-ink-muted focus:shadow-[var(--focus-ring)] focus:outline-none aria-invalid:band-rojo aria-invalid:cut-band"
            />
            {error && (
              <p id={`${id}-err`} className="mt-1 text-sm text-ink-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </fieldset>
    </li>
  );
}
