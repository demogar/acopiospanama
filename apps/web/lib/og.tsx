import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_HOST, SITE_NAME } from './site';

/**
 * Imágenes para compartir (Open Graph) e iconos generados con `next/og` (Satori).
 * Satori no lee woff2, por eso las fuentes van en `assets/fonts` en woff (Archivo, licencia OFL).
 */

export const OG_SIZE = { width: 1200, height: 630 };

/** Colores del tema claro de Mola UI (los mismos que ve la gente en el sitio). */
const C = {
  ink: '#14161a',
  ink2: '#3d4147',
  cloth: '#edeee8',
  pale: '#f6f7f2',
  rojo: '#c0272d',
  oro: '#edb01f',
};

/** Colores del favicon (`app/icon.svg`), para que todos los iconos sean iguales. */
const MARK = { ink: '#1d1a16', rojo: '#c8102e', oro: '#f2b400' };

/** La marca: cuadrados concéntricos, igual que `app/icon.svg` (32 × 32). */
export function Mark({ size }: { size: number }) {
  const u = size / 32;
  return (
    <div style={{ width: size, height: size, background: MARK.ink, display: 'flex', padding: 5 * u }}>
      <div style={{ flexGrow: 1, background: MARK.rojo, display: 'flex', padding: 4 * u }}>
        <div style={{ flexGrow: 1, background: MARK.oro, display: 'flex', padding: 4 * u }}>
          <div style={{ flexGrow: 1, background: MARK.ink }} />
        </div>
      </div>
    </div>
  );
}

// Rutas literales desde `process.cwd()` (apps/web, también en el `standalone`): así Next las incluye en la traza.
async function fonts() {
  const [medium, bold] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/archivo-500.woff')),
    readFile(join(process.cwd(), 'assets/fonts/archivo-700.woff')),
  ]);
  return [
    { name: 'Archivo', data: medium, weight: 500 as const, style: 'normal' as const },
    { name: 'Archivo', data: bold, weight: 700 as const, style: 'normal' as const },
  ];
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export interface OgCard {
  /** Línea pequeña sobre el título (tipo de centro). */
  kicker?: string;
  title: string;
  /** Líneas secundarias (lugar, horario de hoy). */
  lines?: string[];
  /** Etiquetas destacadas (necesidades urgentes). */
  chips?: string[];
  /** Fondo de las etiquetas: rojo para urgente, oro para «necesitan». */
  chipTone?: 'rojo' | 'oro';
}

/** Tarjeta 1200 × 630 con la marca, el texto y el pie con el dominio. */
export async function ogImage(card: OgCard) {
  const title = clip(card.title, 90);
  const lines = (card.lines ?? []).filter(Boolean).map((l) => clip(l, 110));
  const chips = (card.chips ?? []).slice(0, 4).map((c) => clip(c, 28));
  const chipBg = card.chipTone === 'oro' ? C.oro : C.rojo;
  const chipFg = card.chipTone === 'oro' ? C.ink : C.pale;
  const titleSize = title.length > 56 ? 56 : title.length > 32 ? 66 : 78;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: C.cloth,
        color: C.ink,
        fontFamily: 'Archivo',
        fontWeight: 500,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '52px 64px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 32, fontWeight: 700 }}>
          <Mark size={40} />
          <span>{SITE_NAME}</span>
        </div>
        {card.kicker && (
          <div
            style={{
              marginTop: 40,
              fontSize: 26,
              fontWeight: 700,
              color: C.rojo,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            {card.kicker}
          </div>
        )}
        <div
          style={{
            marginTop: card.kicker ? 10 : 44,
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        {lines.map((l, i) => (
          <div key={i} style={{ marginTop: i === 0 ? 22 : 10, fontSize: 32, color: C.ink2, lineHeight: 1.25 }}>
            {l}
          </div>
        ))}
        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>
            {chips.map((c) => (
              <div
                key={c}
                style={{ background: chipBg, color: chipFg, padding: '8px 18px', fontSize: 28, fontWeight: 700 }}
              >
                {c}
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 64px',
          background: C.ink,
          color: C.pale,
          fontSize: 26,
        }}
      >
        <span style={{ fontWeight: 700 }}>{SITE_HOST}</span>
        <span>Confirma con el centro antes de ir</span>
      </div>
    </div>,
    { ...OG_SIZE, fonts: await fonts() },
  );
}
