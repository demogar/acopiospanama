# Centros cargados desde fuentes públicas

Cuando una organización anuncia un centro de acopio en prensa o en sus redes y todavía nadie lo ha
publicado en el directorio, lo cargamos nosotros con `import-centers`. Cada archivo de esta carpeta es
un lote: qué se cargó, de dónde salió y cuándo.

Reglas:

- Solo centros anunciados **públicamente por la organización o por un medio**, con enlace o referencia
  en `source`. La fuente y su fecha se añaden a las notas del centro, para que cualquiera la contraste.
- **Ubicación exacta** (`lat`, `lng`) del lugar, no del barrio. Si no se puede ubicar con precisión, no se carga.
- **Sin datos personales**: nada de nombres ni teléfonos de personas.
- Si el anuncio no da horario, `schedule` va vacío y `hoursNote` lo dice («confirma antes de ir»).
- Lo que no encaja en los artículos del catálogo (abanicos, útiles escolares…) va en `notes`.
- El centro queda a nombre del correo indicado en `--email`. Es la única forma de cargar centros: ya no se
  publican ni se editan desde la web.

Cargar un lote ya fusionado en `main` (en el servidor, desde `/opt/acopiospanama`). El despliegue no copia
esta carpeta al servidor, así que el archivo se baja de GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/demogar/acopiospanama/main/data/centros/<lote>.json \
  | docker compose exec -T api node dist/cli/cli.js import-centers --email responsable@ejemplo.com
```

Los centros que ya existen (mismo nombre) se saltan, así que repetir un lote no duplica nada. Pasan por las
mismas validaciones de siempre, incluido el filtro que bloquea pedir dinero.
