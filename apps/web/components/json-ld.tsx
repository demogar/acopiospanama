import { headers } from 'next/headers';

/**
 * Datos estructurados (schema.org) con el nonce de la CSP. Los bloques `ld+json` no se ejecutan,
 * pero así ningún navegador los descarta. `<` se escapa para que nadie cierre la etiqueta desde un texto.
 */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
