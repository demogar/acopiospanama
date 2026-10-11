'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { AlertDialog, Badge, Button, Callout, Field, Input, Stack, Text, useToast } from '@demogar/mola-ui';
import { ErrorState, Loading } from '@/components/states';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Manager } from '@/lib/account-types';
import { useApi } from '@/lib/use-api';

/**
 * Responsables del centro: tener 2–3 evita que desaparezca si una persona no responde.
 * Se invita por correo y la persona tiene acceso solo cuando acepta. Para evitar que alguien
 * recién llegado «tome» el centro, solo quien es responsable desde antes puede quitar a otro;
 * cualquiera puede retirarse a sí mismo (la API lo hace cumplir; aquí solo se refleja).
 */
export function Managers({ centerId }: { centerId: string }) {
  const toast = useToast();
  const list = useApi<Manager[]>(`/centers/${centerId}/managers`);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
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
    setSent(null);
    try {
      await api.post(`/centers/${centerId}/managers`, { email: email.trim() });
      setSent('Le enviamos una invitación. Tendrá acceso cuando la acepte.');
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
      toast.success({
        title: m.you
          ? 'Ya no eres responsable de este centro'
          : m.pending
            ? 'Invitación retirada'
            : 'Responsable quitado',
      });
      if (m.you) window.location.assign('/mis-centros');
      else list.reload();
    } catch (err) {
      toast.error({ title: 'No se pudo', description: errorMessage(err) });
    }
  }

  const rows = list.data ?? [];
  const me = rows.find((m) => m.you);
  const accepted = rows.filter((m) => !m.pending);
  const only = accepted.length <= 1;
  /** Puedo quitar a una invitación pendiente, o a quien aceptó después que yo. */
  const canRemove = (m: Manager) =>
    m.pending ||
    (!!me?.acceptedAt && !!m.acceptedAt && new Date(me.acceptedAt).getTime() < new Date(m.acceptedAt).getTime());

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
        <ul
          className="divide-y divide-keyline-soft border-y border-keyline-soft"
          aria-label="Responsables e invitaciones"
        >
          {rows.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1 font-semibold break-words text-ink">
                  {m.name || m.email.split('@')[0]}
                  {m.you && (
                    <Badge tone="info" variant="soft">
                      Tú
                    </Badge>
                  )}
                  {m.pending && (
                    <Badge tone="warn" variant="outline">
                      Invitación pendiente
                    </Badge>
                  )}
                </p>
                <p className="text-sm [overflow-wrap:anywhere] text-ink-2">{m.email}</p>
              </div>
              {m.you
                ? !only && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoving(m)}
                      aria-label="Dejar de ser responsable"
                    >
                      Salir
                    </Button>
                  )
                : canRemove(m) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoving(m)}
                      aria-label={m.pending ? `Retirar la invitación a ${m.email}` : `Quitar a ${m.name || m.email}`}
                    >
                      {m.pending ? 'Retirar' : 'Quitar'}
                    </Button>
                  )}
            </li>
          ))}
        </ul>
      )}
      {list.data && (
        <Text size="sm" tone={2}>
          {only
            ? 'Eres el único responsable: no puedes retirarte. Invita a alguien más o, si el centro dejó de funcionar, ciérralo.'
            : 'Puedes retirarte cuando quieras. Solo quien es responsable desde antes puede quitar a otra persona; las invitaciones pendientes las puede retirar cualquiera.'}
        </Text>
      )}
      <form onSubmit={invite} noValidate>
        <Stack gap="sm">
          <Field
            label="Invitar a un responsable por correo"
            hint="Le llega una invitación. Tendrá acceso solo cuando la acepte."
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSent(null);
                }}
              />
            )}
          </Field>
          <Button type="submit" variant="secondary" icon={<UserPlus aria-hidden="true" />} loading={busy}>
            Enviar invitación
          </Button>
          <div aria-live="polite">
            {sent && (
              <Callout tone="success" icon={false}>
                {sent}
              </Callout>
            )}
          </div>
          <Text size="sm" tone="muted">
            Solo invita a personas que conoces y que trabajan en el centro. Los responsables ven el correo de los demás.
          </Text>
        </Stack>
      </form>
      <AlertDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={
          removing?.you
            ? '¿Dejar de ser responsable?'
            : removing?.pending
              ? `¿Retirar la invitación a ${removing.email}?`
              : `¿Quitar a ${removing?.name || removing?.email}?`
        }
        description={
          removing?.you
            ? 'Ya no verás este centro en «Mis centros» ni recibirás recordatorios.'
            : removing?.pending
              ? 'Ya no podrá aceptarla.'
              : 'Ya no podrá actualizar este centro. Le avisaremos por correo.'
        }
        confirmLabel={removing?.you ? 'Sí, dejar de serlo' : removing?.pending ? 'Sí, retirar' : 'Sí, quitar'}
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={async () => {
          if (removing) await remove(removing);
        }}
      />
    </Stack>
  );
}
