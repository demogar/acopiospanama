/**
 * Teselas del mapa (Leaflet). Por defecto, Stadia Maps «Alidade Smooth»: claro y sin color, para que los marcadores
 * resalten. Stadia autoriza por dominio (sin clave en la URL): el dominio de producción debe estar registrado en su
 * panel. `MAP_TILE_HOST` permite volver a OpenStreetMap (`https://tile.openstreetmap.org`) u otro proveedor.
 */
export const DEFAULT_TILE_HOST = 'https://tiles.stadiamaps.com/tiles/alidade_smooth';

const OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Si el origen es de Stadia (por su dominio exacto, no por un texto dentro de la URL). */
function isStadia(tileHost: string): boolean {
  try {
    const host = new URL(tileHost).hostname;
    return host === 'stadiamaps.com' || host.endsWith('.stadiamaps.com');
  } catch {
    return false;
  }
}

/** Plantilla de URL y atribución para `L.tileLayer`, según el origen configurado. */
export function tileSource(tileHost: string): { url: string; attribution: string } {
  if (isStadia(tileHost)) {
    // `{r}` pide la versión @2x en pantallas de alta densidad.
    return {
      url: `${tileHost}/{z}/{x}/{y}{r}.png`,
      attribution: `© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> ${OSM}`,
    };
  }
  return { url: `${tileHost}/{z}/{x}/{y}.png`, attribution: OSM };
}
