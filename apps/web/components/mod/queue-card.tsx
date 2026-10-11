'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Callout, Heading, Panel, Stack, Text, useToast } from '@demogar/mola-ui';
import { StatusBadges } from '@/components/account/center-status';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatDate, type Meta, type ModCenter, timeAgo } from '@/lib/account-types';
import { ReasonDialog } from './reason-dialog';

type Dialog = 'remove' | 'restore' | 'block' | null;

/** Un centro en la cola de moderación: estado, reportes y acciones. */
export function QueueCard({
  c,
  meta,
  run,
  onChanged,
}: {
  c: ModCenter;
  meta: Meta | null;
  run: <T>(fn: () => Promise<T>) => Promise<T>;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dismissing, setDismissing] = useState(false);
  const headingId = `m-${c.id}`;
  const removed = c.status === 'REMOVED';
  // Un centro que su responsable cerró no se «restaura» desde moderación: lo reabren sus responsables.
  const canRestore = removed || c.visibility === 'COMMUNITY_HIDDEN';

  async function dismiss() {
    setDismissing(true);
    try {
      const r = await api.post<{ dismissed: number }>(`/mod/centers/${c.id}/dismiss-reports`);
      toast.success({ title: r.dismissed === 1 ? '1 reporte descartado' : `${r.dismissed} reportes descartados` });
      onChanged();
    } catch (err) {
      toast.error({ title: 'No se pudo', description: errorMessage(err) });
    } finally {
      setDismissing(false);
    }
  }

  const place = [c.community, c.district, meta?.provinces[c.province]].filter(Boolean).join(' · ');

  return (
    <Panel as="article" padding="md" aria-labelledby={headingId} className={removed ? 'opacity-90' : undefined}>
      <Stack gap="sm">
        <span className="flex flex-wrap gap-1">
          <StatusBadges c={c} />
          {c.isNew && !removed && (
            <Badge tone="info" variant="soft">
              Nuevo
            </Badge>
          )}
        </span>
        <Heading level={2} size={4} id={headingId} className="break-words">
          {removed ? (
            c.name
          ) : (
            <Link href={`/c/${c.slug}`} className="underline" target="_blank">
              {c.name}
            </Link>
          )}
        </Heading>
        <Text size="sm" tone={2}>
          {place}
          {place && ' · '}Publicado {timeAgo(c.createdAt)} · {c.confirmations}{' '}
          {c.confirmations === 1 ? 'confirmación' : 'confirmaciones'} en 72 h
        </Text>
        {c.notes && (
          <Text size="sm" className="line-clamp-3 break-words">
            <span className="font-semibold">Notas:</span> {c.notes}
          </Text>
        )}

        {c.reports.length > 0 ? (
          <div>
            <p className="font-semibold text-ink">
              {c.reports.length === 1 ? '1 reporte abierto' : `${c.reports.length} reportes abiertos`}
            </p>
            <ul className="mt-1 divide-y divide-keyline-soft border-y border-keyline-soft">
              {c.reports.map((r) => (
                <li key={r.id} className="py-2">
                  <p className="text-sm">
                    <strong>{meta?.reportReasons[r.reason] ?? r.reason}</strong>{' '}
                    <span className="text-ink-2">· {formatDate(r.createdAt)}</span>
                  </p>
                  {r.details && <p className="text-sm break-words text-ink-2">«{r.details}»</p>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          !removed && (
            <Text size="sm" tone="muted">
              Sin reportes: aparece aquí por ser nuevo (últimas 24 h).
            </Text>
          )
        )}

        {removed && (
          <Callout tone="danger" icon={false}>
            Retirado {timeAgo(c.updatedAt)}
            {c.removedReason ? <>. Motivo: «{c.removedReason}»</> : null}.
          </Callout>
        )}

        <div className="mt-1 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
          {!removed && (
            <Button variant="danger" onClick={() => setDialog('remove')}>
              Retirar
            </Button>
          )}
          {canRestore && (
            <Button variant={removed ? 'primary' : 'secondary'} onClick={() => setDialog('restore')}>
              Restaurar
            </Button>
          )}
          {!removed && c.reports.length > 0 && (
            <Button
              variant="secondary"
              className="h-auto! min-h-11 py-2 text-center leading-snug whitespace-normal!"
              loading={dismissing}
              onClick={dismiss}
            >
              Descartar reportes
            </Button>
          )}
          {!removed && (
            <Button
              variant="ghost"
              className="h-auto! min-h-11 py-2 text-center leading-snug whitespace-normal!"
              onClick={() => setDialog('block')}
            >
              Bloquear a quien lo publicó
            </Button>
          )}
        </div>
      </Stack>

      <ReasonDialog
        open={dialog === 'remove'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Retirar del directorio"
        description={`«${c.name}» dejará de mostrarse y sus responsables no podrán editarlo. Úsalo para estafas o abusos claros.`}
        confirmLabel="Retirar"
        onConfirm={async (reason) => {
          await api.post(`/mod/centers/${c.id}/remove`, { reason });
          toast.success({ title: 'Centro retirado' });
          onChanged();
        }}
      />
      <ReasonDialog
        open={dialog === 'restore'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Restaurar el centro"
        description={`«${c.name}» vuelve a publicarse como confirmado ahora, y se descartan sus reportes abiertos.`}
        confirmLabel="Restaurar"
        tone="primary"
        onConfirm={async (reason) => {
          await api.post(`/mod/centers/${c.id}/restore`, { reason });
          toast.success({ title: 'Centro restaurado' });
          onChanged();
        }}
      />
      <ReasonDialog
        open={dialog === 'block'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Bloquear a quien lo publicó"
        description="Se bloquea el correo de quien creó este centro: no podrá entrar ni crear otra cuenta con ese correo, aunque haya borrado la suya. Se retira todo lo que publicó (no solo este centro). No verás su correo."
        extra={
          <Callout tone="warn" icon={false}>
            Solo ante abuso claro (estafa, spam). Te pediremos tu código de autenticación.
          </Callout>
        }
        confirmLabel="Bloquear cuenta"
        onConfirm={async (reason) => {
          try {
            await run(() => api.post('/mod/users/block', { centerId: c.id, reason }));
          } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
              throw new ApiError(404, 'NOT_FOUND', 'No se puede bloquear esa cuenta (no existe o es de moderación).');
            }
            throw err;
          }
          toast.success({ title: 'Cuenta bloqueada', description: 'Sus centros se retiraron del directorio.' });
          onChanged();
        }}
      />
    </Panel>
  );
}
