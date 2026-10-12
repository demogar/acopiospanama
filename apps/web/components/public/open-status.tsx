'use client';

import { useSyncExternalStore } from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '@demogar/mola-ui';
import { openNow, openStatus, todayText, type OpenStatus } from '@/lib/public-schedule';
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

/** ¿Abierto ahora? Con la hora del navegador si ya la hay; si no, lo que calculó la API. */
export function isOpenNow(c: Pick<PublicCenter, 'schedule' | 'openNow'>, now: Date | null): boolean | null {
  return now ? openNow(c.schedule, now) : c.openNow;
}

export function statusFor(c: Pick<PublicCenter, 'schedule' | 'openNow'>, now: Date | null): OpenStatus {
  if (now) return openStatus(c.schedule, now);
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

/** «[Abierto ahora] Hoy: 8:00 a. m. – 5:00 p. m.» para tarjetas y ficha. */
export function OpenLine({ center }: { center: Pick<PublicCenter, 'schedule' | 'openNow'> }) {
  const now = useNow();
  const status = statusFor(center, now);
  const raw = todayText(center.schedule, now ?? undefined);
  // «Hoy: Cerrado» junto a «Cerrado ahora» repite lo mismo; «Hoy: Sin dato» no aporta nada.
  const today =
    !raw || raw.endsWith('Sin dato') || (raw.endsWith('Cerrado') && status?.state === 'closed') ? null : raw;
  if (!status && !today) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
      <Clock aria-hidden="true" className="size-4 shrink-0 text-ink-2" />
      <OpenBadge status={status} />
      {today && <span suppressHydrationWarning>{today}</span>}
    </p>
  );
}
