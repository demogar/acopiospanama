import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Marco común de todas las pantallas: cabecera con la marca y accesos, título opcional y pie.
 * Sin estado ni hooks: sirve tanto en páginas de servidor como de cliente.
 *
 *   <SiteFrame title="Mis centros" subtitle="…" back={{ href: '/', label: 'Inicio' }} actions={<Button/>}>
 *     …
 *   </SiteFrame>
 */
export interface SiteFrameProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /**
   * Ancho del contenido: `prose` (~ 48rem, textos y formularios), `page` (por defecto, ~ 72rem)
   * o `wide` (el ancho del sitio, ~ 100rem, para el directorio).
   */
  width?: 'page' | 'prose' | 'wide';
  children: React.ReactNode;
}

/** Ancho del sitio (cabecera, pie y páginas `wide`) y márgenes laterales según la pantalla. */
const SITE = 'mx-auto w-full max-w-[100rem] px-4 sm:px-6 lg:px-8';
const WIDTHS = { prose: 'max-w-3xl', page: 'max-w-6xl', wide: '' } as const;
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

const navLink =
  'inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink no-underline hover:underline focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none';

/** Líneas de emergencia de Panamá. Van arriba de todo porque el directorio no atiende emergencias. */
const EMERGENCY_LINES = [
  { label: 'Asistencia médica', number: '911', tel: '911' },
  { label: 'SINAPROC', number: '520-4429', tel: '+5075204429' },
  { label: 'Bomberos', number: '103', tel: '103' },
];

const emergencyLink =
  'font-mono font-bold text-white underline decoration-white/60 underline-offset-2 hover:decoration-white';

export function SiteFrame({ title, subtitle, back, actions, width = 'page', children }: SiteFrameProps) {
  const max = WIDTHS[width];
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:bg-cloth-pale focus:p-3"
      >
        Saltar al contenido
      </a>
      <aside aria-label="Emergencias" className="bg-rojo text-white">
        <p className={`${SITE} flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 text-sm leading-snug`}>
          <strong className="font-semibold">¿Emergencia?</strong>
          {EMERGENCY_LINES.map((l) => (
            <span key={l.tel} className="whitespace-nowrap">
              {l.label}:{' '}
              <a href={`tel:${l.tel}`} className={emergencyLink}>
                {l.number}
              </a>
            </span>
          ))}
        </p>
      </aside>
      <header className="border-b border-keyline bg-cloth-pale">
        <div className={`${SITE} flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1`}>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 font-ui text-lg font-bold text-ink no-underline"
          >
            <span aria-hidden="true" className="inline-block size-3 bg-rojo" />
            Acopio Panamá
          </Link>
          <nav aria-label="Principal" className="-me-2 flex items-center gap-1">
            <Link href="/publicar" className={navLink}>
              Publicar un centro
            </Link>
            <Link href="/mis-centros" className={navLink}>
              Mis centros
            </Link>
          </nav>
        </div>
      </header>

      {/* El contenido comparte el margen izquierdo de la cabecera; `max` solo limita el ancho de lectura. */}
      <main id="contenido" className={`${SITE} flex-1 pb-12 pt-4 lg:pt-6`}>
        <div className={max}>
          {back && (
            <Link
              href={back.href}
              className="mb-2 -ms-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm text-ink-2 no-underline hover:underline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {back.label}
            </Link>
          )}
          {(title || actions) && (
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                {title && <h1 className="font-ui text-2xl font-bold leading-tight text-ink sm:text-3xl">{title}</h1>}
                {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
              </div>
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </main>

      <footer className="border-t border-keyline bg-cloth-shade">
        <div
          className={`${SITE} flex flex-col gap-2 py-4 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between`}
        >
          <nav aria-label="Información" className="-ms-2 flex flex-wrap gap-1">
            <Link href="/como-funciona" className={navLink}>
              Cómo funciona
            </Link>
            <Link href="/privacidad" className={navLink}>
              Privacidad
            </Link>
          </nav>
          <p>Este directorio no atiende emergencias: usa las líneas de arriba.</p>
        </div>
        <p className={`${SITE} max-w-none pb-3 text-xs leading-relaxed text-ink-2`}>
          Acopio Panamá es una iniciativa comunitaria e independiente para la respuesta al terremoto del 9 de octubre de
          2026. No es un sitio del Gobierno ni del SINAPROC: la información la publican y confirman las propias personas
          y organizaciones. Datos abiertos bajo licencia{' '}
          <a
            href="https://creativecommons.org/licenses/by/4.0/deed.es"
            className="text-ink-2 hover:underline"
            rel="noopener noreferrer"
          >
            CC BY 4.0
          </a>
          .
        </p>
        {VERSION && (
          <p className={`${SITE} pb-3 text-xs text-ink-2`}>
            <a
              href="https://github.com/demogar/acopiospanama"
              className="text-ink-2 no-underline hover:underline"
              rel="noopener noreferrer"
            >
              Código abierto
            </a>
            {' · '}
            <span className="font-mono">v{VERSION}</span>
          </p>
        )}
      </footer>
    </div>
  );
}
