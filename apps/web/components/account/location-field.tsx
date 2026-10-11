'use client';

import { useId, useState } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, Map as MapIcon, MapPin } from 'lucide-react';
import { Button, Callout, Input, Text } from '@demogar/mola-ui';
import { NewTab } from '@/components/ui/new-tab';
import { inPanama, mapsLink, parseMapsLocation } from '@/lib/account-geo';

const MapPicker = dynamic(() => import('./map-picker'), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse bg-cloth-shade" aria-busy="true" aria-label="Cargando mapa" />
  ),
});

/**
 * Ubicación opcional del centro: con el GPS del teléfono (si estás en el centro) o pegando un enlace
 * de Google Maps. Se lee todo en el navegador; solo se envían las coordenadas del centro al guardar.
 */
export function LocationField({
  lat,
  lng,
  onChange,
  error,
  tileHost,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  error?: string;
  tileHost: string;
}) {
  const id = useId();
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState<{ tone: 'danger' | 'warn' | 'success'; text: React.ReactNode } | null>(null);
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);

  function readLink(value: string) {
    setLink(value);
    if (!value.trim()) {
      setMsg(null);
      return;
    }
    const r = parseMapsLocation(value);
    if (r.ok) {
      onChange(r.lat, r.lng);
      setMsg({ tone: 'success', text: 'Listo: tomamos la ubicación del enlace.' });
      return;
    }
    if (r.reason === 'SHORT_LINK') {
      setMsg({
        tone: 'warn',
        text: (
          <>
            Los enlaces cortos (<code>maps.app.goo.gl</code>) no se pueden leer desde aquí. Ábrelo en el navegador,
            espera a que cargue el mapa y copia el enlace largo de la barra de direcciones (empieza con{' '}
            <code>google.com/maps</code>).
          </>
        ),
      });
    } else if (r.reason === 'OUTSIDE') {
      setMsg({ tone: 'danger', text: 'Esa ubicación queda fuera de Panamá. Revisa el enlace.' });
    } else {
      setMsg({
        tone: 'warn',
        text: 'No encontramos coordenadas en ese texto. En Google Maps, toca el punto del centro y copia el enlace de la barra de direcciones, o pega las coordenadas (ej.: 7.4012, -80.4456).',
      });
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setMsg({ tone: 'warn', text: 'Tu navegador no permite obtener la ubicación. Pega un enlace de Google Maps.' });
      return;
    }
    setLocating(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const la = Math.round(p.coords.latitude * 1e6) / 1e6;
        const ln = Math.round(p.coords.longitude * 1e6) / 1e6;
        if (!inPanama(la, ln)) {
          setMsg({
            tone: 'danger',
            text: 'Tu ubicación actual queda fuera de Panamá. Pega un enlace de Google Maps del centro.',
          });
          return;
        }
        onChange(la, ln);
        setMsg({
          tone: 'success',
          text: `Listo: ubicación tomada (precisión de unos ${Math.round(p.coords.accuracy)} m).`,
        });
      },
      (err) => {
        setLocating(false);
        setMsg({
          tone: 'warn',
          text:
            err.code === err.PERMISSION_DENIED
              ? 'No diste permiso para usar tu ubicación. Puedes permitirlo en el navegador o pegar un enlace de Google Maps.'
              : 'No pudimos obtener tu ubicación. Intenta de nuevo al aire libre o pega un enlace de Google Maps.',
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  const has = lat !== null && lng !== null;

  return (
    <fieldset className="min-w-0" aria-describedby={`${id}-help`}>
      <legend className="mb-1 font-semibold text-ink">
        Ubicación exacta{' '}
        <span aria-hidden="true" className="text-rojo">
          *
        </span>
        <span className="sr-only">(obligatoria)</span>
      </legend>
      <Text size="sm" tone="muted" id={`${id}-help`}>
        Es lo primero que busca quien quiere llevar algo. Elige una de estas tres formas.
      </Text>

      {has ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 bg-verde-soft p-3">
          <MapPin aria-hidden="true" className="size-5 shrink-0" />
          <span className="text-sm font-semibold">Ubicación elegida:</span>
          <span className="font-mono text-sm">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
          <a
            href={mapsLink(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-sm underline"
          >
            Ver en Google Maps
            <NewTab label="se abre en Google Maps" />
          </a>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          icon={<LocateFixed aria-hidden="true" />}
          loading={locating}
          onClick={useMyLocation}
        >
          Usar mi ubicación actual
        </Button>
        <Text size="sm" tone="muted">
          Úsalo solo si estás en el centro ahora mismo.
        </Text>
        <div>
          <label htmlFor={`${id}-link`} className="mb-1 block text-sm font-semibold text-ink">
            O pega un enlace de Google Maps
          </label>
          <Input
            id={`${id}-link`}
            value={link}
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://www.google.com/maps/…"
            aria-invalid={error ? true : undefined}
            onChange={(e) => readLink(e.target.value)}
          />
        </div>
        <div>
          {showMap ? (
            <MapPicker
              lat={lat}
              lng={lng}
              tileHost={tileHost}
              onPick={(la, ln) => {
                onChange(la, ln);
                setMsg(null);
              }}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              icon={<MapIcon aria-hidden="true" />}
              onClick={() => setShowMap(true)}
            >
              Elegir en el mapa
            </Button>
          )}
        </div>
        <div aria-live="polite">
          {msg && (
            <Callout tone={msg.tone} icon={false}>
              {msg.text}
            </Callout>
          )}
          {error && !msg && !has && <p className="text-sm text-ink-danger">{error}</p>}
        </div>
      </div>
    </fieldset>
  );
}
