import { ImageResponse } from 'next/og';
import { Mark } from '@/lib/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Icono para iOS (no acepta SVG): la misma marca que `icon.svg`. */
export default function Icon() {
  return new ImageResponse(<Mark size={180} />, size);
}
