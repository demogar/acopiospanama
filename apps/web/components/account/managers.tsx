'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { AlertDialog, Badge, Button, Callout, Field, Input, Stack, Text, useToast } from '@demogar/mola-ui';
import { ErrorState, Loading } from '@/components/states';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Manager } from '@/lib/account-types';
import { useApi } from '@/lib/use-api';

/** Responsables del centro: tener 2–3 evita que desaparezca si una persona no responde. */
export function Managers({ centerId }: { centerId: string }) {
  const toast = useToast();
  const list = useApi<Manager[]>(`/centers/${centerId}/managers`);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Manager | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Escribe un correo válido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/centers/${centerId}/managers`, { email: email.trim() });
      toast.success({ title: 'Responsable añadido', description: `Le avisamos a ${email.trim()} por correo.` });
      setEmail('');
      list.reload();
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.email ?? err.message) : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: Manager) {
    try {
      await api.del(`/centers/${centerId}/managers/${m.id}`);
      toast.success({ title: m.you ? 'Ya no eres responsable de este centro' : 'Responsable quitado' });
      if (m.you) window.location.assign('/mis-centros');
      else list.reload();
    } catch (err) {
      toast.error({ title: 'No se pudo quitar', description: errorMessage(err) });
    }
  }

  const only = (list.data?.length ?? 0) <= 1;

  return (
    <Stack gap="md">
      <Text>
        Tener <strong>2 o 3 responsables</strong> evita que el centro desaparezca del directorio si una persona no puede
        responder los recordatorios. Cualquiera de ustedes puede actualizarlo, confirmarlo o cerrarlo.
      </Text>
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-keyline-soft border-y border-keyline-soft" aria-label="Responsables actuales">
          {list.data.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="font-semibold break-words text-ink">
                  {m.name || m.email.split('@')[0]}{' '}
                  {m.you && (
                    <Badge tone="info" variant="soft">
                      Tú
                    </Badge>
                  )}
                </p>
                <p className="text-sm [overflow-wrap:anywhere] text-ink-2">{m.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={only}
                onClick={() => setRemoving(m)}
                aria-label={m.you ? 'Dejar de ser responsable' : `Quitar a ${m.name || m.email}`}
              >
                {m.you ? 'Salir' : 'Quitar'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {only && list.data && (
        <Callout tone="info" icon={false}>
          Eres el único responsable. Añade a alguien más; no puedes quitar al único (si el centro dejó de funcionar,
          ciérralo).
        </Callout>
      )}
      <form onSubmit={invite} noValidate>
        <Stack gap="sm">
          <Field
            label="Añadir responsable por correo"
            hint="Le llega un aviso. Entra con ese correo, sin contraseña."
            error={error ?? undefined}
          >
            {(c) => (
              <Input
                {...c}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" variant="secondary" icon={<UserPlus aria-hidden="true" />} loading={busy}>
            Añadir responsable
          </Button>
          <Text size="sm" tone="muted">
            Solo añade a personas que conoces y que trabajan en el centro. Los responsables ven el correo de los demás.
          </Text>
        </Stack>
      </form>
      <AlertDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing?.you ? '¿Dejar de ser responsable?' : `¿Quitar a ${removing?.name || removing?.email}?`}
        description={
          removing?.you
            ? 'Ya no verás este centro en «Mis centros» ni recibirás recordatorios.'
            : 'Ya no podrá actualizar este centro ni recibirá recordatorios.'
        }
        confirmLabel={removing?.you ? 'Sí, salir' : 'Sí, quitar'}
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={async () => {
          if (removing) await remove(removing);
        }}
      />
    </Stack>
  );
}
