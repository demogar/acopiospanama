import type { Metadata } from 'next';
import { JsonLd } from '@/components/json-ld';
import { SiteFrame } from '@/components/site-frame';
import { PublicHome } from '@/components/public/home';
import { centerTypeShort } from '@/lib/public-format';
import { getPublicCenters, getPublicMeta, mapTileHost } from '@/lib/public-server';
import { CENTER_TYPE_PLURAL, pageMeta, siteJsonLd } from '@/lib/seo';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const KEY = /^[A-Z_]{2,40}$/;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function filters(searchParams: Props['searchParams']) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === 'string' && KEY.test(sp[k]) ? sp[k] : null);
  return { p: pick('p'), i: pick('i'), t: pick('t') };
}

/**
 * Título y descripción según el filtro: «Centros de acopio en Chiriquí» tiene su propia entrada en los
 * buscadores y en el sitemap. Solo la provincia cuenta para la canónica; tipo y artículo son variantes.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { p, t } = await filters(searchParams);
  const [centers, meta] = await Promise.all([getPublicCenters(), getPublicMeta()]);
  const m = meta.ok ? meta.data : null;
  const province = p && m?.provinces[p] ? m.provinces[p] : null;
  const typeKnown = !!t && !!(m?.centerTypes?.[t] ?? CENTER_TYPE_PLURAL[t]);
  const path = province ? `/?p=${p}` : '/';
  if (!province && !typeKnown) return pageMeta({ path });

  const what = typeKnown ? (CENTER_TYPE_PLURAL[t!] ?? centerTypeShort(m, t!)) : 'Centros de acopio';
  const where = province ?? 'Panamá';
  const count = centers.ok
    ? centers.data.filter((c) => (!province || c.province === p) && (!typeKnown || c.centerType === t)).length
    : 0;
  const head = count ? `${count} ${count === 1 ? 'lugar activo' : 'lugares activos'}` : what;
  const title = `${what} en ${where}`;
  // La portada está en el mismo segmento que el layout raíz: la plantilla «%s · Acopio Panamá» no le llega.
  return pageMeta({
    absoluteTitle: `${title} · ${SITE_NAME}`,
    ogTitle: title,
    description: `${head} en ${where}: qué aceptan, qué es urgente, horario y cómo llegar. Información confirmada por la comunidad tras el terremoto.`,
    path,
  });
}

export default async function Home({ searchParams }: Props) {
  const { p, i, t } = await filters(searchParams);
  const [centers, meta] = await Promise.all([getPublicCenters(), getPublicMeta()]);
  return (
    <SiteFrame width="wide">
      <JsonLd data={siteJsonLd(`${SITE_URL}/`)} />
      <PublicHome
        initialCenters={centers.ok ? centers.data : null}
        initialMeta={meta.ok ? meta.data : null}
        initialProvince={p}
        initialItem={i}
        initialType={t}
        tileHost={mapTileHost()}
      />
    </SiteFrame>
  );
}
