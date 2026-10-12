'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button, Callout, Stack, Tabs, TabsList, TabsPanel, TabsTab, Text, useToast } from '@demogar/mola-ui';
import { CenterFields, focusField, toBody, validateLocal } from '@/components/account/center-fields';
import { OwnerReports, StatusBadges } from '@/components/account/center-status';
import { ErrorSummary } from '@/components/account/error-summary';
import { Managers } from '@/components/account/managers';
import {
  focusNeed,
  needErrors,
  NeedsEditor,
  needsToState,
  type NeedsState,
  stateToNeeds,
} from '@/components/account/needs-editor';
import { SiteFrame } from '@/components/site-frame';
import { ErrorState, Loading } from '@/components/states';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useMeta } from '@/lib/account-meta';
import {
  type CenterInput,
  inputFromCenter,
  type ManagedCenter,
  type Meta,
  type MyCenter,
  timeAgo,
} from '@/lib/account-types';
import { useApi } from '@/lib/use-api';

type Section = 'necesidades' | 'datos' | 'responsables';
const SECTIONS: Section[] = ['necesidades', 'datos', 'responsables'];

function EditInner({ tileHost }: { tileHost: string }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  // Solo responsables: la API responde 404 a cualquier otra persona.
  const me = useApi<ManagedCenter>(/^[0-9a-f-]{36}$/i.test(id) ? `/centers/${id}` : null);
  const { meta, error: metaError, reload: reloadMeta } = useMeta();
  const initial = params.get('seccion') as Section | null;
  // Las pestañas solo se pintan con el centro ya cargado en el navegador, así que leer el «#» aquí no
  // descuadra la hidratación.
  const [section, setSection] = useState<Section>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#responsables') return 'responsables';
    return initial && SECTIONS.includes(initial) ? initial : 'necesidades';
  });

  const center = me.data;
  const badId = !/^[0-9a-f-]{36}$/i.test(id);
  const back = { href: '/mis-centros', label: 'Mis centros' };

  if (badId)
    return (
      <SiteFrame width="prose" back={back}>
        <ErrorState error={new ApiError(404, 'NOT_FOUND', 'No encontrado')} />
      </SiteFrame>
    );
  if (me.error || metaError)
    return (
      <SiteFrame width="prose" back={back}>
        <ErrorState error={(me.error ?? metaError)!} onRetry={me.error ? me.reload : reloadMeta} />
      </SiteFrame>
    );
  if (!center || !meta)
    return (
      <SiteFrame width="prose" back={back}>
        <Loading />
      </SiteFrame>
    );

  function change(s: Section) {
    setSection(s);
    router.replace(`/mis-centros/${id}${s === 'necesidades' ? '' : `?seccion=${s}`}`, { scroll: false });
  }

  return (
    <SiteFrame
      width="prose"
      back={back}
      title={<span className="break-words">{center.name}</span>}
      subtitle={<StatusLine c={center} />}
    >
      <Stack gap="md">
        <OwnerReports c={center} headingLevel={2} exclude={['MY_DATA']} />
        {(center.reportReasons?.MY_DATA ?? 0) > 0 && (
          <Callout tone="warn" headingLevel={2} title="El contacto se ocultó">
            Alguien reportó que publicaste sus datos sin permiso: el contacto se ocultó. Vuelve a publicarlo solo con su
            consentimiento (pestaña «Datos»).
          </Callout>
        )}
        {center.visibility === 'CLOSED' && (
          <Callout tone="info" headingLevel={2} title="Este centro está cerrado">
            No aparece en el directorio. Para reabrirlo, ve a{' '}
            <Link href="/mis-centros" className="underline">
              Mis centros
            </Link>{' '}
            y toca «Reabrir».
          </Callout>
        )}
        <Tabs value={section} onValueChange={(v) => change(v as Section)} className="min-w-0">
          <TabsList className="min-w-0 max-w-full">
            <TabsTab value="necesidades" className="flex-1 justify-center px-2">
              Qué aceptan
            </TabsTab>
            <TabsTab value="datos" className="flex-1 justify-center px-2">
              Datos
            </TabsTab>
            <TabsTab value="responsables" className="flex-1 justify-center px-2">
              Responsables
            </TabsTab>
          </TabsList>
          <TabsPanel value="necesidades" className="pt-4">
            <NeedsForm key={center.updatedAt} center={center} meta={meta} onSaved={me.reload} />
          </TabsPanel>
          <TabsPanel value="datos" className="pt-4">
            <DataForm key={center.updatedAt} center={center} meta={meta} tileHost={tileHost} onSaved={me.reload} />
          </TabsPanel>
          <TabsPanel value="responsables" className="pt-4" id="responsables">
            <Managers centerId={center.id} />
          </TabsPanel>
        </Tabs>
      </Stack>
    </SiteFrame>
  );
}

function StatusLine({ c }: { c: MyCenter }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <StatusBadges c={c} />
      <span>Confirmado {timeAgo(c.lastActivity)}</span>
      {c.visibility !== 'CLOSED' && (
        <Link href={`/c/${c.slug}`} className="inline-flex min-h-11 items-center underline">
          Ver ficha
        </Link>
      )}
    </span>
  );
}

