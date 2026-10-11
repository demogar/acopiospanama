'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2 } from 'lucide-react';
import { Button, buttonVariants, Callout, Heading, Panel, Stack, Text } from '@demogar/mola-ui';
import { CenterFields, focusField, toBody, validateLocal } from '@/components/account/center-fields';
import { ErrorSummary } from '@/components/account/error-summary';
import {
  focusNeed,
  needErrors,
  NeedsEditor,
  needsToState,
  type NeedsState,
  needSummaryFields,
  stateToNeeds,
} from '@/components/account/needs-editor';
import { ShareButton } from '@/components/account/share-button';
import { SiteFrame } from '@/components/site-frame';
import { ErrorState, Loading } from '@/components/states';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useMeta } from '@/lib/account-meta';
import { type Center, type CenterInput, emptyInput, type SessionInfo } from '@/lib/account-types';
import { useApi } from '@/lib/use-api';

interface Duplicate {
  slug: string;
  name: string;
  community: string;
  district: string;
  address: string;
}

/** Formulario de publicación (la página de servidor le pasa el origen de las teselas del mapa). */
export function PublishForm({ tileHost }: { tileHost: string }) {
  const router = useRouter();
  const session = useApi<SessionInfo>('/auth/session');
  const { meta, error: metaError, reload: reloadMeta } = useMeta();
  const [value, setValue] = useState<CenterInput>(emptyInput);
  const [needs, setNeeds] = useState<NeedsState>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [needErrs, setNeedErrs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ title: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dups, setDups] = useState<Duplicate[] | null>(null);
  const [created, setCreated] = useState<Center | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const dupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session.error?.status === 401) router.replace('/entrar?siguiente=/publicar');
  }, [session.error, router]);

  useEffect(() => {
    if (meta && Object.keys(needs).length === 0) setNeeds(needsToState(meta.items, []));
  }, [meta, needs]);

  function patch(p: Partial<CenterInput>) {
    setValue((v) => ({ ...v, ...p }));
    // Cambiar nombre o provincia invalida la comprobación de duplicados.
    if ('name' in p || 'province' in p) setDups(null);
    const keys = Object.keys(p);
    if (keys.some((k) => fields[k]))
      setFields((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !keys.includes(k))));
  }

  function showErrors(f: Record<string, string>, msg: { title: string; text: string } | null) {
    setFields(f);
    setMessage(msg);
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  /** Marca los campos y enfoca el primero (en el orden del formulario que devuelve la API). */
  function focusFirst(f: Record<string, string>) {
    const first = Object.keys(f)[0];
    if (!first) return requestAnimationFrame(() => summaryRef.current?.focus());
    requestAnimationFrame(() =>
      first.startsWith('needs.') ? focusNeed(formRef.current, first.split('.')[1]) : focusField(formRef.current, first),
    );
  }

  async function submit(e: React.FormEvent | null, skipDuplicates = false) {
    e?.preventDefault();
    if (!meta) return;
    const local = validateLocal(value);
    if (Object.keys(local).length) return showErrors(local, null);
    setBusy(true);
    setMessage(null);
    setFields({});
    setNeedErrs({});
    try {
      if (!skipDuplicates && dups === null) {
        const found = await api.post<Duplicate[]>('/centers/check-duplicates', {
          name: value.name.trim(),
          province: value.province,
        });
        if (found.length) {
          setDups(found);
          setBusy(false);
          requestAnimationFrame(() => dupRef.current?.focus());
          return;
        }
      }
      const sent = stateToNeeds(meta.items, needs);
      const c = await api.post<Center>('/centers', { ...toBody(value), needs: sent });
      setCreated(c);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'MONEY_NOT_ALLOWED' || err.code === 'TEXT_NOT_ALLOWED')) {
        const sent = stateToNeeds(meta.items, needs);
        setNeedErrs(needErrors(err.fields, sent));
        const f = needSummaryFields(err.fields, sent);
        setFields(f);
        setMessage({
          title:
            err.code === 'MONEY_NOT_ALLOWED'
              ? 'No se puede publicar: hay texto que pide dinero'
              : 'No se puede publicar: hay texto no permitido',
          text: err.message,
        });
        focusFirst(f);
      } else if (err instanceof ApiError && err.code === 'TOO_MANY') {
        showErrors({}, { title: 'Llegaste al límite', text: err.message });
      } else if (err instanceof ApiError && err.code === 'VALIDATION') {
        const sent = stateToNeeds(meta.items, needs);
        setNeedErrs(needErrors(err.fields, sent));
        const f = needSummaryFields(err.fields, sent);
        showErrors(f, Object.keys(f).length ? null : { title: 'Revisa estos datos', text: err.message });
      } else {
        showErrors({}, { title: 'No se pudo publicar', text: errorMessage(err) });
      }
    } finally {
      setBusy(false);
    }
  }

  if (session.error && session.error.status !== 401)
    return (
      <SiteFrame width="prose" title="Publicar un centro">
        <ErrorState error={session.error} onRetry={session.reload} />
      </SiteFrame>
    );
  if (metaError)
    return (
      <SiteFrame width="prose" title="Publicar un centro">
        <ErrorState error={metaError} onRetry={reloadMeta} />
      </SiteFrame>
    );
  if (!session.data || !meta)
    return (
      <SiteFrame width="prose" title="Publicar un centro">
        <Loading />
      </SiteFrame>
    );

  if (created) {
    return (
      <SiteFrame width="prose" title="¡Centro publicado!">
        <Stack gap="lg">
          <div role="status">
            <Callout tone="success" icon={<CheckCircle2 aria-hidden="true" />} title={created.name}>
              Ya aparece en el directorio. Compártelo para que la gente sepa qué llevar.
            </Callout>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={`/c/${created.slug}`} className={`${buttonVariants({ size: 'lg' })} no-underline`}>
              Ver la ficha
            </Link>
            <ShareButton path={`/c/${created.slug}`} title={created.name} />
          </div>
          <Panel padding="lg" tone="pale">
            <Stack gap="sm">
              <Heading level={2} size={3}>
                Qué pasa ahora
              </Heading>
              <ul className="list-disc space-y-2 ps-5 text-ink">
                <li>
                  Si en 2 días nadie lo confirma, te enviaremos un correo con un botón para decir{' '}
                  <strong>«sigue funcionando»</strong> o <strong>«ya cerró»</strong>, sin entrar.
                </li>
                <li>
                  Sin confirmar en 3 días, baja en la lista; en 14 días deja de mostrarse. Así el directorio se mantiene
                  al día solo.
                </li>
                <li>Cuando cambie lo que aceptan, actualízalo desde «Mis centros»: toma 20 segundos.</li>
                <li>Añade a 1 o 2 personas más como responsables, por si no puedes responder.</li>
              </ul>
            </Stack>
          </Panel>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/mis-centros/${created.id}#responsables`}
              className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
            >
              Añadir responsables
            </Link>
            <Link href="/mis-centros" className={`${buttonVariants({ variant: 'ghost' })} no-underline`}>
              Ir a mis centros
            </Link>
          </div>
        </Stack>
      </SiteFrame>
    );
  }

  return (
    <SiteFrame
      width="prose"
      title="Publicar un centro de acopio"
      subtitle="Quedas como responsable. Toma unos 3 minutos."
      back={{ href: '/', label: 'Volver al directorio' }}
    >
      <form ref={formRef} onSubmit={(e) => submit(e)} noValidate>
        <Stack gap="lg">
          <Callout tone="warn" icon={<Ban aria-hidden="true" />} title="Solo artículos">
            No pongas enlaces ni pidas dinero: solo artículos. Si mencionas cuentas, Yappy o transferencias, la
            publicación se bloquea.
          </Callout>

          <ErrorSummary
            ref={summaryRef}
            message={message?.text}
            title={message?.title}
            fields={fields}
            items={meta.items}
            onPick={(k) =>
              k.startsWith('needs.') ? focusNeed(formRef.current, k.split('.')[1]) : focusField(formRef.current, k)
            }
          />

          <CenterFields meta={meta} value={value} onChange={patch} errors={fields} tileHost={tileHost} />

          <section aria-labelledby="needs-h" className="min-w-0">
            <Heading level={2} size={3} id="needs-h">
              Qué aceptan hoy
            </Heading>
            <Text size="sm" tone="muted" className="mt-1 mb-2">
              Marca solo lo que sepas; lo que dejes «sin indicar» no aparece. «Ya no aceptan» evita que la gente lleve
              de más. Puedes cambiarlo cuando quieras.
            </Text>
            <NeedsEditor items={meta.items} value={needs} onChange={setNeeds} errors={needErrs} />
          </section>

          {dups && dups.length > 0 && (
            <div ref={dupRef} tabIndex={-1} className="focus:outline-none" role="alert">
              <Callout tone="warn" title="¿Es alguno de estos?">
                <p>
                  Ya hay centros publicados con un nombre parecido en esta provincia. Mejor confirma o reporta ese en
                  lugar de crear otro.
                </p>
                <p className="mt-1">Si no es ninguno, toca «Publicar igualmente».</p>
                <ul className="mt-2 space-y-2">
                  {dups.map((d) => (
                    <li key={d.slug}>
                      <Link
                        href={`/c/${d.slug}`}
                        className="inline-flex min-h-11 flex-col justify-center underline"
                        target="_blank"
                      >
                        <span className="font-semibold">{d.name}</span>
                        <span className="text-sm text-ink-2">
                          {[d.community, d.district, d.address].filter(Boolean).join(' · ')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Callout>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {dups && dups.length > 0 ? (
              <Button type="button" size="lg" variant="secondary" loading={busy} onClick={() => submit(null, true)}>
                Publicar igualmente
              </Button>
            ) : (
              <Button type="submit" size="lg" loading={busy}>
                Publicar centro
              </Button>
            )}
            <Text size="sm" tone="muted">
              Tu correo no se publica. Al publicar aceptas mantener la ficha al día o cerrarla cuando deje de funcionar.
            </Text>
          </div>
        </Stack>
      </form>
    </SiteFrame>
  );
}
