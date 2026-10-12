# Centros con fechas concretas

Fecha: 2026-10-12 · Estado: borrador para revisión

## Problema

Hoy el horario de un centro es solo semanal (`schedule`: lunes a domingo + `hours_note`). No hay forma de
decir «solo del 13 al 15 de octubre». Los centros temporales (escuelas, eventos de fin de semana, campañas
de una empresa) siguen apareciendo en el directorio cuando ya terminaron, y la gente va a un lugar que ya
no recibe. Hay que distinguir con claridad un centro **permanente** de uno **temporal**.

## Decisiones tomadas

1. Al pasar el último día, el centro **se oculta del directorio pero no se cierra ni se borra**. Su
   responsable puede reabrirlo cambiando las fechas.
2. Las fechas se expresan como **rango «desde / hasta»** que se combina con el horario semanal existente
   (el horario dice a qué hora; el rango dice qué días cuentan).
3. Un centro que **aún no empieza** se muestra en el directorio con «Abre el 14 de oct» y no cuenta como
   «Abierto ahora» hasta ese día.
4. Los **centros ya publicados** que reciben en días concretos se migran: se identifican, el usuario
   confirma la lista y se aplica en el mismo cambio.
5. Enfoque: **dos columnas opcionales y visibilidad calculada al consultar** (sin tarea programada ni
   estado nuevo en la base). Se descartaron un estado `ENDED` persistido por la tarea diaria (más piezas,
   retraso hasta que corre la tarea) y meter las fechas dentro del JSON de `schedule` (difícil de filtrar
   y validar).

## Datos y reglas

### Base de datos

Migración `apps/api/migrations/005_fechas_de_centros.sql`:

- `ALTER TABLE centers ADD COLUMN available_from date, ADD COLUMN available_until date;`
- `CHECK (available_from IS NULL OR available_until IS NULL OR available_from <= available_until)`.
- Los `UPDATE … WHERE slug = …` de los centros existentes (ver «Centros ya publicados»).

Semántica:

- Ambas vacías → **permanente**, se comporta como hoy.
- Alguna con valor → **temporal**. Se admite una sola («desde el 14», «hasta el 20»).
- Las fechas son días calendario en **hora de Panamá (UTC−5)**. El día `available_until` cuenta completo
  hasta las 23:59; el centro termina a las 00:00 del día siguiente.

`apps/api/src/db/types.ts`: `availableFrom: string | null`, `availableUntil: string | null` (cadenas
`YYYY-MM-DD`; se configura el parser de `date` de `pg` para que no las convierta a `Date` con zona).

### Utilidad compartida de fechas

En `apps/api/src/domain.ts` (y su copia en `apps/web/lib/public-schedule.ts`):

- `panamaToday(at = new Date()): string` → `YYYY-MM-DD` en hora de Panamá.
- `dateWindow(from, until, at): 'BEFORE' | 'ACTIVE' | 'ENDED' | 'ALWAYS'`.

### Visibilidad

`computeState` (`apps/api/src/centers/centers.service.ts`) recibe `availableUntil` y gana el valor
`ENDED` en `Visibility`:

- Orden de evaluación: `REMOVED` → `CLOSED` → **`ENDED`** (si `availableUntil < panamaToday(now)`) →
  `COMMUNITY_HIDDEN` → `VISIBLE`.
- `status` en la base sigue siendo `PUBLISHED`.
- `publicList` ya filtra `visibility === 'VISIBLE'`, así que los terminados salen del listado, del mapa y
  del sitemap sin más cambios. Caché de 30 s: como mucho tarda eso en desaparecer.
- **Reabrir**: el responsable cambia las fechas; si `availableUntil` queda vacío o en el futuro, vuelve a
  `VISIBLE` al instante (la caché pública se invalida como en cualquier edición).

### «Abierto ahora»

`openNow(schedule, at, window?)`: si el centro está en `BEFORE` o `ENDED` devuelve `false`; en `ACTIVE`
o `ALWAYS` aplica el horario semanal como hoy. Un tramo que cruza la medianoche del último día solo cuenta
hasta las 00:00 del día siguiente (el día ya no está en el rango).

### API

- `PublicCenter` y la respuesta de «Mis centros» ganan `availableFrom` y `availableUntil`
  (`"2026-10-13"` o `null`). Cambio aditivo en `/api/public/centers`.
- Crear y editar centro aceptan ambos campos. Validación en `centers.service.ts` junto a la del horario:
  formato `YYYY-MM-DD`, fecha real, `from ≤ until`. Mensajes en español claro:
  «La fecha final es anterior a la inicial».
- No se rechaza guardar una fecha final ya pasada desde la edición (el responsable puede estar
  corrigiendo datos); el centro simplemente queda `ENDED`.

