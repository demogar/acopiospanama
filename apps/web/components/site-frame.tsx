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
  /** Ancho del contenido: `page` (por defecto, ~ 64rem) o `prose` (~ 42rem, para textos). */
  width?: 'page' | 'prose';
  children: React.ReactNode;
}

const navLink =
  'inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink no-underline hover:underline focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none';

export function SiteFrame({ title, subtitle, back, actions, width = 'page', children }: SiteFrameProps) {
  const max = width === 'prose' ? 'max-w-2xl' : 'max-w-5xl';
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:bg-cloth-pale focus:p-3"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-keyline bg-cloth-pale">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1">
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

      <main id="contenido" className={`mx-auto w-full ${max} flex-1 px-4 pb-12 pt-4`}>
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
      </main>

      <footer className="border-t border-keyline bg-cloth-shade">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Información" className="-ms-2 flex flex-wrap gap-1">
            <Link href="/como-funciona" className={navLink}>
              Cómo funciona
            </Link>
            <Link href="/privacidad" className={navLink}>
              Privacidad
            </Link>
          </nav>
          <p>
            ¿Emergencia? Llama al{' '}
            <a href="tel:911" className="font-semibold text-ink">
              911
            </a>
            . Este directorio no atiende emergencias.
          </p>
        </div>
      </footer>
    </div>
  );
}
