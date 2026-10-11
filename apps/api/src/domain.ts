/**
 * Catálogos del dominio. Las provincias y comarcas son la lista cerrada; los distritos son
 * sugerencias (el campo es texto libre) para no bloquear a nadie por una división reciente.
 */
export const PROVINCES = {
  BOCAS_DEL_TORO: 'Bocas del Toro',
  COCLE: 'Coclé',
  COLON: 'Colón',
  CHIRIQUI: 'Chiriquí',
  DARIEN: 'Darién',
  HERRERA: 'Herrera',
  LOS_SANTOS: 'Los Santos',
  PANAMA: 'Panamá',
  PANAMA_OESTE: 'Panamá Oeste',
  VERAGUAS: 'Veraguas',
  GUNA_YALA: 'Comarca Guna Yala',
  EMBERA_WOUNAAN: 'Comarca Emberá-Wounaan',
  NGABE_BUGLE: 'Comarca Ngäbe-Buglé',
  NASO_TJER_DI: 'Comarca Naso Tjër Di',
} as const;
export type Province = keyof typeof PROVINCES;
export const PROVINCE_KEYS = Object.keys(PROVINCES) as [Province, ...Province[]];

export const DISTRICTS: Record<Province, string[]> = {
  BOCAS_DEL_TORO: ['Almirante', 'Bocas del Toro', 'Changuinola', 'Chiriquí Grande'],
  COCLE: ['Aguadulce', 'Antón', 'La Pintada', 'Natá', 'Olá', 'Penonomé'],
  COLON: ['Colón', 'Chagres', 'Donoso', 'Omar Torrijos Herrera', 'Portobelo', 'Santa Isabel'],
  CHIRIQUI: [
    'Alanje',
    'Barú',
    'Boquerón',
    'Boquete',
    'Bugaba',
    'David',
    'Dolega',
    'Gualaca',
    'Remedios',
    'Renacimiento',
    'San Félix',
    'San Lorenzo',
    'Tierras Altas',
    'Tolé',
  ],
  DARIEN: ['Chepigana', 'Pinogana', 'Santa Fe'],
  HERRERA: ['Chitré', 'Las Minas', 'Los Pozos', 'Ocú', 'Parita', 'Pesé', 'Santa María'],
  LOS_SANTOS: ['Guararé', 'Las Tablas', 'Los Santos', 'Macaracas', 'Pedasí', 'Pocrí', 'Tonosí'],
  PANAMA: ['Balboa', 'Chepo', 'Chimán', 'Panamá', 'San Miguelito', 'Taboga'],
  PANAMA_OESTE: ['Arraiján', 'Capira', 'Chame', 'La Chorrera', 'San Carlos'],
  VERAGUAS: [
    'Atalaya',
    'Calobre',
    'Cañazas',
    'La Mesa',
    'Las Palmas',
    'Mariato',
    'Montijo',
    'Río de Jesús',
    'San Francisco',
    'Santa Fe',
    'Santiago',
    'Soná',
  ],
  GUNA_YALA: [],
  EMBERA_WOUNAAN: ['Cémaco', 'Sambú'],
  NGABE_BUGLE: [
    'Besikó',
    'Jirondai',
    'Kankintú',
    'Kusapín',
    'Mironó',
    'Müna',
    'Nole Duima',
    'Ñürüm',
    'Santa Catalina o Calovébora',
  ],
  NASO_TJER_DI: [],
};

export const CENTER_TYPES = {
  ACOPIO: 'Centro de acopio (recibe donaciones)',
  DISTRIBUCION: 'Punto de distribución (entrega ayuda a afectados)',
  COMEDOR: 'Comedor o cocina comunitaria',
  ALBERGUE: 'Albergue',
  MIXTO: 'Recibe y distribuye',
} as const;
export type CenterType = keyof typeof CENTER_TYPES;
export const CENTER_TYPE_KEYS = Object.keys(CENTER_TYPES) as [CenterType, ...CenterType[]];

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
export type Schedule = Partial<Record<Day, DaySchedule>>;

/** ¿Abierto ahora? En hora de Panamá (UTC−5, sin horario de verano). null si no hay horario cargado. */
export function openNow(schedule: Schedule, at = new Date()): boolean | null {
  const keys = Object.keys(schedule ?? {});
  if (keys.length === 0) return null;
  const local = new Date(at.getTime() - 5 * 3_600_000);
  const day = DAYS[(local.getUTCDay() + 6) % 7];
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const today = schedule[day];
  if (today && 'allDay' in today) return true;
  if (today && 'open' in today) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    if (c > o ? mins >= o && mins < c : mins >= o || mins < c) return true; // c < o: cruza medianoche
  }
  // Tramo de ayer que cruza la medianoche.
  const prev = schedule[DAYS[(DAYS.indexOf(day) + 6) % 7]];
  if (prev && 'open' in prev && toMin(prev.close) < toMin(prev.open) && mins < toMin(prev.close)) return true;
  return false;
}

