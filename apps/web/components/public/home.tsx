'use client';

import { Component, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { List, LocateFixed, Map as MapIcon, X } from 'lucide-react';
import {
  Button,
  buttonVariants,
  Callout,
  EmptyState,
  Field,
  SearchInput,
  Select,
  Skeleton,
  Switch,
} from '@demogar/mola-ui';
import { ErrorState, Loading } from '@/components/states';
import { useApi } from '@/lib/use-api';
import { centerTypeLabel, fold, hasCoords, haversineKm } from '@/lib/public-format';
import { CENTER_TYPES_FALLBACK } from '@/lib/public-schedule';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';
import { CenterCard } from './center-card';
import { isOpenNow, useNow } from './open-status';

const CenterMap = dynamic(() => import('./center-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-[min(60vh,420px)] w-full" aria-label="Cargando el mapa…" />,
});

const ALL = 'ALL';

type Geo =
  | { state: 'off' }
  | { state: 'locating' }
  | { state: 'on'; lat: number; lng: number }
  | { state: 'error'; message: string };

/** Si el módulo del mapa no descarga (sin señal), se muestra un aviso y la lista sigue. */
class MapBoundary extends Component<{ children: React.ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <Callout
          tone="warn"
          title="No se pudo cargar el mapa"
          actions={
            <Button
              variant="secondary"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onRetry();
              }}
            >
              Reintentar
            </Button>
          }
        >
          Puede ser la señal. La lista de abajo sigue funcionando.
        </Callout>
      );
    }
    return this.props.children;
  }
}

