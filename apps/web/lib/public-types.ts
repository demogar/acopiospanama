/** Tipos de los endpoints públicos (`apps/api/src/centers/public.controller.ts`). */
import type { Schedule } from './public-schedule';

export type CenterType = 'ACOPIO' | 'DISTRIBUCION' | 'COMEDOR' | 'ALBERGUE' | 'MIXTO';

export type NeedLevel = 'URGENT' | 'NEEDED' | 'ENOUGH';
export type Visibility = 'VISIBLE' | 'STALE' | 'EXPIRED' | 'COMMUNITY_HIDDEN' | 'CLOSED' | 'REMOVED';

/** A dónde llega la ayuda: provincia del catálogo y distrito o comunidad (puede ir vacío). */
export interface PublicDestination {
  province: string;
  district: string;
}

export interface PublicNeed {
  item: string;
  level: NeedLevel;
  note: string;
}

export interface PublicCenter {
  id: string;
  slug: string;
  name: string;
  centerType: CenterType | string;
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
  /** Calculado por la API (lista en caché 30 s): recalcular con `openNow` de `public-schedule`. */
  openNow: boolean | null;
  /** Contacto público: cadenas vacías si la persona no dio su consentimiento. */
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
  notes: string;
  destinations: PublicDestination[];
  destinationNote: string;
  needs: PublicNeed[];
  confirmations: number;
  lastActivity: string;
  visibility: Visibility;
  flagged: boolean;
  isNew: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface PublicMeta {
  provinces: Record<string, string>;
  districts: Record<string, string[]>;
  items: Record<string, string>;
  organizerTypes: Record<string, string>;
  /** Puede faltar en versiones viejas de la API: usar `CENTER_TYPES_FALLBACK`. */
  centerTypes?: Record<string, string>;
  reportReasons: Record<string, string>;
  rules: { staleHours: number; expireDays: number };
}
