'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Flag, MapPin, Navigation } from 'lucide-react';
import { Button, buttonVariants, Callout, EmptyState, useToast } from '@demogar/mola-ui';
import { ErrorState, Loading } from '@/components/states';
import { NewTab } from '@/components/ui/new-tab';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import {
  centerTypeLabel,
  centerTypeShort,
  directionsLinks,
  itemLabel,
  needsAt,
  organizerLabel,
  placeLine,
} from '@/lib/public-format';
import { todayText } from '@/lib/public-schedule';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';
import { FreshnessShort, StatusBadges } from './freshness';
import { NeedsDetail } from './needs';
import { ContactBlock } from './contact-block';
import { Linkify } from './linkify';
import { OpenLine } from './open-status';
import { ScheduleTable } from './schedule-table';
import { ReportDialog } from './report-dialog';
import { HiddenCenter } from './hidden-center';
import { ShareActions } from './share-actions';

type Initial =
  | { ok: true; data: PublicCenter }
  | { ok: false; status: number; code?: string; message?: string; extra?: Record<string, unknown> }
  | null;

export function CenterDetail({
  slug,
  initial,
  initialMeta,
}: {
  slug: string;
  initial: Initial;
  initialMeta: PublicMeta | null;
}) {
  const toast = useToast();
  const [center, setCenter] = useState<PublicCenter | null>(initial?.ok ? initial.data : null);
  const [error, setError] = useState<ApiError | null>(
    initial && !initial.ok && initial.status !== 0
      ? new ApiError(
          initial.status,
          initial.code ?? 'ERROR',
          initial.message ?? 'No se pudo cargar.',
          initial.extra ?? {},
        )
      : null,
  );
  const [loading, setLoading] = useState(!initial || (!initial.ok && initial.status === 0));
  const metaQ = useApi<PublicMeta>(initialMeta ? null : '/public/meta');
  const meta = metaQ.data ?? initialMeta;
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);

  // Pide la ficha y guarda el resultado; no marca «cargando» (la carga inicial ya parte en true).
  const fetchCenter = useCallback(
    () =>
      api
        .get<PublicCenter>(`/public/centers/${slug}`)
        .then((c) => {
          setCenter(c);
          setError(null);
        })
        .catch((e) => {
          const err = e instanceof ApiError ? e : new ApiError(0, 'ERROR', 'Ocurrió un error inesperado.');
          setError(err);
          // Si pasó a estar oculto o fue retirado mientras la mirabas, se muestra ese estado.
          if (err.status === 410 || err.status === 404) setCenter(null);
        })
        .finally(() => setLoading(false)),
    [slug],
  );

  const load = useCallback(async () => {
    setLoading(true);
    await fetchCenter();
  }, [fetchCenter]);

  // Sin datos del servidor (p. ej. la API no respondió a tiempo): se piden desde el navegador.
  const needsClientLoad = !initial || (!initial.ok && initial.status === 0);
  useEffect(() => {
    if (needsClientLoad) void fetchCenter();
  }, [needsClientLoad, fetchCenter]);

  const confirm = async () => {
    if (!center) return;
    setConfirming(true);
    try {
      const r = await api.post<{ message: string }>(`/public/centers/${center.id}/confirm`);
      setConfirmed(true);
      toast.success({ title: '¡Gracias!', description: r.message });
      await load();
    } catch (e) {
      toast.error({ title: 'No se pudo confirmar', description: errorMessage(e) });
    } finally {
      setConfirming(false);
    }
  };

  if (error && !center) {
    if (error.status === 404) {
      return (
        <EmptyState
          variant="no-results"
          title="No encontrado"
          description="Este centro no existe o ya fue retirado. Busca otros centros en el inicio."
          actions={
            <Link href="/" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
              Ver centros
            </Link>
          }
        />
      );
    }
    if (error.status === 410) {
      const id = typeof error.data.id === 'string' ? error.data.id : undefined;
      const name = typeof error.data.name === 'string' ? error.data.name : undefined;
      return <HiddenCenter id={id} name={name} message={error.message} onConfirmed={() => void load()} />;
    }
    return <ErrorState error={error} onRetry={load} />;
  }
  if (!center) return <Loading label="Cargando centro…" />;

  const dir = directionsLinks(center, meta);
  const urgent = needsAt(center, 'URGENT');
  const needed = needsAt(center, 'NEEDED');
  const shareNeeds = [...urgent, ...needed].map((n) => itemLabel(meta, n.item));
  const today = todayText(center.schedule);
  const shareText = [
    `${center.name} — ${centerTypeShort(meta, center.centerType)} en ${placeLine(meta, center)}.`,
    today ? (today.endsWith('.') ? today : `${today}.`) : '',
    shareNeeds.length ? `Necesita: ${shareNeeds.join(', ')}.` : '',
    'Confirma antes de ir.',
  ]
    .filter(Boolean)
    .join(' ');
  const closed = center.visibility === 'CLOSED';
  const canConfirm = !closed && center.visibility !== 'REMOVED' && center.visibility !== 'COMMUNITY_HIDDEN';

  return (
    <article className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:gap-x-10">
      <div className="grid min-w-0 gap-6">
        <header className="grid gap-2">
          <div className="flex flex-wrap gap-1.5 empty:hidden">
            <StatusBadges center={center} />
          </div>
          <h1 className="font-ui text-2xl font-bold leading-tight text-ink sm:text-3xl">{center.name}</h1>
          <p className="flex items-start gap-1.5 text-ink">
            <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-ink-2" />
            {placeLine(meta, center)}
          </p>
          <OpenLine center={center} />
          <FreshnessShort center={center} />
          <p className="text-sm text-ink-2">
            {centerTypeLabel(meta, center.centerType)} · {organizerLabel(meta, center.organizerType)}
            {center.organizerName && center.organizerName !== center.name ? ` · ${center.organizerName}` : ''}
          </p>
        </header>

        <div className="grid gap-3" aria-live="polite">
          {closed && (
            <Callout tone="neutral" title="Este centro cerró" headingLevel={2}>
              Su responsable lo marcó como cerrado. No lleves donaciones aquí.
            </Callout>
          )}
          {center.flagged && (
            <Callout tone="danger" title="Reportado: verifica antes de ir" headingLevel={2}>
              Varias personas lo reportaron. Confirma por teléfono antes de ir y nunca envíes dinero.
            </Callout>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={dir.google}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonVariants({ variant: closed ? 'secondary' : 'primary' })} no-underline w-full sm:w-auto h-auto! min-h-11 whitespace-normal! py-2 text-center leading-snug`}
          >
            <Navigation aria-hidden="true" className="size-4" />
            Cómo llegar · Google Maps
            <NewTab label="se abre en Google Maps" />
          </a>
          {dir.waze && (
            <a
              href={dir.waze}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
            >
              Waze
              <NewTab label="se abre en Waze" />
            </a>
          )}
        </div>

        {!closed && (
          <section aria-labelledby="necesidades" className="grid gap-3 bg-cloth-pale p-4 shadow-cut">
            <h2 id="necesidades" className="font-ui text-xl font-bold">
              Qué necesitan
            </h2>
            <NeedsDetail center={center} meta={meta} />
          </section>
        )}

        <Callout tone="warn" title="Aquí solo se piden artículos, nunca dinero." headingLevel={2}>
          ¿Te pidieron una transferencia? Repórtalo. <Link href="/como-funciona#juega-vivo">Evita el «juega vivo»</Link>
        </Callout>

        <section aria-labelledby="donde" className="grid gap-3">
          <h2 id="donde" className="font-ui text-xl font-bold">
            Dónde y cuándo
          </h2>
          {center.address && <p>{center.address}</p>}
          <div className="grid gap-2">
            <h3 className="font-ui text-base font-bold">Horario</h3>
            <ScheduleTable schedule={center.schedule} />
            {center.hoursNote && <p className="whitespace-pre-line text-ink-2">{center.hoursNote}</p>}
          </div>
          {center.notes && (
            <div>
              <h3 className="font-ui text-base font-bold">Notas del centro</h3>
              <p className="mt-1 whitespace-pre-line">
                <Linkify text={center.notes} />
              </p>
            </div>
          )}
        </section>

        <ContactBlock center={center} />
      </div>

      {/* En pantallas anchas, confirmar, reportar y compartir quedan siempre a la vista. */}
      <aside className="grid gap-6 lg:sticky lg:top-6 lg:self-start">
        {!closed && (
          <section aria-labelledby="compartir" className="grid gap-3">
            <h2 id="compartir" className="font-ui text-xl font-bold">
              Compartir
            </h2>
            <ShareActions title={center.name} text={shareText} path={`/c/${center.slug}`} />
          </section>
        )}

        <section aria-labelledby="comunidad" className="grid gap-3 bg-cloth-shade p-4">
          <h2 id="comunidad" className="font-ui text-xl font-bold">
            ¿Fuiste hoy?
          </h2>
          <p className="text-sm text-ink-2">Avisa que sigue funcionando. Es anónimo.</p>
          <div className="flex flex-wrap gap-2">
            {canConfirm && (
              <Button
                variant="primary"
                className="h-auto min-h-11 w-full whitespace-normal py-2 text-center sm:w-auto lg:w-full"
                icon={<CheckCircle2 aria-hidden="true" />}
                loading={confirming}
                disabled={confirmed}
                onClick={confirm}
              >
                {confirmed ? 'Gracias, ya confirmaste' : 'Estuve aquí y sigue funcionando'}
              </Button>
            )}
            <Button
              variant="secondary"
              className="h-auto min-h-11 w-full whitespace-normal py-2 text-center sm:w-auto lg:w-full"
              icon={<Flag aria-hidden="true" />}
              onClick={() => setReportOpen(true)}
              disabled={reported}
            >
              {reported ? 'Reporte enviado' : 'Reportar un problema'}
            </Button>
          </div>
          {loading && <span className="sr-only">Actualizando…</span>}
        </section>

        <p>
          <Link href="/mis-centros" className="inline-flex min-h-11 items-center font-semibold">
            ¿Eres responsable? Actualiza este centro
          </Link>
        </p>
      </aside>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        centerId={center.id}
        centerName={center.name}
        meta={meta}
        onDone={() => {
          setReported(true);
          void load();
        }}
      />
    </article>
  );
}
