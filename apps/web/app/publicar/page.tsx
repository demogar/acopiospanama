import { PublishForm } from '@/components/account/publish-form';
import { mapTileHost } from '@/lib/public-server';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Publicar un centro',
  description:
    'Publica un centro de acopio, punto de distribución, comedor o albergue en Panamá. Solo con tu correo, sin contraseñas, en dos minutos.',
  path: '/publicar',
});

export default function PublishPage() {
  return <PublishForm tileHost={mapTileHost()} />;
}
