'use client';

import { useSyncExternalStore } from 'react';
import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { Button, buttonVariants, useToast } from '@demogar/mola-ui';
import { NewTab } from '@/components/ui/new-tab';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Alternativa para navegadores sin API de portapapeles (o sin permiso).
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

const noSubscribe = () => () => {};

/** Compartir (Web Share API), copiar enlace y enviar por WhatsApp. */
export function ShareActions({ title, text, path }: { title: string; text: string; path: string }) {
  const toast = useToast();
  // En el servidor (y en la hidratación) no hay `window`: ruta relativa y sin botón de compartir.
  const url = useSyncExternalStore(
    noSubscribe,
    () => new URL(path, window.location.origin).toString(),
    () => path,
  );
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === 'function',
    () => false,
  );

  const share = async () => {
    try {
      await navigator.share({ title, text, url });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') copy();
    }
  };

  const copy = async () => {
    const ok = await copyText(url);
    if (ok) toast.success({ title: 'Enlace copiado', description: 'Pégalo donde quieras compartirlo.' });
    else toast.error({ title: 'No se pudo copiar', description: url });
  };

  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;

  return (
    <div className="flex flex-wrap gap-2">
      {canShare && (
        <Button variant="secondary" icon={<Share2 aria-hidden="true" />} onClick={share}>
          Compartir
        </Button>
      )}
      <Button variant="secondary" icon={<Copy aria-hidden="true" />} onClick={copy}>
        Copiar enlace
      </Button>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        Enviar por WhatsApp
        <NewTab label="se abre en WhatsApp" />
      </a>
    </div>
  );
}
