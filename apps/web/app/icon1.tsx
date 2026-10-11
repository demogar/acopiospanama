import { ImageResponse } from 'next/og';
import { Mark } from '@/lib/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** Icono grande en PNG para el manifest (pantalla de inicio en Android) y buscadores. */
export default function Icon() {
  return new ImageResponse(<Mark size={512} />, size);
}
