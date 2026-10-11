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
- El centro queda a nombre del correo indicado en `--email`, que recibe los recordatorios de confirmación.
  Lo ideal es que la organización lo reclame después: desde «Mis centros» se pueden añadir responsables.

Cargar un lote (en el servidor, desde `/opt/acopiospanama`):

```bash
docker compose exec -T api node dist/cli/cli.js import-centers --email responsable@ejemplo.com < lote.json
```

Los centros que ya existen (mismo nombre) se saltan, así que repetir un lote no duplica nada. Pasan por las
mismas validaciones que el formulario de publicar, incluido el filtro que bloquea pedir dinero.
