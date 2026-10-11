'use client';

import { useId } from 'react';
import { Button, Text } from '@demogar/mola-ui';
import { DAY_LABELS, DAYS, type Day, type DaySchedule, dayText, type Schedule } from '@/lib/public-schedule';

type Mode = 'closed' | 'allDay' | 'hours';
const WEEKDAYS: Day[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const DEFAULT_HOURS = { open: '08:00', close: '17:00' };

function modeOf(d: DaySchedule | undefined): Mode {
  if (!d) return 'closed';
  return 'allDay' in d ? 'allDay' : 'hours';
}

/** Horario propuesto al empezar: lunes a sábado 8:00–5:00, domingo cerrado (se ajusta en un toque). */
export function starterSchedule(): Schedule {
  return {
    MON: { ...DEFAULT_HOURS },
    TUE: { ...DEFAULT_HOURS },
    WED: { ...DEFAULT_HOURS },
    THU: { ...DEFAULT_HOURS },
    FRI: { ...DEFAULT_HOURS },
    SAT: { ...DEFAULT_HOURS },
    SUN: null,
  };
}

/** Errores locales (la API valida igual): horas vacías o iguales. Clave: día. */
export function scheduleErrors(s: Schedule): Partial<Record<Day, string>> {
  const out: Partial<Record<Day, string>> = {};
  for (const d of DAYS) {
    const v = s[d];
    if (v && 'open' in v) {
      if (!/^\d\d:\d\d$/.test(v.open) || !/^\d\d:\d\d$/.test(v.close))
        out[d] = 'Escribe la hora de apertura y de cierre';
      else if (v.open === v.close) out[d] = 'La apertura y el cierre no pueden ser iguales';
    }
  }
  return out;
}

/** Resumen agrupando días seguidos iguales: «Lunes a viernes: 8:00 a. m. – 5:00 p. m.». */
export function scheduleSummary(s: Schedule): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < DAYS.length) {
    const t = dayText(s[DAYS[i]]);
    let j = i;
    while (j + 1 < DAYS.length && dayText(s[DAYS[j + 1]]) === t) j++;
    const label = i === j ? DAY_LABELS[DAYS[i]] : `${DAY_LABELS[DAYS[i]]} a ${DAY_LABELS[DAYS[j]].toLowerCase()}`;
    lines.push(`${label}: ${t}`);
    i = j + 1;
  }
  return lines;
}

const OPTIONS: { value: Mode; label: string }[] = [
  { value: 'closed', label: 'Cerrado' },
  { value: 'allDay', label: '24 horas' },
  { value: 'hours', label: 'Horario' },
];

/**
 * Horario por día para el teléfono: tres opciones por día y, en «Horario», dos campos de hora.
 * Clave ausente = sin dato; `null` = cerrado. Si no se conoce el horario, se puede dejar vacío.
 */
export function ScheduleEditor({
  value,
  onChange,
  errors = {},
  apiError,
}: {
  value: Schedule;
  onChange: (s: Schedule) => void;
  errors?: Partial<Record<Day, string>>;
  apiError?: string;
}) {
  const id = useId();
  const has = Object.keys(value).length > 0;

  if (!has) {
    return (
      <div className="flex flex-col gap-2">
        <Text size="sm" tone={2}>
          Sin horario: la ficha no dirá si está abierto ahora.
        </Text>
        <Button type="button" variant="secondary" onClick={() => onChange(starterSchedule())}>
          Añadir horario
        </Button>
        {apiError && <p className="text-sm text-ink-danger">{apiError}</p>}
      </div>
    );
  }

  const setDay = (d: Day, v: DaySchedule) => onChange({ ...value, [d]: v });
  const mon = value.MON;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={mon === undefined}
          onClick={() =>
            onChange({
              ...value,
              ...Object.fromEntries(WEEKDAYS.map((d) => [d, mon && 'open' in mon ? { ...mon } : (mon ?? null)])),
            })
          }
        >
          Copiar lunes a días hábiles
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={mon === undefined}
          onClick={() =>
            onChange(
              Object.fromEntries(DAYS.map((d) => [d, mon && 'open' in mon ? { ...mon } : (mon ?? null)])) as Schedule,
            )
          }
        >
          Mismo horario todos los días
        </Button>
      </div>
      <ul className="divide-y divide-keyline-soft border-y border-keyline-soft">
        {DAYS.map((d) => {
          const v = value[d];
          const mode = modeOf(v);
          const err = errors[d];
          return (
            <li key={d} className="py-3">
              <fieldset>
                <legend className="mb-2 font-semibold text-ink">{DAY_LABELS[d]}</legend>
                <div className="grid grid-cols-3 gap-1">
                  {OPTIONS.map((o) => {
                    const checked = mode === o.value;
                    return (
                      <label
                        key={o.value}
                        className={`relative flex min-h-11 cursor-pointer items-center justify-center px-1 text-center text-sm leading-tight shadow-cut has-[:focus-visible]:shadow-[var(--focus-ring)] ${
                          checked
                            ? 'bg-ink font-semibold text-on-ink forced-selected'
                            : 'bg-cloth-pale text-ink-2 hover:bg-cloth-shade'
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`${id}-${d}`}
                          checked={checked}
                          onChange={() =>
                            setDay(
                              d,
                              o.value === 'closed'
                                ? null
                                : o.value === 'allDay'
                                  ? { allDay: true }
                                  : v && 'open' in v
                                    ? v
                                    : { ...DEFAULT_HOURS },
                            )
                          }
                        />
                        {o.label}
                      </label>
                    );
                  })}
                </div>
                {v && 'open' in v && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-sm text-ink-2">
                      Abre
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[d]}: abre`}
                        value={v.open}
                        aria-invalid={err ? true : undefined}
                        onChange={(e) => setDay(d, { ...v, open: e.target.value })}
                        className="h-11 w-full min-w-0 bg-cloth-pale px-2 text-base text-ink shadow-cut focus:shadow-[var(--focus-ring)] focus:outline-none aria-invalid:band-rojo aria-invalid:cut-band"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-ink-2">
                      Cierra
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[d]}: cierra`}
                        value={v.close}
                        aria-invalid={err ? true : undefined}
                        onChange={(e) => setDay(d, { ...v, close: e.target.value })}
                        className="h-11 w-full min-w-0 bg-cloth-pale px-2 text-base text-ink shadow-cut focus:shadow-[var(--focus-ring)] focus:outline-none aria-invalid:band-rojo aria-invalid:cut-band"
                      />
                    </label>
                    {v.close < v.open && !err && (
                      <p className="col-span-2 text-sm text-ink-2">Cierra al día siguiente.</p>
                    )}
                  </div>
                )}
                {err && <p className="mt-1 text-sm text-ink-danger">{err}</p>}
              </fieldset>
            </li>
          );
        })}
      </ul>
      <div className="bg-cloth-shade p-3" aria-live="polite">
        <p className="mb-1 text-sm font-semibold text-ink">Así se verá</p>
        <ul className="text-sm text-ink">
          {scheduleSummary(value).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      {apiError && <p className="text-sm text-ink-danger">{apiError}</p>}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}>
        Quitar horario (no lo conozco)
      </Button>
    </div>
  );
}
