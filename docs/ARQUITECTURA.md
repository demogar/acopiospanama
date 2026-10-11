# Cómo funciona por dentro

## Modelo

- **Centro** (`centers`): tipo, organizador, provincia o comarca, distrito, comunidad, dirección, ubicación exacta,
  horario por día (`schedule` en jsonb), contacto público con consentimiento (`contact_consent_at`), notas y estado
  (`PUBLISHED`, `CLOSED` o `REMOVED`).
- **Qué aceptan** (`center_needs`): artículo con nivel `URGENT` (urgente), `NEEDED` (aceptan) o `ENOUGH` (ya no aceptan).
- **Responsables** (`center_managers`): personas con correo verificado que pueden editar. Hay hasta 5 por centro,
  para que no dependa de una sola persona.
- **Confirmaciones** y **reportes** de la comunidad: sin datos personales. Se guarda solo
  `origin_hmac = HMAC(clave, IP + fecha)`, que permite contar personas distintas por día sin guardar IPs.

## Reglas automáticas (`apps/api/src/centers/centers.service.ts` → `computeState`)

| Condición                                                                            | Resultado                                                |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Última actividad (confirmación de un responsable o de la comunidad) hace más de 72 h | `STALE`: «sin confirmar recientemente», baja en la lista |
| … hace más de 14 días                                                                | `EXPIRED`: no se lista                                   |
| Reportes abiertos de 2 o más personas en 72 h                                        | `flagged`: «Reportado: verifica antes de ir»             |
| 3 o más reportes graves (dinero, falso, cerrado) que superan las confirmaciones      | `COMMUNITY_HIDDEN`: oculto, la ficha responde 410        |
| Texto que pide dinero (Yappy, transferencias, cuentas, bancos, números largos)       | No se puede guardar                                      |

Corregir la ficha resuelve los reportes de información (dato equivocado, ya no recibe, otro). Los graves solo
caducan (90 días) o los descarta la moderación. Los recordatorios por correo se envían cada 48 h a los
responsables de centros sin confirmar, con un enlace firmado de un solo propósito. Ese enlace confirma o cierra
el centro con un POST, para que los antivirus de correo no lo activen solos.

## Seguridad y privacidad

- Acceso con código de un solo uso por correo, sin contraseñas. El código se guarda como HMAC, está ligado al
  navegador que lo pidió, permite 5 intentos y vence en 10 minutos. Pedirlo de nuevo reutiliza el mismo código,
  así que nadie puede bloquear tu acceso.
- Moderación con segundo factor TOTP obligatorio. Las acciones sensibles exigen confirmar de nuevo el código.
- Autorización en el servidor en cada solicitud. Lo que no corresponde responde 404.
- CSP con nonce y sin recursos externos, salvo las teselas del mapa. Cookies `__Host-` HttpOnly; protección CSRF
  con cabecera y verificación del origen.
- Auditoría de solo inserción, con identificadores y sin textos personales.
- Retención automática: cuentas sin verificar, 1 día; confirmaciones, 30 días; reportes, 90 días; centros
  inactivos o cerrados, 180 días; auditoría, 1 año.
- «Cerca de mí» se calcula en el navegador; la ubicación nunca se envía.
