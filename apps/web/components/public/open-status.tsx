'use client';

import { useSyncExternalStore } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { Badge } from '@demogar/mola-ui';
import { dateWindow, datesLabel, openNow, openStatus, todayText, type OpenStatus } from '@/lib/public-schedule';
import type { PublicCenter } from '@/lib/public-types';

/*
 * Reloj compartido: un solo intervalo de un minuto para todos los componentes que lo usan, y
 * mientras haya alguno montado.
 */
let now: Date | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = new Date();
    timer = setInterval(() => {
      now = new Date();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getNow = () => (now ??= new Date());
const getServerNow = () => null;

/**
 * Hora actual que se actualiza cada minuto. Devuelve `null` en el servidor y en la hidratación
 * (así ambos pintan lo mismo, con el `openNow` de la API) y la hora real después de montar.
 */
export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getNow, getServerNow);
}

type Timed = Pick<PublicCenter, 'schedule' | 'openNow' | 'availableFrom' | 'availableUntil'>;

/** ¿Abierto ahora? Con la hora del navegador si ya la hay; si no, lo que calculó la API. */
export function isOpenNow(c: Timed, now: Date | null): boolean | null {
  return now ? openNow(c.schedule, now, c) : c.openNow;
}

export function statusFor(c: Timed, now: Date | null): OpenStatus {
  if (now) return openStatus(c.schedule, now, c);
  // Fuera de sus fechas no se dice «Cerrado ahora»: lo dice la etiqueta de fechas.
  const w = dateWindow(c);
  if (w === 'BEFORE' || w === 'ENDED') return null;
  if (c.openNow === null) return null;
  return c.openNow ? { state: 'open', label: 'Abierto ahora' } : { state: 'closed', label: 'Cerrado ahora' };
}

export function OpenBadge({ status }: { status: OpenStatus }) {
  if (!status) return null;
  const tone = status.state === 'open' ? 'success' : status.state === 'opens-today' ? 'info' : 'neutral';
  return (
    <Badge tone={tone} variant={status.state === 'open' ? 'solid' : 'soft'} dot={status.state === 'open'}>
      {status.label}
    </Badge>
  );
}

/** «Abre el 14 de oct», «Del 13 al 15 de oct»…: solo en centros temporales. */
export function DatesBadge({ center }: { center: Pick<PublicCenter, 'availableFrom' | 'availableUntil'> }) {
  const now = useNow();
  const label = datesLabel(center, now ?? undefined);
  if (!label) return null;
  const w = dateWindow(center, now ?? undefined);
  return (
    <Badge tone={w === 'BEFORE' ? 'info' : 'warn'} variant="soft">
      <CalendarDays aria-hidden="true" className="size-3.5" />
      <span suppressHydrationWarning>{label}</span>
    </Badge>
  );
}

/** «[Abierto ahora] [Del 13 al 15 de oct] Hoy: 8:00 a. m. – 5:00 p. m.» para tarjetas y ficha. */
export function OpenLine({ center }: { center: Timed }) {
  const now = useNow();
  const status = statusFor(center, now);
  const raw = todayText(center.schedule, now ?? undefined, center);
  const dated = !!datesLabel(center, now ?? undefined);
  // «Hoy: Cerrado» junto a «Cerrado ahora» repite lo mismo; «Hoy: Sin dato» no aporta nada.
  const today =
    !raw || raw.endsWith('Sin dato') || (raw.endsWith('Cerrado') && status?.state === 'closed') ? null : raw;
  if (!status && !today && !dated) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
      <Clock aria-hidden="true" className="size-4 shrink-0 text-ink-2" />
      <OpenBadge status={status} />
      <DatesBadge center={center} />
      {today && <span suppressHydrationWarning>{today}</span>}
    </p>
  );
}

/**
 * Solo el estado («Abierto ahora», «Abre hoy 2:00 p. m.») y, si es temporal, sus fechas, para la
 * tarjeta. Nada si no hay horario ni fechas.
 */
export function OpenStatusBadge({ center }: { center: Timed }) {
  const now = useNow();
  return (
    <>
      <OpenBadge status={statusFor(center, now)} />
      <DatesBadge center={center} />
    </>
  );
}