/** Actualizar necesidades en ~20 segundos: la lista, un toque por artículo y guardar (botón fijo abajo). */
function NeedsForm({ center, meta, onSaved }: { center: MyCenter; meta: Meta; onSaved: () => void }) {
  const toast = useToast();
  const original = useMemo(() => needsToState(meta.items, center.needs), [meta.items, center.needs]);
  const [value, setValue] = useState<NeedsState>(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [noteErrs, setNoteErrs] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(stateToNeeds(meta.items, value)) !== JSON.stringify(stateToNeeds(meta.items, original));
  const errRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNoteErrs({});
    const sent = stateToNeeds(meta.items, value);
    try {
      await api.put(`/centers/${center.id}/needs`, { needs: sent });
      toast.success({
        title: 'Guardado: qué aceptan hoy',
        description: 'También quedó confirmado que sigue funcionando.',
      });
      onSaved();
    } catch (err) {
      const ne = err instanceof ApiError ? needErrors(err.fields, sent) : {};
      setNoteErrs(ne);
      setError({
        title:
          err instanceof ApiError && err.code === 'MONEY_NOT_ALLOWED'
            ? 'No se guardó: una nota pide dinero'
            : err instanceof ApiError && err.code === 'TEXT_NOT_ALLOWED'
              ? 'No se guardó: una nota tiene texto no permitido'
              : 'No se pudo guardar',
        text: errorMessage(err),
      });
      const firstItem = Object.keys(ne)[0];
      requestAnimationFrame(() => (firstItem ? focusNeed(formRef.current, firstItem) : errRef.current?.focus()));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={save} noValidate>
      <Stack gap="sm">
        <Text size="sm" tone={2}>
          Toca el estado de cada artículo; lo que quede «sin indicar» no aparece. «Ya no aceptan» evita que la gente
          lleve de más. No pongas enlaces ni pidas dinero: solo artículos.
        </Text>
        {error && <ErrorSummary ref={errRef} title={error.title} message={error.text} fields={{}} onPick={() => {}} />}
        <NeedsEditor items={meta.items} value={value} onChange={setValue} errors={noteErrs} />
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-keyline bg-cloth/95 px-4 py-3 backdrop-blur-sm">
          <Button type="submit" size="lg" loading={busy} className="w-full">
            {dirty ? 'Guardar' : 'Confirmar sin cambios'}
          </Button>
        </div>
      </Stack>
    </form>
  );
}

function DataForm({
  center,
  meta,
  tileHost,
  onSaved,
}: {
  center: ManagedCenter;
  meta: Meta;
  tileHost: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const original = useMemo(() => inputFromCenter(center), [center]);
  const [value, setValue] = useState<CenterInput>(original);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ title: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  function patch(p: Partial<CenterInput>) {
    setValue((v) => ({ ...v, ...p }));
    const keys = Object.keys(p);
    if (keys.some((k) => fields[k]))
      setFields((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !keys.includes(k))));
  }

  function fail(f: Record<string, string>, msg: { title: string; text: string } | null) {
    setFields(f);
    setMessage(msg);
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const local = validateLocal(value);
    if (Object.keys(local).length) return fail(local, null);
    // Solo lo que cambió. La ubicación va en pareja; el contacto va completo con su consentimiento
    // (si se borra todo, la API retira el consentimiento).
    const body = toBody(value);
    const orig = toBody(original);
    const diff: Record<string, unknown> = {};
    const CONTACT = ['contactName', 'contactPhone', 'contactWhatsapp', 'contactConsent'] as const;
    for (const k of Object.keys(body) as (keyof CenterInput)[]) {
      if ((CONTACT as readonly string[]).includes(k)) continue;
      if (JSON.stringify(body[k]) !== JSON.stringify(orig[k])) diff[k] = body[k];
    }
    if ('lat' in diff || 'lng' in diff) Object.assign(diff, { lat: body.lat, lng: body.lng });
    if (CONTACT.some((k) => body[k] !== orig[k])) for (const k of CONTACT) diff[k] = body[k];
    setBusy(true);
    setFields({});
    setMessage(null);
    try {
      await api.patch(`/centers/${center.id}`, diff);
      toast.success({
        title: Object.keys(diff).length ? 'Ficha guardada' : 'Confirmado sin cambios',
        description: 'También quedó confirmado que sigue funcionando.',
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'MONEY_NOT_ALLOWED' || err.code === 'TEXT_NOT_ALLOWED')) {
        fail(err.fields, {
          title:
            err.code === 'MONEY_NOT_ALLOWED'
              ? 'No se guardó: hay texto que pide dinero'
              : 'No se guardó: hay texto no permitido',
          text: err.message,
        });
        const first = Object.keys(err.fields)[0];
        if (first) requestAnimationFrame(() => focusField(formRef.current, first));
      } else if (err instanceof ApiError && err.code === 'VALIDATION' && Object.keys(err.fields).length)
        fail(err.fields, null);
      else fail({}, { title: 'No se pudo guardar', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={save} noValidate>
      <Stack gap="lg">
        <Text size="sm" tone={2}>
          Guardar la ficha también resuelve los avisos de «datos por corregir». No pongas enlaces ni pidas dinero: solo
          artículos.
        </Text>
        <ErrorSummary
          ref={summaryRef}
          title={message?.title}
          message={message?.text}
          fields={fields}
          onPick={(k) => focusField(formRef.current, k)}
        />
        <CenterFields meta={meta} value={value} onChange={patch} errors={fields} tileHost={tileHost} />
        <Button type="submit" size="lg" loading={busy}>
          Guardar cambios
        </Button>
      </Stack>
    </form>
  );
}

export function EditCenter({ tileHost }: { tileHost: string }) {
  return (
    <Suspense>
      <EditInner tileHost={tileHost} />
    </Suspense>
  );
}