export function PublicHome({
  initialCenters,
  initialMeta,
  initialProvince,
  initialItem,
  initialType,
  tileHost,
}: {
  initialCenters: PublicCenter[] | null;
  initialMeta: PublicMeta | null;
  initialProvince: string | null;
  initialItem: string | null;
  initialType: string | null;
  tileHost: string;
}) {
  // Si el servidor ya trajo los datos, no se vuelven a pedir al abrir la página.
  const centersQ = useApi<PublicCenter[]>(initialCenters ? null : '/public/centers');
  const metaQ = useApi<PublicMeta>(initialMeta ? null : '/public/meta');
  const centers = centersQ.data ?? initialCenters;
  const meta = metaQ.data ?? initialMeta;

  const [province, setProvince] = useState<string>(initialProvince ?? ALL);
  const [item, setItem] = useState<string>(initialItem ?? ALL);
  const [ctype, setCtype] = useState<string>(initialType ?? ALL);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const now = useNow();
  const [query, setQuery] = useState('');
  const [geo, setGeo] = useState<Geo>({ state: 'off' });
  const [showMap, setShowMap] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  // Descarta valores de la URL que no existen en el catálogo.
  useEffect(() => {
    if (!meta) return;
    if (province !== ALL && !meta.provinces[province]) setProvince(ALL);
    if (item !== ALL && !meta.items[item]) setItem(ALL);
    if (ctype !== ALL && !(meta.centerTypes ?? CENTER_TYPES_FALLBACK)[ctype]) setCtype(ALL);
  }, [meta, province, item, ctype]);

  // Refleja provincia y artículo en la URL (no son datos personales). La ubicación y el texto, nunca.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (province !== ALL) url.searchParams.set('p', province);
    else url.searchParams.delete('p');
    if (item !== ALL) url.searchParams.set('i', item);
    else url.searchParams.delete('i');
    if (ctype !== ALL) url.searchParams.set('t', ctype);
    else url.searchParams.delete('t');
    const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '');
    if (next !== window.location.pathname + window.location.search)
      window.history.replaceState(window.history.state, '', next);
  }, [province, item, ctype]);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeo({ state: 'error', message: 'Tu navegador no permite usar la ubicación. Filtra por provincia.' });
      return;
    }
    setGeo({ state: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ state: 'on', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        setGeo({
          state: 'error',
          message:
            err.code === err.PERMISSION_DENIED
              ? 'No diste permiso para usar tu ubicación. Puedes filtrar por provincia o buscar tu distrito.'
              : 'No pudimos saber dónde estás. Intenta de nuevo o filtra por provincia.',
        }),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const origin = geo.state === 'on' ? { lat: geo.lat, lng: geo.lng } : null;

  const results = useMemo(() => {
    if (!centers) return [];
    const q = fold(query.trim());
    const filtered = centers.filter((c) => {
      if (province !== ALL && c.province !== province) return false;
      if (item !== ALL && !c.needs.some((n) => n.item === item && n.level !== 'ENOUGH')) return false;
      if (ctype !== ALL && c.centerType !== ctype) return false;
      if (onlyOpen && isOpenNow(c, now) !== true) return false;
      if (q && !fold(`${c.name} ${c.district} ${c.community}`).includes(q)) return false;
      return true;
    });
    const rows = filtered.map((c) => ({
      c,
      km: origin && hasCoords(c) ? haversineKm(origin, { lat: c.lat as number, lng: c.lng as number }) : null,
    }));
    if (origin) {
      // Orden estable: los que tienen coordenadas por distancia; los que no, al final en el orden de la API.
      rows.sort((a, b) => (a.km == null ? 1 : 0) - (b.km == null ? 1 : 0) || (a.km ?? 0) - (b.km ?? 0));
    }
    return rows;
  }, [centers, province, item, ctype, onlyOpen, now, query, origin]);

  const filtersActive = province !== ALL || item !== ALL || ctype !== ALL || onlyOpen || query.trim() !== '';
  const clearFilters = () => {
    setProvince(ALL);
    setItem(ALL);
    setCtype(ALL);
    setOnlyOpen(false);
    setQuery('');
  };

  const provinceItems = useMemo(
    () => [
      { value: ALL, label: 'Todo el país' },
      ...Object.entries(meta?.provinces ?? {}).map(([value, label]) => ({ value, label })),
    ],
    [meta],
  );
  const itemItems = useMemo(
    () => [
      { value: ALL, label: 'Cualquier artículo' },
      ...Object.entries(meta?.items ?? {}).map(([value, label]) => ({ value, label })),
    ],
    [meta],
  );

  const typeItems = useMemo(
    () => [
      { value: ALL, label: 'Todos los tipos' },
      ...Object.keys(meta?.centerTypes ?? CENTER_TYPES_FALLBACK).map((value) => ({
        value,
        label: centerTypeLabel(meta, value),
      })),
    ],
    [meta],
  );

  const loadError = !centers && centersQ.error;

  return (
    <div className="grid gap-6">
      {/* En pantallas anchas, presentación y filtros comparten la primera franja. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8">
        <section aria-labelledby="hero" className="grid gap-3 lg:content-start">
          <h1 id="hero" className="font-ui text-3xl font-bold leading-tight text-ink sm:text-4xl">
            Dónde llevar donaciones y qué necesitan hoy
          </h1>
          <p className="max-w-2xl text-ink-2">
            Centros de acopio de todo Panamá tras el terremoto. La información la mantiene la comunidad:{' '}
            <strong className="text-ink">confirma con el centro antes de ir</strong>. Aquí solo se piden artículos,
            nunca dinero.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/publicar" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
              Publicar un centro
            </Link>
            <Link href="/como-funciona" className={`${buttonVariants({ variant: 'ghost' })} no-underline`}>
              Cómo funciona
            </Link>
          </div>
        </section>

        <section aria-labelledby="filtros" className="grid gap-3 bg-cloth-shade p-4">
          <h2 id="filtros" className="sr-only">
            Filtros
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Provincia o comarca"
              items={provinceItems}
              value={province}
              onValueChange={(v) => setProvince(v ?? ALL)}
              disabled={!meta}
            />
            <Select
              label="¿Qué quieres donar?"
              items={itemItems}
              value={item}
              onValueChange={(v) => setItem(v ?? ALL)}
              disabled={!meta}
            />
            <Select label="Tipo de lugar" items={typeItems} value={ctype} onValueChange={(v) => setCtype(v ?? ALL)} />
            <Field label="Buscar" hint="Nombre, distrito o comunidad">
              {(c) => (
                <SearchInput
                  {...c}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onClear={() => setQuery('')}
                  clearLabel="Borrar búsqueda"
                  placeholder="Ej.: Tonosí"
                  autoComplete="off"
                />
              )}
            </Field>
          </div>
          <Switch
            label="Abierto ahora"
            description="Según el horario que publicó cada centro (hora de Panamá)."
            checked={onlyOpen}
            onCheckedChange={setOnlyOpen}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {geo.state === 'on' ? (
              <Button variant="secondary" icon={<X aria-hidden="true" />} onClick={() => setGeo({ state: 'off' })}>
                Quitar «cerca de mí»
              </Button>
            ) : (
              <Button
                variant="secondary"
                icon={<LocateFixed aria-hidden="true" />}
                loading={geo.state === 'locating'}
                onClick={locate}
              >
                Cerca de mí
              </Button>
            )}
            <span className="text-sm text-ink-2">Tu ubicación no sale de tu teléfono.</span>
          </div>
          {geo.state === 'error' && (
            <p role="alert" className="text-sm text-ink-warn">
              {geo.message}
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="resultados" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="resultados" className="font-ui text-xl font-bold">
            Centros de acopio
          </h2>
          <Button
            variant="ghost"
            icon={showMap ? <List aria-hidden="true" /> : <MapIcon aria-hidden="true" />}
            aria-pressed={showMap}
            onClick={() => setShowMap((v) => !v)}
            disabled={!centers}
          >
            {showMap ? 'Ocultar mapa' : 'Ver mapa'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p aria-live="polite" className="text-sm text-ink-2">
            {centers &&
              (results.length === 1 ? '1 centro' : `${results.length} centros`) +
                (origin ? ', ordenados por distancia' : '') +
                (filtersActive ? ' con estos filtros' : '')}
          </p>
          {centers && filtersActive && results.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X aria-hidden="true" />}
              className="min-h-11"
              onClick={clearFilters}
            >
              Quitar filtros
            </Button>
          )}
        </div>

        {/* Con el mapa abierto, en pantallas anchas va fijo a la derecha de la lista. */}
        <div
          className={
            showMap && centers
              ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,40%)] lg:items-start lg:gap-6'
              : 'grid gap-4'
          }
        >
          {showMap && centers && (
            <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
              <MapBoundary key={mapKey} onRetry={() => setMapKey((k) => k + 1)}>
                <CenterMap
                  centers={results.map((r) => r.c)}
                  meta={meta}
                  tileHost={tileHost}
                  origin={origin}
                  heightClass="h-[min(60vh,420px)] lg:h-[calc(100dvh-8rem)]"
                />
              </MapBoundary>
            </div>
          )}

          <div className="grid gap-4 lg:col-start-1 lg:row-start-1">
            {loadError ? (
              <ErrorState error={centersQ.error!} onRetry={centersQ.reload} />
            ) : !centers ? (
              <Loading label="Cargando centros…" />
            ) : results.length === 0 ? (
              <EmptyState
                variant={filtersActive ? 'no-results' : 'empty'}
                title="Aún no hay centros en esta zona"
                description="¿Conoces uno? Publícalo: solo necesitas tu correo."
                headingLevel={3}
                actions={
                  <>
                    <Link href="/publicar" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
                      Publicar un centro
                    </Link>
                    {filtersActive && (
                      <Button variant="secondary" onClick={clearFilters}>
                        Quitar filtros
                      </Button>
                    )}
                  </>
                }
              />
            ) : (
              <ul
                className={
                  showMap
                    ? 'grid gap-3 md:grid-cols-2 2xl:grid-cols-3'
                    : 'grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                }
              >
                {results.map(({ c, km }) => (
                  <li key={c.id} className="grid">
                    <CenterCard center={c} meta={meta} distanceKm={km} highlightItem={item !== ALL ? item : null} />
                  </li>
                ))}
              </ul>
            )}
            {origin && results.some((r) => r.km == null) && (
              <p className="text-sm text-ink-2">Los centros sin ubicación en el mapa aparecen al final.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
