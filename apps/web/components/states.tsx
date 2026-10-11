'use client';

import Link from 'next/link';
import { Button, buttonVariants, Callout, EmptyState, Skeleton, Stack } from '@demogar/mola-ui';
import type { ApiError } from '@/lib/api';

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <Stack gap="sm" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </Stack>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  if (error.status === 404) {
    return (
      <EmptyState
        variant="no-permission"
        title="No disponible"
        description="No existe o no tienes acceso. Si crees que es un error, vuelve al inicio."
        actions={
          <Link href="/" className={`${buttonVariants({ variant: 'secondary' })} no-underline`}>
            Ir al inicio
          </Link>
        }
      />
    );
  }
  if (error.code === 'MFA_REQUIRED') {
    return (
      <Callout
        tone="warn"
        title="Verifica tu segundo factor"
        actions={
          <Button
            onClick={() =>
              window.location.assign(`/seguridad?siguiente=${encodeURIComponent(window.location.pathname)}`)
            }
          >
            Verificar
          </Button>
        }
      >
        Para ver esta sección necesitas confirmar tu código de autenticación.
      </Callout>
    );
  }
  return (
    <Callout
      tone="danger"
      title="No se pudo cargar"
      actions={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        ) : undefined
      }
    >
      {error.message}
    </Callout>
  );
}
