'use client';

import { DAY_LABELS, DAYS, dayText, hasSchedule, todayKey, type Schedule } from '@/lib/public-schedule';
import { useNow } from './open-status';

/** Horario de los 7 días, con hoy resaltado (en texto, no solo color). */
export function ScheduleTable({ schedule }: { schedule: Schedule }) {
  const now = useNow();
  if (!hasSchedule(schedule))
    return <p className="text-ink-2">Este centro no publicó su horario. Pregunta antes de ir.</p>;
  const today = now ? todayKey(now) : todayKey();
  return (
    <table className="w-full max-w-md border-collapse text-sm">
      <caption className="sr-only">Horario por día (hora de Panamá)</caption>
      <tbody>
        {DAYS.map((d) => {
          const isToday = d === today;
          const text = dayText(schedule[d]);
          return (
            <tr
              key={d}
              className={`border-b border-keyline-soft ${isToday ? 'bg-oro-soft font-semibold' : ''}`}
              aria-current={isToday ? 'date' : undefined}
            >
              <th scope="row" className="py-2 ps-2 pe-4 text-start font-semibold" suppressHydrationWarning>
                {DAY_LABELS[d]}
                {isToday && <span className="ms-1 text-xs font-normal text-ink-2">(hoy)</span>}
              </th>
              <td className={`py-2 pe-2 ${text === 'Cerrado' || text === 'Sin dato' ? 'text-ink-2' : ''}`}>{text}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
