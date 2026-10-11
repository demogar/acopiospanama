import type { Metadata } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from './site';
import { hasCoords, placeLine, provinceLabel } from './public-format';
import type { Day } from './public-schedule';
import type { PublicCenter, PublicMeta } from './public-types';

/**
 * Metadatos completos de una página: título, descripción, canónica, Open Graph y Twitter.
 * Next fusiona los objetos anidados (`openGraph`, `robots`) reemplazándolos por segmento, así que cada
 * página los declara enteros en vez de confiar en la herencia del layout raíz.
 *
 *   export const metadata = pageMeta({ title: 'Privacidad', description: '…', path: '/privacidad' });
 */
export function pageMeta(o: {
  /** Título de la pestaña; el layout raíz añade « · Acopio Panamá». */
  title?: string;
  /** Título completo, sin plantilla (portada). */
  absoluteTitle?: string;
  /** Título para la tarjeta al compartir; por defecto, el de la pestaña con el nombre del sitio. */
  ogTitle?: string;
  description?: string;
  /** Ruta canónica (relativa a `metadataBase`). Sin ella no se declara canónica ni `og:url`. */
  path?: string;
  /** Pantallas privadas o de un solo uso: fuera de los buscadores. */
  noindex?: boolean;
}): Metadata {
  const description = o.description ?? SITE_DESCRIPTION;
  const tabTitle = o.absoluteTitle ?? (o.title ? `${o.title} · ${SITE_NAME}` : SITE_TITLE);
  const ogTitle = o.ogTitle ?? tabTitle;
  const meta: Metadata = {
    title: o.absoluteTitle ? { absolute: o.absoluteTitle } : (o.title ?? { absolute: SITE_TITLE }),
    description,
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'es_PA',
      title: ogTitle,
      description,
      ...(o.path ? { url: o.path } : {}),
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description },
  };
  if (o.path) meta.alternates = { canonical: o.path };
  if (o.noindex) meta.robots = { index: false, follow: false };
  return meta;
}

/** Plural de cada tipo de centro para títulos («Albergues en Chiriquí»). */
export const CENTER_TYPE_PLURAL: Record<string, string> = {
  ACOPIO: 'Centros de acopio',
  DISTRIBUCION: 'Puntos de distribución',
  COMEDOR: 'Comedores comunitarios',
  ALBERGUE: 'Albergues',
  MIXTO: 'Centros que reciben y distribuyen',
};

const DAY_NAMES: Record<Day, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

/** Datos estructurados (schema.org) de la ficha pública de un centro. */
export function centerJsonLd(c: PublicCenter, meta: PublicMeta | null, url: string, description: string) {
  const hours = Object.entries(c.schedule ?? {}).flatMap(([day, ds]) => {
    if (!ds || !(day in DAY_NAMES)) return [];
    const allDay = 'allDay' in ds;
    return [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAY_NAMES[day as Day],
        opens: allDay ? '00:00' : ds.open,
        closes: allDay ? '23:59' : ds.close,
      },
    ];
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: c.name,
    description,
    url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: c.address || undefined,
      addressLocality: c.district || c.community || undefined,
      addressRegion: provinceLabel(meta, c.province),
      addressCountry: 'PA',
    },
    geo: hasCoords(c) ? { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng } : undefined,
    telephone: c.contactPhone || undefined,
    openingHoursSpecification: hours.length ? hours : undefined,
    // Para lectores que no conocen Place: dónde queda, en una línea.
    disambiguatingDescription: placeLine(meta, c),
  };
}

/** Datos estructurados del sitio (portada). */
export function siteJsonLd(url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url,
    description: SITE_DESCRIPTION,
    inLanguage: 'es-PA',
    isAccessibleForFree: true,
  };
}
