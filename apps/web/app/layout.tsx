import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/alegreya/wght.css';
import '@fontsource-variable/martian-mono/wdth.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { Providers } from '@/components/providers';
import { analyticsScriptUrl, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, THEME_COLOR } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['centros de acopio', 'Panamá', 'donaciones', 'terremoto', 'albergues', 'puntos de distribución'],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  referrer: 'no-referrer',
  formatDetection: { telephone: true, email: false, address: false },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'es_PA',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
  other: { 'geo.region': 'PA' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: THEME_COLOR,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El nonce hace la página dinámica y Next lo aplica a sus propios scripts; aquí también al de analítica.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const stats = analyticsScriptUrl();
  // Siempre en claro: el directorio se lee mejor así en cualquier teléfono y bajo el sol.
  return (
    <html lang="es-PA" data-density="spacious" data-theme="light">
      <body className="bg-cloth text-ink font-ui antialiased">
        <Providers>{children}</Providers>
        {/* Analítica propia sin cookies (Medama). Cuenta visitas por página; ver /privacidad. */}
        {stats && <Script src={stats} strategy="afterInteractive" nonce={nonce} />}
      </body>
    </html>
  );
}
