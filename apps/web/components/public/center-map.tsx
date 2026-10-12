'use client';

/*
 * Mapa de centros con Leaflet y teselas de OpenStreetMap. Este módulo (y Leaflet con su CSS) solo se
 * descarga cuando alguien pulsa «Ver mapa»: por defecto la página muestra la lista y ahorra datos.
 *
 * - Los centros que en pantalla quedarían encimados se agrupan en un círculo con el número; al acercar
 *   se separan. Pulsar un grupo acerca el mapa a sus centros (o los lista, si están en el mismo sitio).
 * - Pulsar un centro abre una ficha dentro del mapa, en React (no un popup de Leaflet).
 * - Zoom: botones grandes, rueda con Ctrl/⌘ (o pellizco del trackpad), dos dedos en el teléfono, y
 *   pantalla completa, donde el mapa se mueve con un dedo y con la rueda sin teclas.
 * - Teclado: el mapa se mueve con las flechas y + / −; cada centro y grupo es un botón con nombre.
 */
import 'leaflet/dist/leaflet.css';
import './center-map.css';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type * as Leaflet from 'leaflet';
import { ArrowLeft, Expand, MapPin, Minus, Navigation, Plus, Scan, Shrink, X } from 'lucide-react';
import { buttonVariants, IconButton } from '@demogar/mola-ui';
import { NewTab } from '@/components/ui/new-tab';
import { groupMapPoints } from '@/lib/map-groups';
import {
  centerTypeShort,
  directionsLinks,
  formatKm,
  hasCoords,
  haversineKm,
  itemLabel,
  needsAt,
  organizerLabel,
  placeLine,
} from '@/lib/public-format';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';
import { OpenLine } from './open-status';

const PANAMA: [number, number] = [8.45, -80.1];
const MIN_ZOOM = 6;
const MAX_ZOOM = 18;

type Tone = 'urgent' | 'needed' | 'ok';
const TONE_LABEL: Record<Tone, string> = {
  urgent: 'Necesidades urgentes',
  needed: 'Necesita artículos',
  ok: 'Sin necesidades urgentes',
};
const RANK: Record<Tone, number> = { urgent: 0, needed: 1, ok: 2 };

function toneOf(c: PublicCenter): Tone {
  if (needsAt(c, 'URGENT').length > 0) return 'urgent';
  if (needsAt(c, 'NEEDED').length > 0) return 'needed';
  return 'ok';
}

type Located = PublicCenter & { lat: number; lng: number };
type Selection = { kind: 'center'; id: string; from?: string[] } | { kind: 'group'; ids: string[] } | null;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** «Agua, Alimentos y 3 más». */
function shortList(meta: PublicMeta | null, items: string[], max = 4): string {
  const labels = items.map((i) => itemLabel(meta, i));
  if (labels.length <= max) return labels.join(', ');
  return `${labels.slice(0, max).join(', ')} y ${labels.length - max} más`;
}

