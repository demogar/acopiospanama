# Despliegue y CI/CD

## Cómo fluye un cambio

```
PR (fork o rama) ─▶ CI: tipos · pruebas con PostgreSQL · build web · npm audit · CodeQL · build Docker
                       (sin secretos; los PR de forks no pueden publicar ni desplegar)
merge a main ─────▶ CI otra vez ─▶ imágenes a GHCR (latest + sha) ─▶ SSH al VPS: pull + up ─▶ /api/health
```

El servidor nunca compila: solo descarga imágenes. Por eso convive bien con otras apps en un VPS pequeño.

Producción hoy: VPS **ARM64** en Hetzner (`46.224.207.173`, Ubuntu, Docker) detrás de Cloudflare, dominio
`acopiospanama.com`. Todo vive en `/opt/acopiospanama`, propiedad del usuario `deploy`.

## Puesta en marcha (una vez)

### 1. GitHub

Todo esto ya está aplicado en `demogar/acopiospanama`; se documenta para poder reproducirlo.

1. Repo público `demogar/acopiospanama`.
2. _Settings › Rules › Rulesets_: regla «Proteger main» sobre la rama por defecto:
   - Bloquea borrar la rama y los `push --force`.
   - Exige pull request con los hilos resueltos. Mientras haya un solo mantenedor no exige aprobaciones
     (nadie puede aprobar su propio PR). Cuando haya dos o más, sube a 1 aprobación y activa la revisión
     de Code Owners en la regla.
   - Exige que pasen los checks `Lint y formato`, `API · tipos y pruebas`, `Web · tipos y build`, `Dependencias`,
     `Imágenes Docker (api)`, `Imágenes Docker (web)`, `Imágenes Docker (backup)`, `CodeQL` y `Título del PR`.
     Los nombres de los jobs en `.github/workflows/` deben mantenerse iguales a esta lista.
   - Los administradores pueden saltarse la regla en caso de emergencia. Cuando haya dos o más mantenedores,
     quita el _bypass_ para que nadie fusione sin revisión.
3. _Settings › Actions › General_:
   - Solo se permiten acciones de GitHub y de creadores verificados (`actions/*`, `github/*`, `docker/*`).
   - Permisos del `GITHUB_TOKEN` de solo lectura por defecto; cada job pide lo que necesita.
   - «Require approval for all external contributors» en los workflows de forks: ningún PR externo ejecuta
     CI hasta que un mantenedor lo apruebe.
4. _Settings › Environments › production_: solo la rama `main` puede desplegar. Ahí viven el secreto y las
   variables del despliegue, así que ninguna otra rama los ve:
   - Secret `DEPLOY_SSH_KEY`: clave privada ed25519 cuyo público está en `/home/deploy/.ssh/authorized_keys`.
   - Variables `DEPLOY_HOST` (IP), `DEPLOY_USER` (`deploy`) y `DEPLOY_KNOWN_HOSTS` (salida de
     `ssh-keyscan -t ed25519 IP`, para fijar la huella del servidor).
   - Opcionalmente añade revisores obligatorios para aprobar cada despliegue a mano.
5. Variable del repositorio `PUBLIC_URL` = `https://acopiospanama.com`: tras desplegar, el job comprueba `/api/health`.
6. _Settings › Code security_: escaneo de secretos con _push protection_, alertas de Dependabot y
   actualizaciones de seguridad automáticas. `.github/dependabot.yml` actualiza npm, acciones y Docker cada semana.
7. Las imágenes de GHCR pueden quedarse privadas: el job de despliegue inicia sesión en el servidor con su
   propio `GITHUB_TOKEN` (caduca al terminar) y cierra la sesión al acabar.
8. _Settings › General › Pull Requests_: solo _squash merge_, con el título del PR como mensaje del commit.
   Así `main` tiene historia lineal con Conventional Commits, que es lo que lee release-please.
