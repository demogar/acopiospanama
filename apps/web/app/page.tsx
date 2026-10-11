import { SiteFrame } from '@/components/site-frame';
import { PublicHome } from '@/components/public/home';
import { getPublicCenters, getPublicMeta, mapTileHost } from '@/lib/public-server';

const KEY = /^[A-Z_]{2,40}$/;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = typeof sp.p === 'string' && KEY.test(sp.p) ? sp.p : null;
  const i = typeof sp.i === 'string' && KEY.test(sp.i) ? sp.i : null;
  const t = typeof sp.t === 'string' && KEY.test(sp.t) ? sp.t : null;
  const [centers, meta] = await Promise.all([getPublicCenters(), getPublicMeta()]);
  return (
    <SiteFrame>
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
