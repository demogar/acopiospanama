'use client';

import { Callout, EmptyState, Stack, Text } from '@demogar/mola-ui';
import { Moderators } from '@/components/mod/moderators';
import { QueueCard } from '@/components/mod/queue-card';
import { SiteFrame } from '@/components/site-frame';
import { ErrorState, Loading } from '@/components/states';
import { useStepUp } from '@/components/step-up';
import { ApiError } from '@/lib/api';
import { useMeta } from '@/lib/account-meta';
import type { Me, ModCenter } from '@/lib/account-types';
import { useApi } from '@/lib/use-api';

const NOT_AVAILABLE = new ApiError(404, 'NOT_FOUND', 'No disponible');

export default function ModerationPage() {
  const me = useApi<Me>('/me');
  const isMod = !!me.data?.user.isModerator;
  // Solo se pide la cola si la cuenta es de moderación (evita un 404 innecesario).
  const queue = useApi<ModCenter[]>(isMod ? '/mod/queue' : null);
  const { meta } = useMeta();
  const { run, dialog } = useStepUp();
  const intro = 'La comunidad mantiene el directorio. Interviene solo ante estafas o abusos claros.';
  const frame = (children: React.ReactNode) => (
    <SiteFrame title="Moderación" subtitle={intro}>
      {children}
      {dialog}
    </SiteFrame>
  );

  if (me.error) return frame(<ErrorState error={me.error} onRetry={me.reload} />);
  if (!me.data) return frame(<Loading />);
  if (!isMod) return frame(<ErrorState error={NOT_AVAILABLE} />);
  if (queue.error) return frame(<ErrorState error={queue.error} onRetry={queue.reload} />);
  if (!queue.data) return frame(<Loading />);

  const removed = queue.data.filter((c) => c.status === 'REMOVED');
  const items = queue.data.filter((c) => c.status !== 'REMOVED');
  const withReports = items.filter((c) => c.reports.length > 0).length;
  const onChanged = () => queue.reload();

  return frame(
    <Stack gap="lg">
      <Callout tone="info" icon={false}>
        Las reglas automáticas ya bajan, marcan u ocultan centros según confirmaciones y reportes. Aquí ves los que
        tienen reportes abiertos y los publicados en las últimas 24 h.
      </Callout>
      <Text aria-live="polite" tone={2}>
        {withReports === 1 ? '1 centro con reportes' : `${withReports} centros con reportes`} ·{' '}
        {items.length - withReports} nuevos sin reportes
      </Text>
      {items.length === 0 ? (
        <EmptyState
          className="grid-cols-[minmax(0,1fr)] px-3"
          variant="empty"
          title="Nada por revisar"
          description="No hay reportes abiertos ni centros nuevos. La comunidad se está encargando."
        />
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2" aria-label="Centros por revisar">
          {items.map((c) => (
            <li key={c.id}>
              <QueueCard c={c} meta={meta} run={run} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}
      {removed.length > 0 && (
        <section aria-labelledby="removed-h" className="flex flex-col gap-3">
          <h2 id="removed-h" className="font-ui text-xl font-bold text-ink">
            Retirados en los últimos 7 días
          </h2>
          <p className="text-sm text-ink-2">
            Si alguno fue un error, restáuralo. Después de 7 días dejan de aparecer aquí.
          </p>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2" aria-label="Centros retirados">
            {removed.map((c) => (
              <li key={c.id}>
                <QueueCard c={c} meta={meta} run={run} onChanged={onChanged} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {me.data.user.isAdmin && <Moderators run={run} />}
    </Stack>,
  );
}
