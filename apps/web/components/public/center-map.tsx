'use client';

/*
 * Mapa de centros con Leaflet y teselas de OpenStreetMap. Este módulo (y Leaflet con su CSS) solo se
 * descarga cuando alguien pulsa «Ver mapa»: por defecto la página muestra la lista y ahorra datos.
 * Los marcadores son círculos vectoriales (sin imágenes) con color y texto por urgencia.
 */
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { centerTypeShort, hasCoords, needsAt, itemLabel } from '@/lib/public-format';
import { openStatus } from '@/lib/public-schedule';
import type { PublicCenter, PublicMeta } from '@/lib/public-types';

const PANAMA: [number, number] = [8.45, -80.1];

function tone(c: PublicCenter): { color: string; label: string } {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  if (needsAt(c, 'URGENT').length > 0) return { color: v('--color-rojo', '#c0392b'), label: 'Necesidades urgentes' };
  if (needsAt(c, 'NEEDED').length > 0) return { color: v('--color-oro', '#d4a017'), label: 'Necesita artículos' };
  return { color: v('--color-anil', '#2c3e8f'), label: 'Sin necesidades urgentes' };
}

/** Leaflet asigna los strings con innerHTML: todo contenido va como nodo de texto. */
function textNode(text: string): HTMLElement {
  const el = document.createElement('span');
  el.textContent = text;
  return el;
}

function popupContent(c: PublicCenter, meta: PublicMeta | null): HTMLElement {
  // Construido con nodos de texto: el contenido lo escribe la comunidad y nunca se trata como HTML.
  const root = document.createElement('div');
  root.style.minWidth = '180px';
  const name = document.createElement('strong');
  name.textContent = c.name;
  root.appendChild(name);
  const urgent = needsAt(c, 'URGENT');
  const p = document.createElement('p');
  p.style.margin = '4px 0';
  p.textContent = urgent.length ? `Urgente: ${urgent.map((n) => itemLabel(meta, n.item)).join(', ')}` : tone(c).label;
  root.appendChild(p);
  const st = openStatus(c.schedule);
  if (st) {
    const o = document.createElement('p');
    o.style.margin = '0 0 4px';
    o.textContent = `${centerTypeShort(meta, c.centerType)} · ${st.label}`;
    root.appendChild(o);
  }
  const a = document.createElement('a');
  a.href = `/c/${encodeURIComponent(c.slug)}`;
  a.textContent = 'Ver detalles';
  root.appendChild(a);
  return root;
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
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    let loaded = 0;
    import('leaflet').then((mod) => {
      if (cancelled || !el.current) return;
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      LRef.current = L;
      const map = L.map(el.current, { center: PANAMA, zoom: 7, scrollWheelZoom: false, attributionControl: true });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      const tiles = L.tileLayer(`${tileHost}/{z}/{x}/{y}.png`, {
        maxZoom: 18,
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
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [tileHost]);

  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    const pts: [number, number][] = [];
    for (const c of centers) {
      if (!hasCoords(c)) continue;
      const t = tone(c);
      const m = L.circleMarker([c.lat as number, c.lng as number], {
        radius: 10,
        color: '#ffffff',
        weight: 2,
        fillColor: t.color,
        fillOpacity: 0.95,
      });
      m.bindPopup(() => popupContent(c, meta));
      m.bindTooltip(textNode(`${c.name} — ${t.label}`));
      m.addTo(layer);
      pts.push([c.lat as number, c.lng as number]);
    }
    if (origin) {
      L.circleMarker([origin.lat, origin.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1d4ed8',
        fillOpacity: 1,
      })
        .bindTooltip(textNode('Tú (solo en tu teléfono)'))
        .addTo(layer);
      // No se encuadra el mapa en tu posición: las teselas que se piden revelarían tu zona al servidor de mapas.
    }
    if (pts.length === 1) map.setView(pts[0], 12);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [28, 28], maxZoom: 13 });
    else map.setView(PANAMA, 7);
  }, [ready, centers, meta, origin]);

  const without = centers.filter((c) => !hasCoords(c)).length;

  return (
    <div className="grid gap-2">
      <div
        ref={el}
        role="region"
        aria-label="Mapa de centros de acopio"
        className={`relative z-0 w-full bg-cloth-shade shadow-cut ${heightClass}`}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Leyenda del mapa">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-3 rounded-full bg-rojo" />
          Urgente
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-3 rounded-full bg-oro" />
          Necesita artículos
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-3 rounded-full bg-anil" />
          Sin urgencias
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
