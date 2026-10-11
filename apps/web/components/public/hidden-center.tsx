'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button, buttonVariants, Callout, useToast } from '@demogar/mola-ui';
import { api, errorMessage } from '@/lib/api';

/** Ficha de un centro oculto por reportes (410): explica por qué y deja confirmarlo. */
export function HiddenCenter({
  id,
  name,
  message,
  onConfirmed,
}: {
  id?: string;
  name?: string;
  message: string;
  onConfirmed: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const confirm = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const r = await api.post<{ message: string }>(`/public/centers/${id}/confirm`);
      setDone(true);
      toast.success({ title: '¡Gracias!', description: r.message });
      onConfirmed();
    } catch (e) {
      toast.error({ title: 'No se pudo confirmar', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="grid gap-5">
      <header className="grid gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-2">Centro oculto</p>
        <h1 className="font-ui text-2xl font-bold leading-tight text-ink sm:text-3xl">{name || 'Centro de acopio'}</h1>
      </header>
      <Callout tone="warn" title="Por qué no aparece en la lista" headingLevel={2}>
        {message}
      </Callout>
      <p className="text-ink-2">
        Varias personas dijeron que cerró, que pide dinero o que parece falso. Mientras siga oculto, no vayas sin
        confirmarlo por otra vía.
      </p>
      <Callout tone="danger" title="Nunca transfieras dinero a nombre de un centro de esta lista." headingLevel={2}>
        Aquí solo se piden artículos. Si alguien te pide dinero en nombre de este centro, no lo envíes.
      </Callout>
      {id && (
        <section aria-labelledby="hidden-confirm" className="grid gap-3 bg-cloth-shade p-4">
          <h2 id="hidden-confirm" className="font-ui text-xl font-bold">
            ¿Estuviste allí?
          </h2>
          <p className="text-ink-2">
            Si fuiste en persona y sigue funcionando, confírmalo. Cuando tantas personas lo confirman como las que lo
            reportaron, el centro vuelve a mostrarse (con aviso).
          </p>
          <div aria-live="polite">
            <Button
              variant="primary"
              className="h-auto min-h-11 w-full whitespace-normal py-2 text-center sm:w-auto"
              icon={<CheckCircle2 aria-hidden="true" />}
              loading={busy}
              disabled={done}
              onClick={confirm}
            >
              {done ? 'Gracias, ya confirmaste' : 'Estuve allí y sigue funcionando'}
            </Button>
          </div>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href="/" className={`${buttonVariants({ variant: 'secondary' })} no-underline`}>
          Ver otros centros
        </Link>
        <Link href="/mis-centros" className={`${buttonVariants({ variant: 'ghost' })} no-underline`}>
          Soy responsable
        </Link>
      </div>
    </article>
  );
}
