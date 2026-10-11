import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/alegreya/wght.css';
import '@fontsource-variable/martian-mono/wdth.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Acopio Panamá',
  description: 'Dónde están los centros de acopio en Panamá y qué necesitan hoy.',
  robots: { index: true, follow: true },
  referrer: 'no-referrer',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4efe6',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lee el nonce para que la página sea dinámica y Next aplique el nonce de la CSP a sus scripts.
  await headers();
  // Siempre en claro: el directorio se lee mejor así en cualquier teléfono y bajo el sol.
  return (
    <html lang="es-PA" data-density="spacious" data-theme="light">
      <body className="bg-cloth text-ink font-ui antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
