import { pageMeta } from '@/lib/seo';

/** Pantalla privada: con título, pero fuera de los buscadores. */
export const metadata = pageMeta({ title: 'Entrar', noindex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
