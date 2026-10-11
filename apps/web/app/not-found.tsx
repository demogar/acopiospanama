import Link from 'next/link';
import { buttonVariants } from '@demogar/mola-ui';
import { SiteFrame } from '@/components/site-frame';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({ title: 'Página no encontrada', noindex: true });

/** 404 general, en español y con el marco del sitio (sin esto Next muestra su página en inglés). */
export default function NotFound() {
  return (
    <SiteFrame back={{ href: '/', label: 'Inicio' }} width="prose">
      <div className="grid gap-3 py-6">
        <h1 className="font-ui text-2xl font-bold">Página no encontrada</h1>
        <p className="text-ink-2">
          Esa dirección no existe o cambió. Revisa el enlace o vuelve al inicio para buscar centros de acopio.
        </p>
        <p>
          <Link href="/" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
            Ver centros
          </Link>
        </p>
      </div>
    </SiteFrame>
  );
}
