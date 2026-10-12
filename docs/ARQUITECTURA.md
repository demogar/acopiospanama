# Cómo funciona por dentro

## Modelo

- **Centro** (`centers`): tipo, organizador, provincia o comarca, distrito, comunidad, dirección, ubicación exacta,
  horario por día (`schedule` en jsonb), contacto público con consentimiento (`contact_consent_at`), notas y estado
  (`PUBLISHED`, `CLOSED` o `REMOVED`).
- **Qué aceptan** (`center_needs`): artículo con nivel `URGENT` (urgente), `NEEDED` (aceptan) o `ENOUGH` (ya no aceptan).
- **Responsables** (`center_managers`): personas con correo verificado que pueden editar. Hay hasta 5 por centro,
  para que no dependa de una sola persona.
- **Co-responsables por invitación**: no tienen acceso hasta aceptar. Solo quien lleva más tiempo como
  responsable puede quitar a otro, y no se puede quitar al último.
- **Confirmaciones** y **reportes** de la comunidad: sin datos personales. Se guarda solo un `origin_hmac`
  con clave propia, que permite contar personas distintas sin guardar IPs. Las IPv6 se agrupan por /64.
- **Autoría**: el centro guarda el HMAC del correo de quien lo creó (no el correo). Así el límite diario y el
  bloqueo por moderación siguen funcionando aunque la persona borre su cuenta.

## Reglas automáticas (`apps/api/src/centers/centers.service.ts` → `computeState`)

| Condición                                                                                      | Resultado                                         |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Reportes abiertos de 2 o más personas en 72 h                                                  | `flagged`: «Reportado: verifica antes de ir»      |
| 3 o más reportes graves (dinero, falso, se aprovechan, cerrado) que superan las confirmaciones | `COMMUNITY_HIDDEN`: oculto, la ficha responde 410 |
| Un responsable confirma después del último reporte grave                                       | Vuelve a verse, marcado «en disputa»              |
| Reporte «publicaron mis datos sin permiso»                                                     | El contacto se oculta de inmediato                |
| Texto que pide dinero (Yappy, transferencias, cuentas, bancos, números largos)                 | No se puede guardar                               |
| Texto con enlaces o HTML                                                                       | No se puede guardar                               |

El filtro de texto normaliza antes de comparar (NFKC, letras de otros alfabetos que se parecen, espacios
intercalados como «Y a p p y»), así que no basta con disfrazar la palabra. Los teléfonos panameños sí se
permiten. El error se devuelve por campo para que la web marque exactamente qué corregir.

Los reportes y confirmaciones cuentan personas distintas: las confirmaciones, una por persona y día; los
reportes, una por persona y centro, sin importar el día. Para el aviso «reportado» cuentan los de las últimas
72 h. Para ocultar, cuentan los graves que sigan abiertos.

Corregir la ficha resuelve los reportes de información (dato equivocado, ya no recibe, otro). Los graves solo
caducan (90 días) o los descarta la moderación.

Los centros no caducan por falta de confirmaciones: hay pocas personas manteniendo el directorio, así que lo
publicado se da por bueno hasta que su responsable lo cierre o la comunidad lo reporte. Ya no se envían
recordatorios por correo. Los enlaces firmados de correos anteriores siguen sirviendo hasta que vencen (72 h):
confirman o cierran el centro con un POST, para que los antivirus de correo no lo activen solos.

## Seguridad y privacidad

- Acceso con código de un solo uso por correo, sin contraseñas. El código se guarda como HMAC, está ligado al
  navegador que lo pidió, permite 5 intentos por navegador y 15 en total, y vence en 10 minutos. Pedirlo de nuevo reutiliza el mismo código,
  así que nadie puede bloquear tu acceso.
- Moderación con segundo factor TOTP obligatorio. Las acciones sensibles exigen confirmar de nuevo el código.
  Tras 10 códigos incorrectos, el segundo factor se bloquea 15 minutos.
- Autorización en el servidor en cada solicitud. Lo que no corresponde responde 404.
- CSP con nonce y sin recursos externos, salvo las teselas del mapa y el script de la analítica propia (Medama, sin cookies). Cookies `__Host-` HttpOnly; protección CSRF
  con cabecera y verificación del origen.
- Auditoría de solo inserción, con identificadores y sin textos personales.
- Retención automática: cuentas sin verificar, 1 día; confirmaciones, 30 días; reportes, 90 días; centros
  inactivos o cerrados, 180 días; correos bloqueados (HMAC) y auditoría, 1 año.
- «Cerca de mí» se calcula en el navegador; la ubicación nunca se envía.
