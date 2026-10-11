'use client';

/*
 * Selector de ubicación en el mapa (Leaflet + teselas de OpenStreetMap). Se carga solo al pulsar
 * «Elegir en el mapa». Tocar el mapa coloca el marcador; también se puede arrastrar. El marcador es
 * un divIcon (sin imágenes externas). Si las teselas no cargan, los otros métodos siguen funcionando.
 */
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { inPanama } from '@/lib/account-geo';

const PANAMA: [number, number] = [8.45, -80.1];

export default function MapPicker({
  lat,
  lng,
  tileHost,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  tileHost: string;
  onPick: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markerRef = useRef<Leaflet.Marker | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [outside, setOutside] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    let loaded = 0;
    import('leaflet').then((mod) => {
      if (cancelled || !el.current) return;
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      LRef.current = L;
      const start: [number, number] = lat !== null && lng !== null ? [lat, lng] : PANAMA;
      const map = L.map(el.current, { center: start, zoom: lat !== null ? 16 : 7, scrollWheelZoom: false });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      const tiles = L.tileLayer(`${tileHost}/{z}/{x}/{y}.png`, {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
      map.on('click', (e: Leaflet.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Solo al montar: la posición se sincroniza en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileHost]);

  function place(la: number, ln: number) {
    const r = (n: number) => Math.round(n * 1e6) / 1e6;
    if (!inPanama(la, ln)) {
      setOutside(true);
      return;
    }
    setOutside(false);
    pickRef.current(r(la), r(ln));
  }

  // Marcador sincronizado con el valor (también si viene del GPS o de un enlace pegado).
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (lat === null || lng === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: '',
        html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--color-rojo,#c0392b);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const m = L.marker([lat, lng], {
        draggable: true,
        icon,
        keyboard: true,
        title: 'Ubicación del centro',
        alt: 'Ubicación del centro',
      });
      m.on('dragend', () => {
        const p = m.getLatLng();
        place(p.lat, p.lng);
      });
      m.addTo(map);
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (!map.getBounds().contains([lat, lng]) || map.getZoom() < 14)
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }, [ready, lat, lng]);

  return (
    <div className="grid gap-2">
      <div
        ref={el}
        role="region"
        aria-label="Mapa para marcar la ubicación del centro. Toca el lugar exacto."
        className="relative z-0 h-72 w-full bg-cloth-shade shadow-cut"
      />
      <p className="text-sm text-ink-2">
        Acércate con los botones + y −, y toca el lugar exacto. Puedes arrastrar el marcador.
      </p>
      <div aria-live="polite">
        {outside && <p className="text-sm text-ink-danger">Ese punto queda fuera de Panamá.</p>}
        {tilesFailed && (
          <p className="text-sm text-ink-warn">
            No se pudo cargar el mapa (¿poca señal?). Usa tu ubicación actual o pega un enlace de Google Maps.
          </p>
        )}
      </div>
    </div>
  );
}
