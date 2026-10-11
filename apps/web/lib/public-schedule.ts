/**
 * Horario de los centros y «abierto ahora», con la misma lógica que `openNow` de
 * `apps/api/src/domain.ts` (hora de Panamá, UTC−5 sin horario de verano). Se recalcula en el
 * navegador porque la lista pública viene en caché hasta 30 s. Sin dependencias: sirve en servidor y cliente.
 */

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABELS: Record<Day, string> = {
  MON: 'Lunes',
  TUE: 'Martes',
  WED: 'Miércoles',
  THU: 'Jueves',
  FRI: 'Viernes',
  SAT: 'Sábado',
  SUN: 'Domingo',
};

export type DaySchedule = { allDay: true } | { open: string; close: string } | null;
/** Clave ausente = sin dato; `null` = cerrado ese día. */
export type Schedule = Partial<Record<Day, DaySchedule>>;

/** Referencia por si `meta.centerTypes` no llega (misma lista que `CENTER_TYPES` de la API). */
export const CENTER_TYPES_FALLBACK: Record<string, string> = {
  ACOPIO: 'Centro de acopio (recibe donaciones)',
  DISTRIBUCION: 'Punto de distribución (entrega ayuda a afectados)',
  COMEDOR: 'Comedor o cocina comunitaria',
  ALBERGUE: 'Albergue',
  MIXTO: 'Recibe y distribuye',
};

/** Etiqueta corta para insignias: «Centro de acopio (recibe donaciones)» → «Centro de acopio». */
export function shortTypeLabel(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, '');
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Día (MON…SUN) y minutos desde medianoche en Panamá. */
export function panamaNow(at: Date = new Date()): { day: Day; mins: number } {
  const local = new Date(at.getTime() - 5 * 3_600_000);
  return { day: DAYS[(local.getUTCDay() + 6) % 7], mins: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

export function hasSchedule(schedule: Schedule | null | undefined): schedule is Schedule {
  return !!schedule && Object.keys(schedule).length > 0;
}

/** ¿Abierto ahora? `null` si no hay horario cargado. */
export function openNow(schedule: Schedule | null | undefined, at: Date = new Date()): boolean | null {
  if (!hasSchedule(schedule)) return null;
  const { day, mins } = panamaNow(at);
  const today = schedule[day];
  if (today && 'allDay' in today) return true;
  if (today && 'open' in today) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    if (c > o ? mins >= o && mins < c : mins >= o || mins < c) return true; // c < o: cruza medianoche
  }
  const prev = schedule[DAYS[(DAYS.indexOf(day) + 6) % 7]];
  if (prev && 'open' in prev && toMin(prev.close) < toMin(prev.open) && mins < toMin(prev.close)) return true;
  return false;
}

/** «08:00» → «8:00 a. m.», «17:30» → «5:30 p. m.», «00:00» → «12:00 a. m.». */
export function formatTime(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  const m = hhmm.slice(3, 5);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Texto de un día: «8:00 a. m. – 5:00 p. m.», «24 horas», «Cerrado» o «Sin dato». */
export function dayText(ds: DaySchedule | undefined): string {
  if (ds === undefined) return 'Sin dato';
  if (ds === null) return 'Cerrado';
  if ('allDay' in ds) return '24 horas';
  return `${formatTime(ds.open)} – ${formatTime(ds.close)}`;
}

export function todayKey(at: Date = new Date()): Day {
  return panamaNow(at).day;
}

export type OpenStatus = { state: 'open' | 'closed' | 'opens-today'; label: string } | null;

/** «Abierto ahora», «Abre hoy 8:00 a. m.» o «Cerrado ahora». `null` sin horario. */
export function openStatus(schedule: Schedule | null | undefined, at: Date = new Date()): OpenStatus {
  const open = openNow(schedule, at);
  if (open === null) return null;
  if (open) return { state: 'open', label: 'Abierto ahora' };
  const { day, mins } = panamaNow(at);
  const today = schedule?.[day];
  if (today && 'open' in today && toMin(today.open) > mins)
    return { state: 'opens-today', label: `Abre hoy ${formatTime(today.open)}` };
  return { state: 'closed', label: 'Cerrado ahora' };
}

/** «Hoy: 8:00 a. m. – 5:00 p. m.» o `null` si no hay horario. */
export function todayText(schedule: Schedule | null | undefined, at: Date = new Date()): string | null {
  if (!hasSchedule(schedule)) return null;
  return `Hoy: ${dayText(schedule[todayKey(at)])}`;
}

/** Enlace de WhatsApp a un número: solo dígitos, con 507 delante si son 7–8 dígitos. */
export function whatsappLink(phone: string, text?: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 7 || digits.length === 8) digits = `507${digits}`;
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Enlace `tel:` (conserva el «+» inicial). */
export function telLink(phone: string): string {
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${phone.replace(/\D/g, '')}`;
}
