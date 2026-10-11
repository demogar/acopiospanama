'use client';

import { forwardRef } from 'react';
import { Callout } from '@demogar/mola-ui';
import { DAY_LABELS, type Day } from '@/lib/public-schedule';
import { fieldLabel } from './center-fields';

/** Resumen de errores arriba del formulario: cada error enlaza (y lleva el foco) a su campo. */
export const ErrorSummary = forwardRef<
  HTMLDivElement,
  {
    message?: string | null;
    fields: Record<string, string>;
    onPick: (name: string) => void;
    title?: string;
    tone?: 'danger' | 'warn';
  }
>(function ErrorSummary({ message, fields, onPick, title = 'Revisa estos datos', tone = 'danger' }, ref) {
  const entries = Object.entries(fields).filter(([k]) => k !== 'lng' || !fields.lat);
  if (!message && entries.length === 0) return null;
  return (
    <div ref={ref} tabIndex={-1} className="focus:outline-none" role="alert">
      <Callout tone={tone} title={title}>
        {message && <p>{message}</p>}
        {entries.length > 0 && (
          <ul className="mt-2 list-disc space-y-3 ps-5">
            {entries.map(([k, msg]) => (
              <li key={k}>
                <a
                  href={`#${k}`}
                  className="py-2 underline"
                  onClick={(e) => {
                    e.preventDefault();
                    onPick(k);
                  }}
                >
                  {labelFor(k)}: {msg}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Callout>
    </div>
  );
});

function labelFor(k: string) {
  const d = k.split('.')[1] as Day | undefined;
  if (k.startsWith('schedule.') && d && DAY_LABELS[d]) return `Horario (${DAY_LABELS[d].toLowerCase()})`;
  return fieldLabel(k);
}
