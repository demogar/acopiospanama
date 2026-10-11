#!/usr/bin/env bash
# Lo ejecuta GitHub Actions en el servidor (usuario `deploy`) tras publicar las imágenes.
# Recibe por stdin el token de GHCR (GITHUB_TOKEN del job: caduca al terminar el job).
# Variables: GHCR_USER, IMAGE_TAG (sha-… del commit desplegado).
#
# Despliegue sin caída: la API y la web se renuevan una a una arrancando el contenedor nuevo
# junto al viejo y retirando el viejo solo cuando el nuevo está sano. Mientras conviven, el DNS
# de Docker reparte entre los dos y, si uno rechaza la conexión, Node (web → api) y Caddy
# (Caddy → web) prueban con el otro. Si el nuevo no arranca, se descarta y el viejo sigue sirviendo.
# Caddy y la base de datos nunca se recrean aquí: Caddy solo recarga su configuración.
set -euo pipefail
cd /opt/acopiospanama

docker login ghcr.io -u "$GHCR_USER" --password-stdin > /dev/null
trap 'docker logout ghcr.io > /dev/null 2>&1 || true' EXIT

# Fijamos la versión en .env: para volver atrás basta cambiar IMAGE_TAG y hacer `docker compose up -d`.
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$IMAGE_TAG|" .env
else
  echo "IMAGE_TAG=$IMAGE_TAG" >> .env
fi

# Espera a que el contenedor pase su healthcheck (hasta 3 min). Falla si sale o queda «unhealthy».
esperar_sano() {
  local contenedor=$1 estado i
  for i in $(seq 1 90); do
    estado=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$contenedor")
    case "$estado" in
      'running healthy' | 'running ') return 0 ;;
      running\ starting) ;;
      *) echo "El contenedor $contenedor está en estado «$estado»." >&2; return 1 ;;
    esac
    sleep 2
  done
  echo "El contenedor $contenedor no pasó el healthcheck en 3 minutos." >&2
  return 1
}

# Renueva un servicio sin dejar de atender: nuevo junto al viejo, espera, retira el viejo.
renovar() {
  local servicio=$1 viejos nuevos nuevo cuantos c
  viejos=$(docker compose ps -a -q "$servicio" | sort)
  cuantos=$(printf '%s\n' "$viejos" | grep -c . || true)
  docker compose up -d --no-deps --no-recreate --scale "$servicio=$((cuantos + 1))" "$servicio"
  nuevos=$(docker compose ps -a -q "$servicio" | sort)
  nuevo=$(comm -13 <(printf '%s\n' "$viejos") <(printf '%s\n' "$nuevos"))
  if [ "$(printf '%s\n' "$nuevo" | grep -c .)" -ne 1 ]; then
    echo "No se pudo identificar el contenedor nuevo de $servicio (nuevos: $nuevo)." >&2
    return 1
  fi
  if ! esperar_sano "$nuevo"; then
    echo "::error::$servicio ($IMAGE_TAG) no arrancó; el contenedor anterior sigue sirviendo." >&2
    docker logs --tail 80 "$nuevo" >&2 || true
    docker rm -f "$nuevo" > /dev/null || true
    return 1
  fi
  for c in $viejos; do
    docker stop -t 30 "$c" > /dev/null
    docker rm "$c" > /dev/null
  done
  echo "$servicio: listo ($(docker inspect -f '{{.Name}}' "$nuevo" | sed 's|^/||'))."
}

docker compose pull --quiet api web backup

# Base de datos y respaldos: solo se crean si faltan o cambió su configuración (sin tirar de imagen).
docker compose up -d --no-deps --remove-orphans db backup

renovar api
renovar web

# Caddy no se recrea (perdería 80/443 unos segundos): recarga la configuración en caliente.
if [ -n "$(docker compose ps -q caddy)" ]; then
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
else
  docker compose up -d --no-deps caddy
fi

docker image prune -f > /dev/null
docker compose ps --format 'table {{.Service}}\t{{.Status}}'
