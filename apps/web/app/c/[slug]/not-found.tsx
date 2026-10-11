import Link from 'next/link';
import { buttonVariants } from '@demogar/mola-ui';
import { SiteFrame } from '@/components/site-frame';

export default function CenterNotFound() {
  return (
    <SiteFrame back={{ href: '/', label: 'Todos los centros' }} width="prose">
      <div className="grid gap-3 py-6">
        <h1 className="font-ui text-2xl font-bold">No encontrado</h1>
        <p className="text-ink-2">
          Este centro no existe o ya fue retirado. Revisa el enlace o busca otros centros en el inicio.
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