9. Publicaciones: el workflow `release.yml` corre [release-please](https://github.com/googleapis/release-please) en
   cada push a `main`. Con el `GITHUB_TOKEN`, el PR de release no dispara la CI (limitación de GitHub) y hay que
   fusionarlo con el _bypass_ de administrador. Para que la CI corra también en ese PR, crea un token personal
   _fine-grained_ limitado a este repo con permisos _Contents_ y _Pull requests_ en escritura y guárdalo como
   secreto `RELEASE_PLEASE_TOKEN`.

### 2. Servidor

1. Ubuntu con Docker en ARM64 (las imágenes de GHCR son `linux/arm64`; en otra arquitectura, cambia el runner y
   `platforms` en `ci-cd.yml`). Usuario `deploy` (en el grupo `docker`, sin sudo) con la clave pública del punto anterior.
2. `/opt/acopiospanama/` propiedad de `deploy` con:
   - `docker-compose.yml` y `deploy/Caddyfile`, `deploy/desplegar.sh`: copias del repo, el job las refresca en cada despliegue.
   - `.env`: copia `deploy/.env.example` y complétalo (`openssl rand -hex 32` para los secretos). Modo 600.
   - `backups/`: volcados cifrados diarios.
3. Firewall: `ufw` deja 22 con límite de intentos y 80/443 solo desde los rangos de Cloudflare. Como Docker
   publica puertos saltándose `ufw`, la misma lista está en la cadena `DOCKER-USER` de iptables.
4. Primera vez, antes de que exista una imagen en GHCR, se puede construir en el servidor:
   ```bash
   git clone --depth 1 https://github.com/demogar/acopiospanama src && cd src
   docker compose --env-file /opt/acopiospanama/.env -f docker-compose.yml -f docker-compose.build.yml build
   cd /opt/acopiospanama && docker compose up -d
   ```
   Desde ahí, cada merge a `main` reemplaza las imágenes por las de GHCR y deja `IMAGE_TAG=sha-…` en `.env`.

### 3. Cloudflare

- Registro A de `acopiospanama.com` (y `www`) a la IP del VPS, con proxy activado (nube naranja).
- SSL/TLS en modo **Full (strict)**: Caddy obtiene su propio certificado de Let's Encrypt a través del proxy.
- Caddy confía en los rangos de Cloudflare (`deploy/Caddyfile`), de modo que la API recibe la IP real con
  `TRUST_PROXY=2`. Si algún día quitas Cloudflare, borra ese bloque y pon `TRUST_PROXY=1`.

### 4. Primer administrador

```bash
# En el servidor
cd /opt/acopiospanama && docker compose exec api node dist/cli/cli.js make-admin --email tu-correo@ejemplo.com
```

Entra en `/entrar` con ese correo y configura el segundo factor. Desde `/moderacion` puedes nombrar a otros
moderadores. Otros comandos: `make-moderator`, `revoke-role`, `reset-mfa`, `retention`,
`revoke-all-sessions` e `import-centers` (carga centros anunciados públicamente; ver `data/centros/README.md`).

## Despliegue sin caída

`deploy/desplegar.sh` renueva la API y la web una a una: arranca el contenedor nuevo junto al viejo
(`docker compose up --scale`), espera a que pase su healthcheck y solo entonces para y borra el viejo. Mientras
conviven, el DNS de Docker reparte entre los dos; si uno rechaza la conexión, Node (web → api) y Caddy
(Caddy → web) prueban con el otro, y Caddy además reintenta hasta 30 s antes de responder 502. Si el contenedor
nuevo no arranca, se descarta, el viejo sigue sirviendo y el job falla. Caddy nunca se recrea en un despliegue:
solo recarga el `Caddyfile`; la base de datos tampoco.

Consecuencias:

- Durante unos segundos conviven dos versiones de la API. Las migraciones deben ser compatibles con la versión
  anterior (añadir antes que quitar; nunca renombrar en un solo paso).
- Los contenedores se llaman `acopiospanama-api-N` con N creciente; es normal.
- La imagen de Caddy o de PostgreSQL se actualiza a mano, asumiendo unos segundos sin servicio:
  `docker compose pull caddy && docker compose up -d caddy`.

## Volver a una versión anterior

Cada despliegue deja en `.env` la versión exacta (`IMAGE_TAG=sha-…`). Las publicaciones añaden además la etiqueta
`vX.Y.Z` a esas mismas imágenes, así que puedes volver a cualquier versión publicada por su número:

```bash
cd /opt/acopiospanama
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=v1.2.3/' .env     # o sha-<commit>
docker compose up -d
```

Las imágenes de GHCR son privadas: si la versión anterior ya no está en el servidor, inicia sesión primero
con un token personal de solo lectura (`read:packages`) o vuelve a lanzar el workflow desde GitHub.

## Convivir con otra app en el mismo servidor

- El compose limita cada servicio: API y web, 384 MB y 0,75 CPU cada una; PostgreSQL, 256 MB; Caddy, 128 MB.
  En total son ~1,1 GB como máximo, así que caben junto a otra app.
- Otra app necesitaría su propio compose y su propia base de datos; si también quiere 80/443, comparte este
  Caddy (añade su bloque al `Caddyfile` y únela a la red) en vez de levantar otro proxy.
- La lista pública se cachea 30 s en la API y se sirve con `Cache-Control: public`. Cloudflare absorbe los picos.
- El mapa usa las teselas de OpenStreetMap, que exige atribución y no admite tráfico masivo. Si el sitio crece,
  cambia `MAP_TILE_HOST` a un proveedor propio (MapTiler, Stadia, etc.).

## Respaldos

El servicio `backup` hace un `pg_dump` diario cifrado con la clave pública `age` (`BACKUP_AGE_RECIPIENT`) en
`./backups` y conserva 14 días. Copia esos archivos fuera del servidor. La clave privada **no** está en el
servidor: guárdala en tu gestor de contraseñas. Para restaurar:

```bash
age -d -i acopio-respaldos.key backups/acopio-AAAAMMDDTHHMMSSZ.dump.age > /tmp/r.dump
docker compose exec -T db pg_restore --clean --if-exists --no-owner -U acopio -d acopio < /tmp/r.dump && rm /tmp/r.dump
docker compose exec api node dist/cli/cli.js revoke-all-sessions
```
