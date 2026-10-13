/**
 * La marca de Acopio Panamá: un marcador de mapa con una caja dentro («aquí hay un centro de acopio»).
 * Una sola definición (32 × 32) para la cabecera, el pie, el favicon (`app/icon.svg`) y las imágenes de `lib/og.tsx`.
 * Sin cruces ni «+»: no debe confundirse con el emblema protegido de la Cruz Roja.
 */
export const BRAND_MARK = {
  colors: { fondo: '#c8102e', pin: '#f6f7f2', caja: '#1d1a16' },
  /** Cabeza redonda (centro 16,13, radio 9) que termina en punta en 16,28. */
  pin: 'M16 28 8.8 18.4A9 9 0 1 1 23.2 18.4Z',
  caja: { x: 12.5, y: 9.5, size: 7 },
} as const;

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  const { colors, pin, caja } = BRAND_MARK;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" fill={colors.fondo} />
      <path d={pin} fill={colors.pin} />
      <rect x={caja.x} y={caja.y} width={caja.size} height={caja.size} fill={colors.caja} />
    </svg>
  );
}
