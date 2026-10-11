'use client';

import { useState } from 'react';
import { AlertDialog, Badge, Button, Field, Heading, Input, Panel, Stack, Text, useToast } from '@demogar/mola-ui';
import { ErrorState, Loading } from '@/components/states';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Moderator } from '@/lib/account-types';
import { useApi } from '@/lib/use-api';

/** Solo administración: nombrar y quitar moderadores (pide confirmar el segundo factor). */
export function Moderators({ run }: { run: <T>(fn: () => Promise<T>) => Promise<T> }) {
  const toast = useToast();
  const list = useApi<Moderator[]>('/mod/moderators');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Moderator | null>(null);

  async function set(target: string, moderator: boolean) {
    await run(() => api.post('/mod/moderators', { email: target, moderator }));
    list.reload();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Escribe un correo válido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await set(email.trim(), true);
      toast.success({ title: 'Moderador añadido', description: 'Al entrar, tendrá que configurar su segundo factor.' });
      setEmail('');
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'CANCELLED')) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel as="section" padding="md" tone="pale" aria-labelledby="mods-h">
      <Stack gap="md">
        <Heading level={2} size={3} id="mods-h">
          Moderadores
        </Heading>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Loading />
        ) : (
          <ul className="divide-y divide-keyline-soft border-y border-keyline-soft">
            {list.data.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-semibold [overflow-wrap:anywhere] text-ink">{m.name || m.email}</p>
                  <p className="flex flex-wrap gap-1 text-sm text-ink-2">
                    {m.name && <span className="[overflow-wrap:anywhere]">{m.email}</span>}
                    {m.isAdmin && (
                      <Badge tone="accent" variant="soft">
                        Admin
                      </Badge>
                    )}
                    {!m.totpEnabledAt && (
                      <Badge tone="warn" variant="outline">
                        Sin segundo factor aún
                      </Badge>
                    )}
                  </p>
                </div>
                {!m.isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(m)} aria-label={`Quitar a ${m.email}`}>
                    Quitar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} noValidate>
          <Stack gap="sm">
            <Field label="Añadir moderador por correo" error={error ?? undefined}>
              {(c) => (
                <Input
                  {...c}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" variant="secondary" loading={busy}>
              Añadir moderador
            </Button>
            <Text size="sm" tone="muted">
              Pocas personas y de confianza. La moderación es el último recurso.
            </Text>
          </Stack>
        </form>
      </Stack>
      <AlertDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`¿Quitar a ${removing?.email}?`}
        description="Dejará de ser moderador y se cerrarán sus sesiones."
        confirmLabel="Sí, quitar"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await set(removing.email, false);
            toast.success({ title: 'Moderador quitado' });
          } catch (err) {
            if (!(err instanceof ApiError && err.code === 'CANCELLED'))
              toast.error({ title: 'No se pudo', description: errorMessage(err) });
          }
        }}
      />
    </Panel>
  );
}
