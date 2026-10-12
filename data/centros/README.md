# Centros cargados desde fuentes públicas

Cuando una organización anuncia un centro de acopio en prensa o en sus redes y todavía nadie lo ha
publicado en el directorio, lo cargamos nosotros con `import-centers`. Cada archivo de esta carpeta es
un lote: qué se cargó, de dónde salió y cuándo.

Reglas:

- Solo centros anunciados **públicamente por la organización o por un medio**, con enlace o referencia
  en `source`. La fuente y su fecha se añaden a las notas del centro, para que cualquiera la contraste.
- **Ubicación exacta** (`lat`, `lng`) del lugar, no del barrio. Si no se puede ubicar con precisión, no se carga.
- **Sin datos personales**: nada de nombres ni teléfonos de personas. El contacto solo lo añade la propia
  organización desde «Mis centros».
- Si el anuncio no da horario, `schedule` va vacío y `hoursNote` lo dice («confirma antes de ir»).
- Lo que no encaja en los artículos del catálogo (abanicos, útiles escolares…) va en `notes`.
- El centro queda a nombre del correo indicado en `--email`, que puede editarlo o cerrarlo desde «Mis centros».
  Lo ideal es que la organización lo reclame después: desde «Mis centros» se pueden añadir responsables.

## Cómo se cargan: como migraciones

Cada lote es un archivo `NNN_nombre.json` (el siguiente número libre, p. ej. `007_septimo-lote.json`). Al
fusionarlo en `main`, el despliegue lo carga solo: los lotes van dentro de la imagen de la API y, al arrancar,
tras las migraciones, `import-batches` importa los que falten y los anota en la tabla `center_batches`.
Cada lote se aplica una sola vez.

- Las pruebas validan todos los lotes (formato del nombre, campos, filtro antidinero): si uno está mal, falla
  el PR y no el despliegue.
- Los centros quedan a nombre de `CENTROS_EMAIL` (en el `.env` del servidor). Si falta y hay un lote
  pendiente, la API nueva no arranca, el despliegue falla avisándolo y la versión anterior sigue sirviendo.
- Un lote ya aplicado no se edita: para corregir o añadir centros, crea un lote nuevo.
- Los centros que ya existen (mismo nombre) se saltan, así que un lote que falló a medias se reintenta en el
  siguiente arranque sin duplicar nada.

A mano, por si hace falta (en el servidor, desde `/opt/acopiospanama`):

```bash
docker compose exec -T api node dist/cli/cli.js import-centers --email responsable@ejemplo.com < lote.json
```
