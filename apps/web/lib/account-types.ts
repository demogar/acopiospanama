/** Tipos y textos de las pantallas con sesión (responsables y moderación). */
import { CENTER_TYPES_FALLBACK, type Schedule } from './public-schedule';

export type { Schedule };

export type Visibility = 'VISIBLE' | 'COMMUNITY_HIDDEN' | 'CLOSED' | 'REMOVED';
export type NeedLevel = 'URGENT' | 'NEEDED' | 'ENOUGH';
export type ReportReason =
  'CLOSED' | 'NOT_RECEIVING' | 'WRONG_INFO' | 'ASKS_MONEY' | 'FAKE' | 'DIVERTED' | 'MY_DATA' | 'OTHER';

export interface Meta {
  provinces: Record<string, string>;
  districts: Record<string, string[]>;
  items: Record<string, string>;
  organizerTypes: Record<string, string>;
  /** Puede faltar en versiones antiguas de la API: usar `centerTypes(meta)`. */
  centerTypes?: Record<string, string>;
  reportReasons: Record<ReportReason, string>;
}

export interface Need {
  item: string;
  level: NeedLevel;
  note: string;
}

export interface Center {
  id: string;
  slug: string;
  name: string;
  centerType: string;
  organizerType: string;
  organizerName: string;
  province: string;
  district: string;
  community: string;
  address: string;
  lat: number | null;
  lng: number | null;
  schedule: Schedule;
  hoursNote: string;
  openNow: boolean | null;
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
  notes: string;
  needs: Need[];
  confirmations: number;
  lastActivity: string;
  visibility: Visibility;
  flagged: boolean;
  isNew: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface MyCenter extends Center {
  reportReasons: Partial<Record<ReportReason, number>>;
}

/** `GET /api/centers/:id` (solo responsables): incluye estado y contacto aunque no esté publicado. */
export interface ManagedCenter extends MyCenter {
  status: 'PUBLISHED' | 'CLOSED' | 'REMOVED';
  contactConsent: boolean;
}

export interface Invitation {
  id: string;
  name: string;
  slug: string;
  province: string;
  community: string;
  createdAt: string;
}

export interface Me {
  user: { id: string; email: string; name: string; isModerator: boolean; isAdmin: boolean };
  centers: MyCenter[];
  invitations?: Invitation[];
}

export interface SessionInfo {
  user: { id: string; email: string; name: string };
  isStaff: boolean;
  mfaEnrolled: boolean;
  mfaVerified: boolean;
}

export interface Manager {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  acceptedAt: string | null;
  /** Invitación enviada y aún no aceptada: no da acceso. */
  pending: boolean;
  you: boolean;
}

export interface ModReport {
  id: string;
  centerId: string;
  reason: ReportReason;
  details: string;
  createdAt: string;
}

export interface ModCenter extends Center {
  status: 'PUBLISHED' | 'CLOSED' | 'REMOVED';
  removedReason: string;
  reports: ModReport[];
}

export interface Moderator {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  totpEnabledAt: string | null;
}

/** Datos editables de la ficha (lo que acepta `centerInputSchema`). */
export interface CenterInput {
  name: string;
  centerType: string;
  organizerType: string;
  organizerName: string;
  province: string;
  district: string;
  community: string;
  address: string;
  lat: number | null;
  lng: number | null;
  schedule: Schedule;
  hoursNote: string;
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
  contactConsent: boolean;
  notes: string;
}

export const emptyInput: CenterInput = {
  name: '',
  centerType: '',
  organizerType: '',
  organizerName: '',
  province: '',
  district: '',
  community: '',
  address: '',
  lat: null,
  lng: null,
  schedule: {},
  hoursNote: '',
  contactName: '',
  contactPhone: '',
  contactWhatsapp: '',
  contactConsent: false,
  notes: '',
};

export function inputFromCenter(c: ManagedCenter): CenterInput {
  return {
    name: c.name,
    centerType: c.centerType,
    organizerType: c.organizerType,
    organizerName: c.organizerName,
    province: c.province,
    district: c.district,
    community: c.community,
    address: c.address,
    lat: c.lat,
    lng: c.lng,
    schedule: c.schedule ?? {},
    hoursNote: c.hoursNote,
    contactName: c.contactName,
    contactPhone: c.contactPhone,
    contactWhatsapp: c.contactWhatsapp,
    contactConsent: c.contactConsent,
    notes: c.notes,
  };
}

/** Tipos de centro: de `meta.centerTypes` o, si la API no los envía, la copia local. */
export function centerTypes(meta: Meta | null | undefined): Record<string, string> {
  return meta?.centerTypes && Object.keys(meta.centerTypes).length ? meta.centerTypes : CENTER_TYPES_FALLBACK;
}

/** Estado del centro contado a su responsable: qué significa y qué hacer. */
export const VISIBILITY_INFO: Record<
  Visibility,
  { label: string; tone: 'success' | 'warn' | 'danger' | 'neutral'; help: string }
> = {
  VISIBLE: { label: 'Publicado', tone: 'success', help: 'Aparece en el directorio.' },
  COMMUNITY_HIDDEN: {
    label: 'Oculto por reportes',
    tone: 'danger',
    help: 'Varias personas lo reportaron y se ocultó mientras tanto. Si sigue funcionando, toca «Sigue funcionando»: vuelve a mostrarse con un aviso de que hay reportes.',
  },
  CLOSED: {
    label: 'Cerrado',
    tone: 'neutral',
    help: 'Lo marcaste como cerrado: no aparece. Puedes reabrirlo cuando quieras.',
  },
  REMOVED: { label: 'Retirado', tone: 'danger', help: 'Moderación lo retiró del directorio.' },
};

/** Motivos de reporte dichos sin culpar a nadie, para el responsable del centro. */
export const REPORT_FOR_OWNER: Record<ReportReason, { text: string; fix: string }> = {
  CLOSED: {
    text: 'ya cerró o no está funcionando',
    fix: 'Si sigue abierto, toca «Sigue funcionando». Si ya cerró, ciérralo aquí.',
  },
  NOT_RECEIVING: {
    text: 'ya no están recibiendo donaciones',
    fix: 'Actualiza las necesidades: con eso se resuelve este aviso.',
  },
  WRONG_INFO: {
    text: 'hay datos por corregir (dirección, horario…)',
    fix: 'Revisa y guarda la ficha: con eso se resuelve este aviso.',
  },
  ASKS_MONEY: {
    text: 'la ficha parece pedir dinero',
    fix: 'Quita cualquier mención de dinero, cuentas o transferencias. Aquí solo se piden artículos.',
  },
  FAKE: {
    text: 'no pudieron comprobar que el centro exista',
    fix: 'Añade una referencia clara, el horario y quién lo organiza para que la gente lo encuentre.',
  },
  DIVERTED: {
    text: 'dudan de que las donaciones lleguen a las personas afectadas',
    fix: 'Explica en las notas quién recibe la ayuda y cómo se entrega. Cuanto más claro, menos dudas.',
  },
  MY_DATA: {
    text: 'se publicaron sus datos sin permiso',
    fix: 'El contacto se ocultó. Vuelve a publicarlo solo con el consentimiento de esa persona (pestaña Datos).',
  },
  OTHER: { text: 'hay algo por revisar', fix: 'Revisa que la ficha esté al día y guárdala.' },
};

export const NEED_LABELS: Record<NeedLevel, string> = { URGENT: 'Urgente', NEEDED: 'Aceptan', ENOUGH: 'Ya no aceptan' };

export function timeAgo(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-PA', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Panama',
  }).format(new Date(iso));
}
