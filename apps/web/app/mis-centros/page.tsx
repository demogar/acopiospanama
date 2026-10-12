'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Pencil, Plus } from 'lucide-react';
import {
  AlertDialog,
  Button,
  buttonVariants,
  EmptyState,
  Field,
  Heading,
  Input,
  Panel,
  Stack,
  Text,
  useToast,
} from '@demogar/mola-ui';
import { OwnerReports, StatusBadges } from '@/components/account/center-status';
import { SiteFrame } from '@/components/site-frame';
import { ErrorState, Loading } from '@/components/states';
import { api, errorMessage } from '@/lib/api';
import { useMeta } from '@/lib/account-meta';
import { type Invitation, type Me, type MyCenter, timeAgo, VISIBILITY_INFO } from '@/lib/account-types';
import { useApi } from '@/lib/use-api';

export default function MyCentersPage() {
  const me = useApi<Me>('/me');
  const { meta } = useMeta();

  const publish = (
    <Link href="/publicar" className={`${buttonVariants({ size: 'md' })} no-underline`}>
      <Plus aria-hidden="true" className="size-5" /> Publicar otro
    </Link>
  );

  if (me.error)
    return (
      <SiteFrame width="prose" title="Mis centros">
        <ErrorState error={me.error} onRetry={me.reload} />
      </SiteFrame>
    );
  if (!me.data)
    return (
      <SiteFrame width="prose" title="Mis centros">
        <Loading />
      </SiteFrame>
    );

  const { user, centers } = me.data;
  const invitations = me.data.invitations ?? [];
  return (
    <SiteFrame
      width="prose"
      title="Mis centros"
      subtitle="Mantenlos al día: así la gente sabe a dónde ir y qué llevar."
      actions={centers.length ? publish : undefined}
    >
      <Stack gap="lg">
        {invitations.length > 0 && <Invitations items={invitations} provinces={meta?.provinces} onDone={me.reload} />}
        {centers.length === 0 && invitations.length > 0 ? null : centers.length === 0 ? (
          <EmptyState
            className="grid-cols-[minmax(0,1fr)] px-3"
            variant="empty"
            title="Aún no tienes centros"
            description="Si organizas o conoces de primera mano un centro de acopio, publícalo: toma unos 3 minutos. Si alguien te invita como responsable, la invitación aparecerá aquí."
            actions={
              <Link href="/publicar" className={`${buttonVariants({ size: 'lg' })} no-underline`}>
                Publicar un centro
              </Link>
            }
          />
        ) : (
          <ul className="space-y-4" aria-label="Centros que administras">
            {centers.map((c) => (
              <li key={c.id}>
                <CenterCard c={c} provinces={meta?.provinces} onChanged={me.reload} />
              </li>
            ))}
          </ul>
        )}
        {user.isModerator && (
          <Panel padding="md" tone="shade">
            <Text>
              Eres moderador.{' '}
              <Link href="/moderacion" className="font-semibold underline">
                Ir a moderación
              </Link>
            </Text>
          </Panel>
        )}
        <Account name={user.name} email={user.email} isStaff={user.isModerator || user.isAdmin} onSaved={me.reload} />
      </Stack>
    </SiteFrame>
  );
}