export const ITEMS = {
  WATER: 'Agua potable',
  FOOD: 'Alimentos no perecederos',
  HOT_MEALS: 'Comida preparada',
  BABY: 'Pañales y artículos de bebé',
  HYGIENE: 'Higiene personal',
  CLEANING: 'Artículos de limpieza',
  FIRST_AID: 'Botiquín e insumos médicos básicos',
  CLOTHES: 'Ropa',
  BEDDING: 'Colchones, frazadas y sábanas',
  TARPS: 'Lonas, plásticos y toldos',
  TOOLS: 'Herramientas',
  LIGHTS: 'Linternas y baterías',
  PET_FOOD: 'Alimento para mascotas',
  VOLUNTEERS: 'Voluntarios',
} as const;
export type Item = keyof typeof ITEMS;
export const ITEM_KEYS = Object.keys(ITEMS) as [Item, ...Item[]];

export const NEED_LEVELS = ['URGENT', 'NEEDED', 'ENOUGH'] as const;
export type NeedLevel = (typeof NEED_LEVELS)[number];

export const ORGANIZER_TYPES = {
  JUNTA_COMUNAL: 'Junta comunal',
  MUNICIPIO: 'Municipio',
  GOBIERNO: 'Institución del Estado',
  IGLESIA: 'Iglesia',
  ESCUELA: 'Escuela o colegio',
  CRUZ_ROJA: 'Cruz Roja',
  ONG: 'Fundación u ONG',
  EMPRESA: 'Empresa',
  VECINOS: 'Grupo de vecinos',
  OTRO: 'Otro',
} as const;
export type OrganizerType = keyof typeof ORGANIZER_TYPES;
export const ORGANIZER_KEYS = Object.keys(ORGANIZER_TYPES) as [OrganizerType, ...OrganizerType[]];

export const REPORT_REASONS = {
  CLOSED: 'Ya cerró o no está funcionando',
  NOT_RECEIVING: 'Ya no está recibiendo donaciones',
  WRONG_INFO: 'La información está equivocada',
  ASKS_MONEY: 'Pide dinero o transferencias',
  FAKE: 'Parece falso o una estafa',
  OTHER: 'Otro',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const REPORT_KEYS = Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]];

/** A partir de cuántos reportes distintos (en 72 h) un centro queda «en verificación» o se oculta. */
export const FLAG_THRESHOLD = 2;
export const HIDE_THRESHOLD = 3; // solo motivos graves: ASKS_MONEY, FAKE, CLOSED
export const SERIOUS_REASONS: ReportReason[] = ['ASKS_MONEY', 'FAKE', 'CLOSED'];

/** Frescura: sin confirmar en 72 h baja en la lista; en 14 días deja de mostrarse por defecto. */
export const STALE_HOURS = 72;
export const EXPIRE_DAYS = 14;

/**
 * Las fichas no pueden pedir dinero: así se cierra la vía de estafa más común en emergencias.
 * Las donaciones en efectivo deben ir a organizaciones reconocidas, fuera de este directorio.
 */
const MONEY_PATTERNS: RegExp[] = [
  /\byappy\b/i,
  /\bnequi\b/i,
  /\bpaypal\b/i,
  /\bzelle\b/i,
  /\bach\b/i,
  /\btransferenc/i,
  /\bdep[oó]sit/i,
  /\bcuenta\s+(de\s+)?(ahorros?|corriente|bancaria)/i,
  /\bn[uú]mero\s+de\s+cuenta/i,
  /\b(banco\s+general|banistmo|bac\s+credomatic|caja\s+de\s+ahorros|banco\s+nacional|global\s+bank|multibank|credicorp|st\.?\s*georges)\b/i,
  /\bdonaci[oó]n(es)?\s+(en\s+)?(efectivo|monetaria|de\s+dinero)/i,
  /\b\d{10,}\b/, // números largos: cuentas, no teléfonos (en Panamá son de 7–8 dígitos)
  /\b(?:\d[ -]?){13,19}\b/, // tarjetas
];

export function asksForMoney(...texts: string[]): boolean {
  return texts.some((t) => MONEY_PATTERNS.some((re) => re.test(t)));
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
