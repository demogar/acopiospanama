'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, DoorClosed } from 'lucide-react';
import { AlertDialog, Button, buttonVariants, Callout, Panel, Stack, Text } from '@demogar/mola-ui';
import { SiteFrame } from '@/components/site-frame';
import { Loading } from '@/components/states';
import { api, ApiError, errorMessage } from '@/lib/api';

interface Peek {
  name: string;
  slug: string;
  status: string;
}

/** Destino del botón de los correos de recordatorio: confirmar o cerrar sin iniciar sesión. */
function ConfirmInner() {
  const token = useSearchParams().get('t') ?? '';
  const [peek, setPeek] = useState<Peek | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<'CONFIRM' | 'CLOSE' | null>(null);
  const [busy, setBusy] = useState<'CONFIRM' | 'CLOSE' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError(new ApiError(400, 'NO_TOKEN', 'Falta el enlace.'));
      return;
    }
    let alive = true;
    // POST: así el token no queda en los registros de acceso.
    api
      .post<Peek>('/public/confirm-link/peek', { token })
      .then((p) => alive && setPeek(p))
      .catch((e) => {
        if (alive) setLoadError(e instanceof ApiError ? e : new ApiError(0, 'ERROR', errorMessage(e)));
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function act(action: 'CONFIRM' | 'CLOSE') {
    setBusy(action);
    setError(null);
    try {
      await api.post('/public/confirm-link', { token, action });
      setDone(action);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    const network = loadError.code === 'NETWORK';
    return (
      <SiteFrame width="prose" title={network ? 'Sin conexión' : 'Este enlace ya no sirve'}>
        <Stack gap="md">
          <Callout
            tone={network ? 'warn' : 'danger'}
            title={network ? 'No pudimos abrir el enlace' : 'Enlace vencido o inválido'}
          >
            {network
              ? loadError.message
              : 'Los enlaces de los correos vencen a las 72 horas. Entra con tu correo para confirmar o cerrar tu centro desde «Mis centros».'}
          </Callout>
          {network ? (
            <Button size="lg" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          ) : (
            <Link href="/entrar?siguiente=/mis-centros" className={`${buttonVariants({ size: 'lg' })} no-underline`}>
              Entrar con mi correo
            </Link>
          )}
        </Stack>
      </SiteFrame>
    );
  }
  if (!peek)
    return (
      <SiteFrame width="prose" title="Confirmar centro">
        <Loading />
      </SiteFrame>
    );

  if (done) {
    return (
      <SiteFrame width="prose" title={done === 'CONFIRM' ? '¡Gracias!' : 'Centro cerrado'}>
        <Stack gap="md">
          <div role="status">
            <Callout tone="success" icon={<CheckCircle2 aria-hidden="true" />} title={peek.name}>
              {done === 'CONFIRM'
                ? 'Quedó confirmado que sigue funcionando. Te volveremos a preguntar en unos días.'
                : 'Ya no aparece en el directorio. Gracias por avisar: así nadie hace un viaje en vano.'}
            </Callout>
          </div>
          {done === 'CONFIRM' && <Text>¿Cambió lo que aceptan? Actualízalo para que la gente lleve lo correcto.</Text>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/entrar?siguiente=/mis-centros"
              className={`${buttonVariants({ size: 'lg', variant: done === 'CONFIRM' ? 'primary' : 'secondary' })} no-underline`}
            >
              {done === 'CONFIRM' ? 'Actualizar qué aceptan' : 'Reabrir más adelante'}
            </Link>
            {done === 'CONFIRM' && (
              <Link
                href={`/c/${peek.slug}`}
                className={`${buttonVariants({ size: 'lg', variant: 'secondary' })} no-underline`}
              >
                Ver la ficha
              </Link>
            )}
          </div>
        </Stack>
      </SiteFrame>
    );
  }

  const closed = peek.status !== 'PUBLISHED';
  return (
    <SiteFrame width="prose" title="¿Sigue funcionando?">
      <Stack gap="lg">
        <Panel padding="lg" tone="pale">
          <Stack gap="xs">
            <Text size="sm" tone={2}>
              Centro de acopio
            </Text>
            <p className="font-ui text-xl font-bold break-words text-ink">{peek.name}</p>
          </Stack>
        </Panel>
        {closed ? (
          <Callout tone="info" title="Este centro está cerrado">
            Si volvió a recibir donaciones, entra con tu correo y reábrelo desde «Mis centros».
          </Callout>
        ) : (
          <Text>
            Confírmalo para que siga arriba en la lista. Si ya no recibe donaciones, ciérralo para que nadie vaya en
            vano.
          </Text>
        )}
        <div aria-live="polite">
          {error && (
            <Callout tone="danger" title="No se pudo">
              {error}
            </Callout>
          )}
        </div>
        {closed ? (
          <Link href="/entrar?siguiente=/mis-centros" className={`${buttonVariants({ size: 'lg' })} no-underline`}>
            Entrar con mi correo
          </Link>
        ) : (
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              icon={<CheckCircle2 aria-hidden="true" />}
              loading={busy === 'CONFIRM'}
              disabled={!!busy}
              onClick={() => act('CONFIRM')}
              className="h-auto! min-h-16 py-3 text-lg leading-snug whitespace-normal!"
            >
              Sí, sigue funcionando
            </Button>
            <Button
              size="lg"
              variant="secondary"
              icon={<DoorClosed aria-hidden="true" />}
              loading={busy === 'CLOSE'}
              disabled={!!busy}
              onClick={() => setCloseOpen(true)}
              className="h-auto! min-h-16 py-3 text-lg leading-snug whitespace-normal!"
            >
              Ya cerró
            </Button>
          </div>
        )}
        <Text size="sm" tone="muted">
          No necesitas iniciar sesión. Para cambiar datos o lo que aceptan,{' '}
          <Link href="/entrar?siguiente=/mis-centros" className="underline">
            entra con tu correo
          </Link>
          .
        </Text>
      </Stack>
      <AlertDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title={`¿Cerrar «${peek.name}»?`}
        description="Dejará de aparecer en el directorio. Si vuelve a funcionar, puedes reabrirlo entrando con tu correo."
        confirmLabel="Sí, ya cerró"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={() => act('CLOSE')}
      />
    </SiteFrame>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}
