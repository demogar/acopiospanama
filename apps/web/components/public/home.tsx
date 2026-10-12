'use client';

import { Component, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { List, LocateFixed, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react';
import {
  Button,
  buttonVariants,
  Callout,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  SearchInput,
  Select,
  Skeleton,
} from '@demogar/mola-ui';
import { ErrorState, Loading } from '@/components/states';
import { useApi } from '@/lib/use-api';
import { centerTypeLabel, fold, hasCoords, haversineKm, itemLabel, provinceLabel } from '@/lib/public-format';
import { CENTER_TYPES_FALLBACK } from '@/lib/public-schedule';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';
import { CenterCard } from './center-card';
import { isOpenNow, useNow } from './open-status';

const CenterMap = dynamic(() => import('./center-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-[min(60vh,420px)] w-full" aria-label="Cargando el mapa…" />,
});

const ALL = 'ALL';

/** Los filtros se leen como botones, no como etiquetas: negrita y tinta plena, como en el diseño. */
const CHIP = 'font-bold text-ink';

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

/**
 * Portada: la lista de centros va primero, con sus filtros encima. El artículo (`?i=`) ya no tiene botones
 * en la portada, pero se sigue respetando en enlaces compartidos y se puede quitar con «Quitar filtros».
 */
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
  const [moreOpen, setMoreOpen] = useState((initialType ?? ALL) !== ALL);
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

  const origin = useMemo(() => (geo.state === 'on' ? { lat: geo.lat, lng: geo.lng } : null), [geo]);

  // Un solo filtro con un «hueco»: los conteos de provincia ignoran la provincia elegida, para que cada
  // botón diga cuántos centros quedarían al tocarlo.
  const passes = useCallback(
    (c: PublicCenter, skip: 'province' | null) => {
      if (skip !== 'province' && province !== ALL && c.province !== province) return false;
      if (item !== ALL && !c.needs.some((n) => n.item === item && n.level !== 'ENOUGH')) return false;
      if (ctype !== ALL && c.centerType !== ctype) return false;
      if (onlyOpen && isOpenNow(c, now) !== true) return false;
      const q = fold(query.trim());
      if (q && !fold(`${c.name} ${c.district} ${c.community}`).includes(q)) return false;
      return true;
    },
    [province, item, ctype, onlyOpen, now, query],
  );

  const provinceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of centers ?? []) {
      if (!counts.has(c.province)) counts.set(c.province, 0);
      if (passes(c, 'province')) counts.set(c.province, (counts.get(c.province) ?? 0) + 1);
    }
    return counts;
  }, [centers, passes]);

  const results = useMemo(() => {
    if (!centers) return [];
    const rows = centers
      .filter((c) => passes(c, null))
      .map((c) => ({
        c,
        km: origin && hasCoords(c) ? haversineKm(origin, { lat: c.lat as number, lng: c.lng as number }) : null,
      }));
    if (origin) {
      // Orden estable: los que tienen coordenadas por distancia; los que no, al final en el orden de la API.
      rows.sort((a, b) => (a.km == null ? 1 : 0) - (b.km == null ? 1 : 0) || (a.km ?? 0) - (b.km ?? 0));
    }
    return rows;
  }, [centers, passes, origin]);

  // Sin provincia elegida ni orden por distancia, la lista se agrupa por provincia en el orden del catálogo.
  const groups = useMemo(() => {
    if (province !== ALL || origin) return null;
    const order = Object.keys(meta?.provinces ?? {});
    const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
    const byProvince = new Map<string, typeof results>();
    for (const r of results) byProvince.set(r.c.province, [...(byProvince.get(r.c.province) ?? []), r]);
    return [...byProvince.entries()]
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([key, rows]) => ({ key, label: provinceLabel(meta, key), rows }));
  }, [province, origin, meta, results]);

  const provinceChips = useMemo(() => {
    const order = Object.keys(meta?.provinces ?? {});
    return [...provinceCounts.keys()]
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map((key) => ({ key, label: provinceLabel(meta, key), count: provinceCounts.get(key) ?? 0 }));
  }, [meta, provinceCounts]);

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

  const filtersActive = province !== ALL || item !== ALL || ctype !== ALL || onlyOpen || query.trim() !== '';
  const clearFilters = () => {
    setProvince(ALL);
    setItem(ALL);
    setCtype(ALL);
    setOnlyOpen(false);
    setQuery('');
  };

  // Qué filtros hay puestos, en una línea, junto a «Quitar filtros».
  const filterSummary = [
    item !== ALL && itemLabel(meta, item),
    province !== ALL && provinceLabel(meta, province),
    ctype !== ALL && centerTypeLabel(meta, ctype),
    onlyOpen && 'abiertos ahora',
    query.trim() !== '' && `«${query.trim()}»`,
  ]
    .filter(Boolean)
    .join(' · ');

  const loadError = !centers && centersQ.error;
  const n = results.length;
  const resultTitle = !centers
    ? 'Centros de acopio'
    : `${n === 1 ? '1 centro' : `${n} centros`}${item !== ALL ? ` ${n === 1 ? 'pide' : 'piden'} ${itemLabel(meta, item).toLowerCase()}` : ''}`;

  return (
    <div className="grid gap-8">
      <section aria-labelledby="resultados" className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="grid gap-1">
            <h1 id="resultados" aria-live="polite" className="font-ui text-3xl font-bold leading-tight text-ink">
              {resultTitle}
            </h1>
            <p className="text-sm text-ink-2">
              {origin
                ? 'Ordenados por distancia. Tu ubicación no sale de tu teléfono.'
                : 'Urgentes primero, luego los confirmados más recientemente.'}{' '}
              <strong className="text-ink">Confirma con el centro antes de ir.</strong>
            </p>
          </div>
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

        {/* Aviso corto y plano: un campo dorado con una marca, en una línea. */}
        <aside
          aria-label="Aviso"
          className="flex items-start gap-2 bg-oro-soft px-4 py-3 text-sm leading-relaxed text-ink-2"
        >
          <span aria-hidden="true" className="mt-1.5 inline-block size-2.5 shrink-0 bg-warn" />
          <p>
            <strong className="text-ink">Nadie aquí te pedirá dinero.</strong> Si un centro pide transferencias o Yappy,
            repórtalo desde su ficha.{' '}
            <Link href="/como-funciona#juega-vivo" className="font-bold text-ink">
              Cómo evitar el «juega vivo»
            </Link>
          </p>
        </aside>

        <div className="grid gap-4">
          {/* En el teléfono las provincias van en una fila deslizable en vez de ocupar media pantalla. */}
          <ChipGroup
            legend="Provincia o comarca"
            hideLegend
            className="max-md:[&>div]:-mx-4 max-md:[&>div]:flex-nowrap max-md:[&>div]:overflow-x-auto max-md:[&>div]:px-4 max-md:[&>div]:pb-1 sm:max-md:[&>div]:-mx-6 sm:max-md:[&>div]:px-6 max-md:[&>div>*]:shrink-0"
          >
            <Chip
              type="radio"
              size="comfortable"
              className={CHIP}
              name="provincia"
              value={ALL}
              checked={province === ALL}
              onChange={() => setProvince(ALL)}
              count={centers ? [...provinceCounts.values()].reduce((a, b) => a + b, 0) : undefined}
            >
              Todo Panamá
            </Chip>
            {provinceChips.map((p) => (
              <Chip
                key={p.key}
                type="radio"
                size="comfortable"
                className={CHIP}
                name="provincia"
                value={p.key}
                checked={province === p.key}
                onChange={() => setProvince(p.key)}
                count={p.count}
              >
                {p.label}
              </Chip>
            ))}
          </ChipGroup>

          {/* Buscador y tipo siempre en el DOM: en el teléfono se pliegan tras «Más filtros». */}
          <div className="flex flex-wrap items-end gap-3">
            <Field
              id="filtro-buscar"
              label="Buscar"
              className={`min-w-0 flex-[1_1_16rem] ${moreOpen ? '' : 'max-md:hidden'}`}
            >
              {(c) => (
                <SearchInput
                  {...c}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onClear={() => setQuery('')}
                  clearLabel="Borrar búsqueda"
                  placeholder="Nombre, distrito o comunidad"
                  autoComplete="off"
                />
              )}
            </Field>
            <div id="filtro-tipo" className={`min-w-0 flex-[0_1_14rem] ${moreOpen ? '' : 'max-md:hidden'}`}>
              <Select label="Tipo de lugar" items={typeItems} value={ctype} onValueChange={(v) => setCtype(v ?? ALL)} />
            </div>
            <Chip
              type="checkbox"
              size="comfortable"
              className={CHIP}
              name="abierto"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
            >
              <span aria-hidden="true" className="size-2 shrink-0 bg-verde" />
              Abierto ahora
            </Chip>
            <Chip
              type="checkbox"
              size="comfortable"
              className={CHIP}
              name="cerca"
              checked={geo.state === 'on'}
              disabled={geo.state === 'locating'}
              onChange={(e) => (e.target.checked ? locate() : setGeo({ state: 'off' }))}
            >
              <LocateFixed aria-hidden="true" />
              {geo.state === 'locating' ? 'Buscando tu ubicación…' : 'Cerca de mí'}
            </Chip>
            <Button
              variant="ghost"
              className="md:hidden"
              icon={<SlidersHorizontal aria-hidden="true" />}
              aria-expanded={moreOpen}
              aria-controls="filtro-buscar filtro-tipo"
              onClick={() => setMoreOpen((v) => !v)}
            >
              {moreOpen ? 'Menos filtros' : 'Más filtros'}
            </Button>
          </div>

          {filtersActive && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
              <span>{filterSummary}</span>
              <Button
                variant="ghost"
                size="sm"
                icon={<X aria-hidden="true" />}
                className="min-h-11"
                onClick={clearFilters}
              >
                Quitar filtros
              </Button>
            </div>
          )}
          {geo.state === 'error' && (
            <p role="alert" className="text-sm text-ink-warn">
              {geo.message}
            </p>
          )}
          {onlyOpen && (
            <p className="text-sm text-ink-2">
              «Abierto ahora» usa el horario que publicó cada centro (hora de Panamá). Los que no publicaron horario
              quedan fuera.
            </p>
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

          <div className="grid gap-6 lg:col-start-1 lg:row-start-1">
            {loadError ? (
              <ErrorState error={centersQ.error!} onRetry={centersQ.reload} />
            ) : !centers ? (
              <Loading label="Cargando centros…" />
            ) : results.length === 0 ? (
              <EmptyState
                variant={filtersActive ? 'no-results' : 'empty'}
                title={filtersActive ? 'Ningún centro coincide con estos filtros' : 'Aún no hay centros publicados'}
                description={
                  filtersActive
                    ? 'Prueba otra provincia o quita «Abierto ahora»: muchos centros no han publicado horario.'
                    : '¿Conoces uno? Publícalo: solo necesitas tu correo.'
                }
                headingLevel={3}
                actions={
                  <>
                    {filtersActive && (
                      <Button variant="primary" onClick={clearFilters}>
                        Quitar filtros
                      </Button>
                    )}
                    <Link
                      href="/publicar"
                      className={`${buttonVariants({ variant: filtersActive ? 'secondary' : 'primary' })} no-underline`}
                    >
                      Publicar un centro
                    </Link>
                  </>
                }
              />
            ) : groups ? (
              groups.map((g) => (
                <section key={g.key} aria-labelledby={`prov-${g.key}`} className="grid gap-3">
                  <h3
                    id={`prov-${g.key}`}
                    className="flex flex-wrap items-baseline gap-x-2 border-b border-keyline pb-1 font-ui text-base font-bold text-ink"
                  >
                    {g.label}{' '}
                    <span className="text-sm font-normal text-ink-2">
                      {g.rows.length === 1 ? '1 centro' : `${g.rows.length} centros`}
                    </span>
                  </h3>
                  <CenterList rows={g.rows} meta={meta} item={item} showMap={showMap} headingLevel={4} />
                </section>
              ))
            ) : (
              <CenterList rows={results} meta={meta} item={item} showMap={showMap} />
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

function CenterList({
  rows,
  meta,
  item,
  showMap,
  headingLevel,
}: {
  rows: { c: PublicCenter; km: number | null }[];
  meta: PublicMeta | null;
  item: string;
  showMap: boolean;
  headingLevel?: 3 | 4;
}) {
  return (
    <ul
      className={
        showMap
          ? 'grid gap-4 md:grid-cols-2 2xl:grid-cols-3'
          : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
      }
    >
      {rows.map(({ c, km }) => (
        <li key={c.id} className="grid">
          <CenterCard
            center={c}
            meta={meta}
            distanceKm={km}
            highlightItem={item !== ALL ? item : null}
            headingLevel={headingLevel}
          />
        </li>
      ))}
    </ul>
  );
}
