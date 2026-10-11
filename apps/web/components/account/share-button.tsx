'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button, useToast } from '@demogar/mola-ui';

/** Compartir la ficha: menú nativo del teléfono o, si no existe, copiar el enlace. */
export function ShareButton({
  path,
  title,
  variant = 'secondary',
}: {
  path: string;
  title: string;
  variant?: 'primary' | 'secondary';
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function share() {
    const url = `${window.location.origin}${path}`;
    setBusy(true);
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} — centro de acopio. Mira qué aceptan hoy:`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success({ title: 'Enlace copiado', description: 'Pégalo en WhatsApp o donde quieras.' });
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error({ title: 'No se pudo compartir', description: url });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      icon={<Share2 aria-hidden="true" />}
      loading={busy}
      onClick={share}
    >
      Compartir
    </Button>
  );
}