## Web

### Directorio

- `components/public/open-status.tsx` (`OpenStatusBadge`) añade una etiqueta de fechas:
  - `BEFORE` → «Abre el 14 de oct».
  - `ACTIVE` con `availableUntil` → «Del 13 al 15 de oct» (o «Solo hasta el 15 de oct» si no hay inicio).
  - `ACTIVE` solo con inicio, o `ALWAYS` → sin etiqueta.
- Se ve en tarjetas (`center-card.tsx`), popup del mapa (`center-map.tsx`) y ficha.
- Ficha (`center-detail.tsx`): encima de `ScheduleTable`, «Solo recibe donaciones del 13 al 15 de
  octubre» (variantes para un solo extremo).
- Filtro «Abierto ahora» (`home.tsx`): usa el `openNow` nuevo.
- Enlace directo a un centro `ENDED`: se muestra con `hidden-center.tsx`, con el texto «Este centro
  recibió donaciones hasta el 15 de octubre». Los enlaces compartidos no se rompen.
- SEO (`seo.ts`): `openingHoursSpecification` con `validFrom` / `validThrough` cuando hay fechas.

### Formulario (publicar y editar)

En `components/account/center-fields.tsx`, encima de `ScheduleEditor`:

- Pregunta «¿Hasta cuándo recibe?» con dos opciones: «Siempre, hasta nuevo aviso» (predeterminada) y
  «Solo unos días».
- Con «Solo unos días» aparecen «Desde» y «Hasta» (`input type="date"`, ambos opcionales pero al menos
  uno requerido). Errores en `error-summary.tsx` como el resto del formulario.
- Volver a «Siempre» limpia ambas fechas.

### Mis centros

- `VISIBILITY_INFO.ENDED` en `lib/account-types.ts`: etiqueta «Terminó», tono `neutral`, ayuda
  «Ya pasó su última fecha y no se muestra en el directorio. Si vuelves a recibir, cambia las fechas.».
- En la ficha del responsable, un `Callout` con ese mensaje y la fecha («Terminó el 15 de oct»), y un
  botón al formulario de edición.

## Lotes JSON

- `entrySchema` (`apps/api/src/cli/import-centers.ts`) acepta `availableFrom` y `availableUntil`
  opcionales (`YYYY-MM-DD`).
- `apps/api/test/lotes.test.ts` valida formato y orden. No compara con la fecha de hoy: el test debe
  seguir pasando con lotes antiguos cuyos centros ya terminaron. Los lotes ya aplicados no se editan.
- El README de `data/centros` documenta los dos campos.

## Centros ya publicados

1. Se descargan los centros de `/api/public/centers` y se buscan en `schedule`, `hoursNote` y
   `description` menciones a fechas o días concretos («13 al 15», «solo sábado», «hasta el…», nombres de
   meses, «este fin de semana»).
2. Se presenta al usuario una tabla: centro (slug), texto que lo delata, fechas propuestas, y si quedaría
   oculto al desplegar. Los dudosos se marcan como tales.
3. Con la lista confirmada, `005_fechas_de_centros.sql` añade un `UPDATE centers SET available_from = …,
   available_until = … WHERE slug = '…'` por centro. Se usa el slug porque los ids cambian entre entornos;
   en una base sin ese centro el `UPDATE` no hace nada.
4. Los centros que ya terminaron quedan ocultos al desplegar, que es el efecto buscado.

## Pruebas

- `openNow` / `dateWindow`: antes del rango, dentro, último día a las 23:59, día siguiente a las 00:00 (hora
  de Panamá), solo inicio, solo fin, tramo que cruza la medianoche en el último día.
- `computeState`: `ENDED`, prioridad frente a `CLOSED` y `COMMUNITY_HIDDEN`, reapertura al cambiar fechas.
- API: validación de formato y orden; `publicList` omite los `ENDED`; «Mis centros» los incluye con
  `visibility: 'ENDED'`; editar fechas los devuelve a `VISIBLE`.
- Lotes: el test de lotes cubre los campos nuevos.
- Web: si hay tests de componentes, cubrir las etiquetas; si no, verificación manual en local (tarjeta,
  ficha, filtro, formulario, «Mis centros») con Chrome DevTools en escritorio y móvil.

## Despliegue

Un solo PR con migración, API, web, lotes y la lista de centros migrados. La migración solo añade columnas
que admiten nulos y `UPDATE`s acotados por slug; no bloquea ni requiere pasos manuales.

## Fuera de alcance

- Varios rangos por centro o fechas sueltas con horario propio.
- Recordatorios al responsable antes de que termine su rango.
- Cerrar automáticamente (`CLOSED`) los centros terminados.
