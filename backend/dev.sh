#!/usr/bin/env bash
#
# Levanta todo lo que el backend necesita para correr en local, en un comando:
# el motor de Docker, la base con PostGIS, y el servicio.
#
#   cd backend && ./dev.sh
#
# Existe porque el arranque manual tiene cuatro pasos y **tres de ellos fallan
# con mensajes que no dicen lo que pasa**: Docker Desktop cerrado da un error de
# named pipe, la base que todavia no termino de arrancar da "connection
# refused", y `go run` sin cargar el .env da "faltan variables de entorno
# obligatorias" — que parece un defecto del servicio y es configuracion que
# nunca se leyo.
#
# NO es para produccion. Railway usa el Dockerfile y no pasa por aca.

set -euo pipefail

cd "$(dirname "$0")"

CONTENEDOR="flash-pg-dev"
IMAGEN="postgis/postgis:17-3.5"
PUERTO_DB=55433
DOCKER_DESKTOP="/c/Program Files/Docker/Docker/Docker Desktop.exe"

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
info()  { printf '\033[36m›\033[0m %s\n' "$*"; }

# --- 1. El motor de Docker -------------------------------------------------
#
# `docker ps` contra un daemon caido tarda en rendirse, asi que se le pone un
# limite corto: lo que interesa es la respuesta binaria, no esperarla.
docker_vivo() { docker ps >/dev/null 2>&1; }

if ! docker_vivo; then
  if [ ! -x "$DOCKER_DESKTOP" ]; then
    rojo "Docker Desktop no esta corriendo y no lo encuentro en:"
    rojo "  $DOCKER_DESKTOP"
    rojo "Abrilo a mano y volve a correr este script."
    exit 1
  fi

  info "Docker Desktop esta cerrado. Abriendolo…"
  "$DOCKER_DESKTOP" >/dev/null 2>&1 &

  # Arranca la VM de Linux por debajo: tarda. Se espera con un tope para no
  # quedarse colgado para siempre si el arranque falla de verdad.
  info "Esperando a que el motor responda (puede tardar un minuto)…"
  for _ in $(seq 1 90); do
    if docker_vivo; then break; fi
    sleep 2
  done

  if ! docker_vivo; then
    rojo "El motor de Docker no respondio. Abri Docker Desktop y fijate que"
    rojo "diga 'Engine running' antes de reintentar."
    exit 1
  fi
fi
verde "✓ Docker responde"

# --- 2. La base ------------------------------------------------------------
#
# Tres estados posibles y los tres se resuelven distinto: no existe (crear),
# existe parada (arrancar), ya corriendo (no tocar). Recrearla siempre borraria
# los usuarios de prueba en cada arranque.
# El `|| echo` ingenuo no sirve: cuando el contenedor no existe, `docker
# inspect` falla Y ademas escribe una linea vacia en stdout, asi que la
# sustitucion se queda con un salto de linea pegado al valor y ningun `case`
# matchea. Se limpia el salto y se decide por vacio.
estado="$(docker inspect -f '{{.State.Status}}' "$CONTENEDOR" 2>/dev/null || true)"
estado="$(printf '%s' "$estado" | tr -d '[:space:]')"
[ -z "$estado" ] && estado="no-existe"

case "$estado" in
  running)
    verde "✓ La base ya estaba corriendo"
    ;;
  no-existe)
    info "Creando la base ($IMAGEN)…"
    # PostGIS y no Postgres pelado: la migracion 0001 hace CREATE EXTENSION
    # postgis y contra un Postgres comun falla al arrancar el servicio.
    #
    # Puerto 55433 a proposito, distinto del 55432 de las pruebas: esa se vacia
    # entera al correr los tests.
    docker run -d --name "$CONTENEDOR" \
      -e POSTGRES_PASSWORD=dev \
      -e POSTGRES_DB=flash_dev \
      -p "${PUERTO_DB}:5432" \
      "$IMAGEN" >/dev/null
    verde "✓ Base creada"
    ;;
  *)
    info "La base existe pero esta '$estado'. Arrancandola…"
    docker start "$CONTENEDOR" >/dev/null
    verde "✓ Base arrancada"
    ;;
esac

# Postgres acepta conexiones bastante despues de que el contenedor figure como
# 'running'. Sin esta espera, el servicio arranca, no puede conectarse y muere
# con un error que parece de configuracion.
info "Esperando a que Postgres acepte conexiones…"
for _ in $(seq 1 60); do
  if docker exec "$CONTENEDOR" pg_isready -U postgres -d flash_dev >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$CONTENEDOR" pg_isready -U postgres -d flash_dev >/dev/null 2>&1; then
  rojo "Postgres no respondio. Mira que paso con:"
  rojo "  docker logs $CONTENEDOR"
  exit 1
fi
verde "✓ Postgres listo en localhost:$PUERTO_DB"

# --- 3. La configuracion ---------------------------------------------------
#
# El servicio lee SOLO del entorno (FR-028): no hay godotenv ni nada que abra
# este archivo por su cuenta. `set -a` exporta todo lo que se defina hasta el
# `set +a`, que es lo que convierte el archivo en variables de entorno.
if [ ! -f .env ]; then
  rojo "Falta backend/.env. Copialo de la plantilla y completalo:"
  rojo "  cp .env.example .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a
verde "✓ Configuracion cargada desde backend/.env"

# Un aviso, no un error: se puede querer correr el servicio sin el sitio.
case "${CORS_ORIGENES:-}" in
  *localhost:3000*) ;;
  *) info "Aviso: CORS_ORIGENES no incluye http://localhost:3000, asi que el sitio local va a recibir 403." ;;
esac

# --- 4. El servicio --------------------------------------------------------
#
# Las migraciones se aplican al arrancar (research D7): una base recien creada
# queda lista sin pasos manuales.
echo
verde "Arrancando el servicio en http://localhost:${PORT:-8080}"
info "Salud:  http://localhost:${PORT:-8080}/salud"
info "Cortar: Ctrl+C   ·   La base queda viva (docker stop $CONTENEDOR para bajarla)"
echo

exec go run ./cmd/api