export default function CenterMap({
  centers,
  meta,
  tileHost,
  origin,
  heightClass = 'h-[min(60vh,420px)]',
}: {
  centers: PublicCenter[];
  meta: PublicMeta | null;
  tileHost: string;
  origin: { lat: number; lng: number } | null;
  /** Clases de altura del mapa (por defecto, 60 % de la pantalla hasta 420 px). */
  heightClass?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const originRef = useRef<Leaflet.LayerGroup | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [zoom, setZoom] = useState(7);
  const [selected, setSelected] = useState<Selection>(null);
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const located = useMemo(() => centers.filter((c): c is Located => hasCoords(c)), [centers]);
  const byId = useMemo(() => new Map(located.map((c) => [c.id, c])), [located]);
  // La lista llega como arreglo nuevo en cada render de la portada (p. ej. cada minuto, con la hora):
  // el mapa solo se vuelve a encuadrar cuando cambian los centros, no cuando cambia el arreglo.
  const fitKey = useMemo(
    () =>
      located
        .map((c) => c.id)
        .sort()
        .join(),
    [located],
  );

  const showHint = (text: string) => {
    setHint(text);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 1800);
  };

  /** Devuelve el foco al marcador del centro (o a su grupo) o, si ya no está, al mapa. */
  const focusMarker = (id?: string) => {
    const target = id
      ? [...(el.current?.querySelectorAll<HTMLElement>('[data-ids]') ?? [])].find((m) =>
          (m.dataset.ids ?? '').split(',').includes(id),
        )
      : null;
    (target ?? el.current)?.focus({ preventScroll: true });
  };

  const openGroup = useEffectEvent((ids: string[]) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const bounds = L.latLngBounds(ids.map((id) => [byId.get(id)!.lat, byId.get(id)!.lng] as [number, number]));
    const target = map.getBoundsZoom(bounds, false, L.point(80, 80));
    // Si acercar no los separa (mismo edificio o ya en el zoom máximo), se listan.
    if (
      map.getZoom() >= MAX_ZOOM - 1 ||
      target <= map.getZoom() ||
      bounds.getNorthEast().equals(bounds.getSouthWest())
    ) {
      setSelected({ kind: 'group', ids });
      return;
    }
    setSelected(null);
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: MAX_ZOOM - 1, animate: !reducedMotion() });
    map.once('zoomend', () => focusMarker(ids[0]));
  });

  const draw = useEffectEvent(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    // Si el foco estaba en un marcador, se recupera en el que contenga ese centro tras redibujar.
    const active = document.activeElement as HTMLElement | null;
    const focusedId = active?.dataset?.ids && el.current?.contains(active) ? active.dataset.ids.split(',')[0] : null;
    layer.clearLayers();
    const z = map.getZoom();
    const points = located.map((c) => ({ c, ...map.project([c.lat, c.lng], z) }));
    const groups = groupMapPoints(points)
      .map((g) => ({ g, x: g.reduce((s, p) => s + p.x, 0) / g.length, y: g.reduce((s, p) => s + p.y, 0) / g.length }))
      // Orden de tabulación: de arriba abajo y de izquierda a derecha, como se lee el mapa.
      .sort((a, b) => Math.round(a.y / 40) - Math.round(b.y / 40) || a.x - b.x);
    const selectedIds = selected?.kind === 'center' ? [selected.id] : selected?.kind === 'group' ? selected.ids : [];

    for (const { g, x, y } of groups) {
      const ids = g.map((p) => p.c.id);
      const tone = g.map((p) => toneOf(p.c)).sort((a, b) => RANK[a] - RANK[b])[0];
      const isSelected = ids.some((id) => selectedIds.includes(id));
      const root = document.createElement('span');
      let label: string;
      let size: number;
      if (g.length === 1) {
        const c = g[0].c;
        size = 44;
        label = `${c.name}. ${TONE_LABEL[tone]}. Ver ficha`;
        root.className = 'acp-dot';
      } else {
        size = g.length < 10 ? 40 : g.length < 100 ? 46 : 52;
        const urgent = g.filter((p) => toneOf(p.c) === 'urgent').length;
        label = `${g.length} centros aquí${urgent ? `, ${urgent} con necesidades urgentes` : ''}. Acercar`;
        root.className = 'acp-count';
        root.textContent = String(g.length);
      }
      const icon = L.divIcon({
        className: `acp-marker acp-${tone}${g.length > 1 ? ' acp-group' : ''}${isSelected ? ' is-selected' : ''}`,
        html: root,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const latlng = g.length === 1 ? L.latLng(g[0].c.lat, g[0].c.lng) : map.unproject([x, y], z);
      const m = L.marker(latlng, { icon, keyboard: true, riseOnHover: true, zIndexOffset: isSelected ? 1000 : 0 });
      const activate = () => {
        if (g.length === 1) setSelected({ kind: 'center', id: ids[0] });
        else openGroup(ids);
      };
      m.on('click', activate);
      m.on('keydown', (e: Leaflet.LeafletKeyboardEvent) => {
        // Leaflet ya responde a Enter; Espacio también activa un botón.
        if (e.originalEvent.key === ' ') {
          L.DomEvent.preventDefault(e.originalEvent);
          activate();
        }
      });
      if (g.length === 1) {
        // El nombre al pasar el ratón. Como nodo de texto: lo escribe la comunidad y nunca se trata como HTML.
        const name = document.createElement('span');
        name.textContent = g[0].c.name;
        m.bindTooltip(name, { direction: 'top', offset: [0, -14] });
      }
      m.addTo(layer);
      const node = m.getElement()!;
      node.dataset.ids = ids.join();
      node.setAttribute('aria-label', label);
      node.removeAttribute('title');
      if (g.length === 1) node.setAttribute('aria-pressed', String(isSelected));
    }
    if (focusedId) focusMarker(focusedId);
  });

  // Crear el mapa.
  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    let loaded = 0;
    import('leaflet').then((mod) => {
      if (cancelled || !el.current) return;
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      LRef.current = L;
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const map = L.map(el.current, {
        center: PANAMA,
        zoom: 7,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        zoomControl: false,
        // La rueda sin teclas mueve la página; con Ctrl/⌘ (o pellizco del trackpad) acerca. Ver onWheel.
        scrollWheelZoom: true,
        // En el teléfono, un dedo desplaza la página y dos mueven el mapa (en pantalla completa, uno basta).
        dragging: !coarse,
        zoomSnap: 0.5,
        wheelPxPerZoomLevel: 90,
        attributionControl: true,
        maxBounds: [
          [5.5, -85.5],
          [11, -75.5],
        ],
        maxBoundsViscosity: 0.8,
      });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      const tiles = L.tileLayer(`${tileHost}/{z}/{x}/{y}.png`, {
        maxZoom: MAX_ZOOM,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        // El documento usa «no-referrer»; el servicio de teselas pide saber desde qué sitio se usa. Solo se envía el origen.
        referrerPolicy: 'origin',
      });
      tiles.on('tileerror', () => {
        failures += 1;
        if (failures >= 4 && loaded === 0) setTilesFailed(true);
      });
      tiles.on('tileload', () => {
        loaded += 1;
        setTilesFailed(false);
      });
      tiles.addTo(map);
      originRef.current = L.layerGroup().addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on('zoomend', () => {
        setZoom(map.getZoom());
        draw();
      });
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [tileHost]);

  // Encuadrar cuando cambian los centros (filtros).
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    const pts = located.map((c) => [c.lat, c.lng] as [number, number]);
    if (pts.length === 1) map.setView(pts[0], 14, { animate: false });
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 14, animate: false });
    else map.setView(PANAMA, 7, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el conjunto de centros
  }, [ready, fitKey]);

  // Si el centro elegido desaparece con los filtros, se cierra la ficha.
  if (selected?.kind === 'center' && !byId.has(selected.id)) setSelected(null);
  if (selected?.kind === 'group' && selected.ids.some((id) => !byId.has(id))) setSelected(null);

  useEffect(() => {
    if (ready) draw();
  }, [ready, located, selected]);

  // Tu ubicación: solo un punto; no se encuadra en ella (las teselas pedidas revelarían tu zona).
  useEffect(() => {
    const L = LRef.current;
    const layer = originRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    if (origin)
      L.circleMarker([origin.lat, origin.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1d4ed8',
        fillOpacity: 1,
        interactive: false,
      }).addTo(layer);
  }, [ready, origin]);

  // La ficha recibe el foco al abrirse y el mapa se mueve para que el centro quede a la vista. En el
  // teléfono la ficha va debajo del mapa (encima lo taparía casi entero); en pantallas anchas y en
  // pantalla completa flota sobre el mapa, y el centro se sube por encima de ella.
  // Solo cuando cambia la selección: la lista de centros se renueva cada minuto y el mapa no debe moverse solo.
  const reveal = useEffectEvent(() => {
    const panel = panelRef.current;
    if (!selected || !panel) return;
    panel.focus({ preventScroll: true });
    const overlay = getComputedStyle(panel).position === 'absolute';
    if (!overlay) panel.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    const map = mapRef.current;
    const c = selected.kind === 'center' ? byId.get(selected.id) : undefined;
    if (map && c) {
      // Centrado en el espacio libre: si la ficha flota encima, el centro se sube la mitad de su alto.
      const lift = overlay ? panel.offsetHeight / 2 : 0;
      const point = map.project([c.lat, c.lng], map.getZoom()).add([0, lift]);
      map.panTo(map.unproject(point, map.getZoom()), { animate: !reducedMotion() });
    }
  });
  useEffect(() => reveal(), [selected]);

  // Pantalla completa: se mueve con un dedo y con la rueda; Escape sale. La página no se desplaza detrás.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (full || !coarse) map.dragging.enable();
    else map.dragging.disable();
    map.invalidateSize();
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    el.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [full, ready]);

  const close = () => {
    const id = selected?.kind === 'center' ? selected.id : selected?.kind === 'group' ? selected.ids[0] : undefined;
    setSelected(null);
    requestAnimationFrame(() => focusMarker(id));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (selected) close();
    else if (full) setFull(false);
    else return;
    e.stopPropagation();
  };

  const onWheelCapture = (e: React.WheelEvent) => {
    if (full || e.ctrlKey || e.metaKey) return;
    // Sin la tecla, la rueda es de la página: Leaflet no la recibe.
    e.stopPropagation();
    showHint(navigator.platform.startsWith('Mac') ? 'Usa ⌘ + rueda para acercar' : 'Usa Ctrl + rueda para acercar');
  };

  const onTouchMoveCapture = (e: React.TouchEvent) => {
    if (!full && e.touches.length === 1 && !mapRef.current?.dragging.enabled())
      showHint('Usa dos dedos para mover el mapa, o ábrelo en pantalla completa');
  };

  const fitAll = () => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || located.length === 0) return;
    map.fitBounds(L.latLngBounds(located.map((c) => [c.lat, c.lng] as [number, number])), {
      padding: [32, 32],
      maxZoom: 14,
      animate: !reducedMotion(),
    });
  };

  const without = centers.length - located.length;
  const current = selected?.kind === 'center' ? byId.get(selected.id) : undefined;
  const groupCenters =
    selected?.kind === 'group'
      ? selected.ids.map((id) => byId.get(id)!).sort((a, b) => RANK[toneOf(a)] - RANK[toneOf(b)])
      : [];

  return (
    <div className="grid gap-2">
      <div
        className={full ? 'fixed inset-0 z-[1100] bg-cloth-pale' : 'relative'}
        role={full ? 'dialog' : undefined}
        aria-modal={full || undefined}
        aria-label={full ? 'Mapa de centros en pantalla completa' : undefined}
        onKeyDown={onKeyDown}
        onWheelCapture={onWheelCapture}
        onTouchMoveCapture={onTouchMoveCapture}
      >
        {/* La altura va en un envoltorio: Leaflet añade sus clases al contenedor y React no debe pisarlas. */}
        <div className={`relative z-0 w-full bg-cloth-shade shadow-cut ${full ? 'h-dvh' : heightClass}`}>
          <div
            ref={el}
            role="region"
            aria-label="Mapa de centros de acopio"
            aria-describedby="acp-map-help"
            className="size-full"
          />
        </div>
        <p id="acp-map-help" className="sr-only">
          Usa las flechas para mover el mapa y las teclas más y menos para acercar o alejar. Con Tab recorres los
          centros y los grupos; Enter abre la ficha o acerca el grupo. La lista tiene los mismos centros.
        </p>

        <div className="absolute start-3 top-3 z-[1000] grid gap-1">
          <IconButton
            label="Acercar"
            variant="secondary"
            disabled={!ready || zoom >= MAX_ZOOM}
            onClick={() => mapRef.current?.zoomIn(1, { animate: !reducedMotion() })}
            className="size-11"
          >
            <Plus aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Alejar"
            variant="secondary"
            disabled={!ready || zoom <= MIN_ZOOM}
            onClick={() => mapRef.current?.zoomOut(1, { animate: !reducedMotion() })}
            className="size-11"
          >
            <Minus aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Ver todos los centros"
            variant="secondary"
            disabled={!ready || located.length === 0}
            onClick={fitAll}
            className="size-11"
          >
            <Scan aria-hidden="true" />
          </IconButton>
        </div>
        <div className="absolute end-3 top-3 z-[1000]">
          <button
            type="button"
            className={`${buttonVariants({ variant: full ? 'primary' : 'secondary', size: 'sm' })} min-h-11`}
            aria-pressed={full}
            onClick={() => setFull((f) => !f)}
          >
            {full ? <Shrink aria-hidden="true" className="size-4" /> : <Expand aria-hidden="true" className="size-4" />}
            {full ? 'Cerrar' : 'Pantalla completa'}
          </button>
        </div>

        {hint && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1000] grid place-items-center bg-ink/45 p-6 text-center font-ui text-lg font-bold text-cloth-pale"
          >
            {hint}
          </div>
        )}

        {(current || groupCenters.length > 0) && (
          <section
            ref={panelRef}
            tabIndex={-1}
            aria-labelledby="acp-map-panel-title"
            className={`bg-cloth-pale p-4 shadow-cut outline-none focus-visible:shadow-[var(--focus-ring)] ${
              full
                ? 'absolute inset-x-2 bottom-7 z-[1001] max-h-[60%] overflow-y-auto sm:inset-x-auto sm:start-3 sm:w-[24rem]'
                : 'relative mt-2 sm:absolute sm:start-3 sm:bottom-7 sm:z-[1001] sm:mt-0 sm:max-h-[75%] sm:w-[min(24rem,calc(100%-1.5rem))] sm:overflow-y-auto'
            }`}
          >
            {current ? (
              <CenterPanel
                center={current}
                meta={meta}
                origin={origin}
                onClose={close}
                back={
                  selected?.kind === 'center' && selected.from
                    ? () => setSelected({ kind: 'group', ids: selected.from! })
                    : undefined
                }
                backCount={selected?.kind === 'center' ? selected.from?.length : undefined}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h3 id="acp-map-panel-title" className="font-ui text-lg font-bold text-ink">
                    {groupCenters.length} centros en este punto
                  </h3>
                  <IconButton label="Cerrar" variant="ghost" onClick={close} className="-me-2 -mt-2 size-11">
                    <X aria-hidden="true" />
                  </IconButton>
                </div>
                <ul className="mt-2 grid">
                  {groupCenters.map((c) => (
                    <li key={c.id} className="border-t border-keyline-soft first:border-t-0">
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center gap-3 py-2 text-start text-ink hover:underline"
                        onClick={() =>
                          setSelected({ kind: 'center', id: c.id, from: (selected as { ids: string[] }).ids })
                        }
                      >
                        <span aria-hidden="true" className={`acp-swatch acp-${toneOf(c)}`} />
                        <span className="grid">
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-sm text-ink-2">{TONE_LABEL[toneOf(c)]}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Leyenda del mapa">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="acp-swatch acp-urgent" />
          Urgente
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="acp-swatch acp-needed" />
          Necesita artículos
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="acp-swatch acp-ok" />
          Sin urgencias
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-grid size-5 place-items-center rounded-full font-bold text-[10px] text-ink shadow-[0_0_0_1px_var(--ink)]"
          >
            5
          </span>
          Varios centros: pulsa para acercar
        </li>
      </ul>
      {tilesFailed && (
        <p role="status" className="text-sm text-ink-warn">
          No se pudo cargar el fondo del mapa (¿poca señal?). Los puntos y la lista siguen funcionando.
        </p>
      )}
      {without > 0 && (
        <p className="text-sm text-ink-2">
          {without === 1
            ? '1 centro no tiene ubicación en el mapa'
            : `${without} centros no tienen ubicación en el mapa`}
          ; están en la lista.
        </p>
      )}
    </div>
  );
}

/** La ficha que se abre al pulsar un centro: lo que hace falta para decidir si ir y cómo llegar. */
function CenterPanel({
  center,
  meta,
  origin,
  onClose,
  back,
  backCount,
}: {
  center: Located;
  meta: PublicMeta | null;
  origin: { lat: number; lng: number } | null;
  onClose: () => void;
  back?: () => void;
  backCount?: number;
}) {
  const urgent = needsAt(center, 'URGENT').map((n) => n.item);
  const needed = needsAt(center, 'NEEDED').map((n) => n.item);
  const organizer =
    center.organizerName && center.organizerName !== center.name
      ? center.organizerName
      : organizerLabel(meta, center.organizerType);
  const dir = directionsLinks(center, meta);
  const km = origin ? haversineKm(origin, center) : null;
  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          {back && (
            <button
              type="button"
              onClick={back}
              className="-ms-1 flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-ink underline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Los {backCount} centros de este punto
            </button>
          )}
          <h3 id="acp-map-panel-title" className="font-ui text-lg font-bold leading-snug text-ink">
            {center.name}
          </h3>
          <p className="text-sm text-ink-2">
            {centerTypeShort(meta, center.centerType)} · {organizer}
          </p>
        </div>
        <IconButton label="Cerrar la ficha" variant="ghost" onClick={onClose} className="-me-2 -mt-2 size-11 shrink-0">
          <X aria-hidden="true" />
        </IconButton>
      </div>

      <OpenLine center={center} />
      <p className="flex items-start gap-2 text-sm text-ink">
        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-2" />
        <span>
          {/* La dirección suele traer ya el lugar; si no hay, se usa «comunidad, distrito, provincia». */}
          {center.address || placeLine(meta, center)}
          {km != null && <strong className="ms-1 whitespace-nowrap font-semibold">· {formatKm(km)}</strong>}
        </span>
      </p>

      {(urgent.length > 0 || needed.length > 0) && (
        <div className="grid gap-1.5 text-sm text-ink">
          {urgent.length > 0 && (
            <p>
              <span aria-hidden="true" className="acp-swatch acp-urgent me-1.5 align-[-1px]" />
              <strong className="text-ink-danger">Urgente:</strong> {shortList(meta, urgent)}
            </p>
          )}
          {needed.length > 0 && (
            <p>
              <span aria-hidden="true" className="acp-swatch acp-needed me-1.5 align-[-1px]" />
              <strong>Necesitan:</strong> {shortList(meta, needed)}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-keyline-soft pt-3">
        <a
          href={dir.google}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonVariants({ variant: 'secondary' })} flex-1 px-4 no-underline`}
        >
          <Navigation aria-hidden="true" className="size-4" />
          Cómo llegar
          <span className="sr-only"> a {center.name}</span>
          <NewTab label="se abre en Google Maps" />
        </a>
        <Link
          href={`/c/${center.slug}`}
          className={`${buttonVariants({ variant: 'primary' })} flex-1 px-4 no-underline`}
        >
          Ver centro<span className="sr-only"> {center.name}</span>
        </Link>
      </div>
    </div>
  );
}