function CenterCard({
  c,
  provinces,
  onChanged,
}: {
  c: MyCenter;
  provinces?: Record<string, string>;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const closed = c.visibility === 'CLOSED';
  const headingId = `c-${c.id}`;
  const urgent = c.needs.filter((n) => n.level === 'URGENT').length;
  const needed = c.needs.filter((n) => n.level === 'NEEDED').length;

  async function act(kind: 'confirm' | 'close' | 'reopen') {
    setBusy(kind);
    try {
      await api.post(`/centers/${c.id}/${kind}`);
      toast.success({
        title:
          kind === 'confirm' ? '¡Gracias! Quedó confirmado' : kind === 'close' ? 'Centro cerrado' : 'Centro reabierto',
        description:
          kind === 'close'
            ? 'Ya no aparece en el directorio.'
            : kind === 'reopen'
              ? 'Revisa que lo que aceptan esté al día.'
              : undefined,
      });
      onChanged();
    } catch (err) {
      toast.error({ title: 'No se pudo', description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel as="article" padding="md" aria-labelledby={headingId}>
      <Stack gap="sm">
        <StatusBadges c={c} />
        <Heading level={2} size={3} id={headingId} className="break-words">
          {c.name}
        </Heading>
        <Text size="sm" tone={2}>
          {[c.community, c.district, provinces?.[c.province]].filter(Boolean).join(' · ')}
        </Text>
        <Text size="sm" tone="muted">
          {VISIBILITY_INFO[c.visibility].help} Última confirmación {timeAgo(c.lastActivity)}.
          {!closed && ` Qué aceptan: ${urgent === 1 ? '1 urgente' : `${urgent} urgentes`}, ${needed} más.`}
        </Text>
        <OwnerReports c={c} />
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {!closed && (
            <Button
              size="lg"
              icon={<CheckCircle2 aria-hidden="true" />}
              loading={busy === 'confirm'}
              onClick={() => act('confirm')}
            >
              Sigue funcionando
            </Button>
          )}
          {!closed && (
            <Link
              href={`/mis-centros/${c.id}`}
              className={`${buttonVariants({ variant: 'secondary', size: 'lg' })} h-auto! min-h-(--control-h-lg) py-2 text-center whitespace-normal! no-underline`}
            >
              Actualizar qué aceptan
            </Link>
          )}
          <Link
            href={`/mis-centros/${c.id}?seccion=datos`}
            className={`${buttonVariants({ variant: 'secondary', size: 'lg' })} no-underline`}
          >
            <Pencil aria-hidden="true" className="size-5" /> Editar
          </Link>
          {closed ? (
            <Button size="lg" loading={busy === 'reopen'} onClick={() => act('reopen')}>
              Reabrir
            </Button>
          ) : (
            <Button size="lg" variant="ghost" onClick={() => setCloseOpen(true)}>
              Cerrar centro
            </Button>
          )}
        </div>
        {!closed && (
          <Link href={`/c/${c.slug}`} className="inline-flex min-h-11 items-center self-start text-sm underline">
            Ver la ficha pública
          </Link>
        )}
      </Stack>
      <AlertDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title={`¿Cerrar «${c.name}»?`}
        description="Dejará de aparecer en el directorio. Puedes reabrirlo después si vuelve a recibir donaciones."
        confirmLabel="Sí, cerrar"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={() => act('close')}
      />
    </Panel>
  );
}

function Account({
  name,
  email,
  isStaff,
  onSaved,
}: {
  name: string;
  email: string;
  isStaff: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch('/me', { name: value });
      toast.success({ title: 'Nombre guardado' });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setLeaving(true);
    try {
      await api.post('/auth/logout');
    } catch {
      /* si ya no había sesión, igual salimos */
    }
    window.location.assign('/');
  }

  async function deleteAccount() {
    try {
      await api.del('/me');
    } catch (err) {
      toast.error({ title: 'No se pudo borrar la cuenta', description: errorMessage(err) });
      return;
    }
    try {
      await api.post('/auth/logout');
    } catch {
      /* la sesión ya no existe junto con la cuenta */
    }
    window.location.assign('/');
  }

  return (
    <Panel as="section" padding="md" tone="pale" aria-labelledby="cuenta-h">
      <Stack gap="md">
        <Heading level={2} size={4} id="cuenta-h">
          Tu cuenta
        </Heading>
        <Text size="sm" tone={2} className="[overflow-wrap:anywhere]">
          Entraste como {email}. Tu correo nunca se publica; solo lo ven los otros responsables de tus centros.
        </Text>
        <form onSubmit={save}>
          <Stack gap="sm">
            <Field
              label="Tu nombre (opcional)"
              hint="Lo ven los otros responsables de tus centros."
              error={error ?? undefined}
            >
              {(c) => (
                <Input
                  {...c}
                  value={value}
                  maxLength={80}
                  autoComplete="name"
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" variant="secondary" loading={busy} disabled={value.trim() === name}>
              Guardar nombre
            </Button>
          </Stack>
        </form>
        <Button variant="ghost" loading={leaving} onClick={logout}>
          Cerrar sesión
        </Button>
        {!isStaff && (
          <Button variant="ghost" className="text-ink-danger" onClick={() => setDeleteOpen(true)}>
            Borrar mi cuenta
          </Button>
        )}
      </Stack>
      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Borrar tu cuenta?"
        description="Dejas de ser responsable de tus centros. Los centros donde eres el único responsable quedan cerrados. Se borra tu correo; no se puede deshacer. Si la moderación bloqueó tu cuenta, no podrás crear otra con el mismo correo."
        confirmLabel="Sí, borrar mi cuenta"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={deleteAccount}
      />
    </Panel>
  );
}

/** Invitaciones a co-administrar: no dan acceso hasta aceptarlas. */
function Invitations({
  items,
  provinces,
  onDone,
}: {
  items: Invitation[];
  provinces?: Record<string, string>;
  onDone: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function answer(inv: Invitation, action: 'accept' | 'decline') {
    setBusy(`${inv.id}:${action}`);
    try {
      await api.post(`/centers/${inv.id}/invitation/${action}`);
      toast.success({ title: action === 'accept' ? `Ahora administras «${inv.name}»` : 'Invitación rechazada' });
      onDone();
    } catch (err) {
      toast.error({ title: 'No se pudo', description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel as="section" padding="md" tone="pale" aria-labelledby="inv-h">
      <Stack gap="sm">
        <Heading level={2} size={3} id="inv-h">
          Te invitaron a administrar
        </Heading>
        <Text size="sm" tone={2}>
          Al aceptar podrás editar ese centro y actualizar lo que aceptan. Si no conoces el centro, recházala.
        </Text>
        <ul className="divide-y divide-keyline-soft border-y border-keyline-soft">
          {items.map((inv) => (
            <li key={inv.id} className="py-3">
              <p className="font-semibold break-words text-ink">{inv.name}</p>
              <p className="text-sm text-ink-2">
                {[inv.community, provinces?.[inv.province]].filter(Boolean).join(' · ')}
                {' · '}
                <Link href={`/c/${inv.slug}`} className="underline">
                  Ver ficha
                </Link>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button loading={busy === `${inv.id}:accept`} disabled={!!busy} onClick={() => answer(inv, 'accept')}>
                  Aceptar
                </Button>
                <Button
                  variant="secondary"
                  loading={busy === `${inv.id}:decline`}
                  disabled={!!busy}
                  onClick={() => answer(inv, 'decline')}
                >
                  Rechazar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Stack>
    </Panel>
  );
}
