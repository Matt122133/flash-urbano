#!/usr/bin/env bash
#
# Publica una version de la app del repartidor.
#
#   scripts/publicar-app.sh v0.2.0 "Que cambio en esta version"
#
# Existe porque el numero de version dejo de escribirse a mano y ahora sale del
# tag (`017`). Eso convierte al ORDEN en la parte que se puede hacer mal en
# silencio, y este script lo fija:
#
#   1. comprobar    <- todo lo que puede rechazar la publicacion pasa ANTES
#   2. crear el tag    de que nada suba, para que un rechazo no deje a medias
#   3. compilar        un tag publicado o un release vacio
#   4. verificar
#   5. publicar
#
# **El paso 1 es la razon de ser del script.** Un parrafo en un runbook que diga
# "acordate de subir el numero" no es comprobable y falla exactamente el dia que
# hay apuro, que es el dia que se publica un arreglo urgente. Un script que sale
# con error si.
#
# Corre desde la maquina donde vive la clave de firma, que es a proposito: la
# actualizacion solo entra encima de la instalada si la firma es la misma, y
# llevar esa clave a CI es una decision distinta y mas cara.
set -euo pipefail

version="${1:-}"
notas="${2:-}"

if [[ -z "$version" ]]; then
    echo "uso: $0 vX.Y.Z [notas]" >&2
    exit 2
fi

# El formato importa: de aca sale el entero que Android compara, con la cuenta
# mayor*10000 + menor*100 + parche. Ninguna parte puede pasar de 99.
if [[ ! "$version" =~ ^v[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}$ ]]; then
    echo "ERROR: '$version' no tiene la forma vX.Y.Z, con cada parte entre 0 y 99." >&2
    exit 1
fi

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"

apk="android/app/build/outputs/apk/release/app-release.apk"

# --------------------------------------------------------------------------
# 1. Comprobar, antes de que nada suba
# --------------------------------------------------------------------------

# Un arbol sucio produce un APK que no corresponde a ningun estado del
# repositorio: el tag apuntaria a un commit que no es lo que se compilo.
if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: hay cambios sin commitear. El APK no correponderia al tag." >&2
    git status --short >&2
    exit 1
fi

# **Un identificador no se reutiliza, ni siquiera si la version se retiro**
# (FR-005). Si alguien ya se bajo la que se retira, la que la reemplace tiene
# que tener un numero mayor o Android no la instala encima.
if git rev-parse -q --verify "refs/tags/$version" >/dev/null; then
    echo "ERROR: el tag $version ya existe localmente." >&2
    exit 1
fi
if git ls-remote --exit-code --tags origin "refs/tags/$version" >/dev/null 2>&1; then
    echo "ERROR: el tag $version ya existe en el remoto." >&2
    echo "Un identificador publicado no se reutiliza. Usa el siguiente." >&2
    exit 1
fi
if gh release view "$version" >/dev/null 2>&1; then
    echo "ERROR: ya hay una publicacion $version." >&2
    exit 1
fi

# --------------------------------------------------------------------------
# 2. El tag, ANTES de compilar
# --------------------------------------------------------------------------
#
# **Este orden no es cosmetico** (research D1). `gh release create` sabe crear
# el tag solo, pero lo crea **del lado del servidor**: el repo local no se
# entera. Como el numero se deriva de `git describe`, compilar antes de que el
# tag exista localmente produce un APK con el numero ANTERIOR, y nada lo avisa.
# Se comprobo asi, publicando v0.1.0 el 2026-08-31 y encontrando `git tag -l`
# vacio despues.
echo "==> Creando el tag $version"
git tag "$version"

# Si algo falla de aca en adelante, el tag local queda dando vueltas y la
# proxima corrida lo rechazaria por "ya existe". Se limpia solo.
limpiar_tag() {
    if [[ "${publicado:-no}" != "si" ]]; then
        echo "==> Algo fallo: borro el tag local $version" >&2
        git tag -d "$version" >/dev/null 2>&1 || true
    fi
}
trap limpiar_tag EXIT

# --------------------------------------------------------------------------
# 3. Compilar
# --------------------------------------------------------------------------
echo "==> Compilando el release"
(cd android && ./gradlew.bat assembleRelease)

# --------------------------------------------------------------------------
# 4. Verificar el APK
# --------------------------------------------------------------------------

herramientas="${ANDROID_HOME:-${LOCALAPPDATA:-$HOME}/Android/Sdk}/build-tools"
aapt2="$(ls -d "$herramientas"/*/aapt2* 2>/dev/null | sort | tail -1)"
if [[ -z "$aapt2" ]]; then
    echo "ERROR: no encuentro aapt2 en $herramientas" >&2
    exit 1
fi

# **Que el APK diga lo mismo que la publicacion** (FR-004). Es la unica
# comprobacion que detecta el modo de falla de D1 —compilar con un tag que el
# repo local no tiene—, y sin ella ese error publica en silencio.
declarada="$("$aapt2" dump badging "$apk" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")"
if [[ "$declarada" != "${version#v}" ]]; then
    echo "ERROR: el APK declara '$declarada' y se esta publicando '$version'." >&2
    echo "Es el sintoma de haber compilado sin el tag local. No se publica." >&2
    exit 1
fi
echo "==> El APK declara $declarada, que coincide con $version"

# Las dos comprobaciones de `012`, con el comando exacto que ya vive en
# docs/processes/app-repartidor.md. No se reescriben aca: se corren.
#
# La excepcion de texto plano existe para que `debug` le hable al backend local
# por http. Colada en `release`, la app de Diego aceptaria conexiones sin cifrar
# contra produccion — justo lo que el bloqueo de Android existe para impedir.
if "$aapt2" dump xmltree --file AndroidManifest.xml "$apk" | grep -qi "cleartext\|networkSecurityConfig"; then
    echo "ERROR: el APK de release trae la excepcion de texto plano." >&2
    exit 1
fi

# Sin firma Android **no lo instala**, y es un archivo que parece listo y no lo
# es. La huella tiene que ser siempre la misma o la actualizacion no entra
# encima de la instalada.
apksigner="$(ls -d "$herramientas"/*/apksigner* 2>/dev/null | sort | tail -1)"
if [[ -n "$apksigner" ]]; then
    huella="$("$apksigner" verify --print-certs "$apk" | sed -n 's/.*SHA-256 digest: //p' | head -1)"
    if [[ -z "$huella" ]]; then
        echo "ERROR: el APK no esta firmado. Android no lo instalaria." >&2
        exit 1
    fi
    echo "==> Firmado con la clave SHA-256 $huella"
    echo "    Tiene que ser la MISMA de siempre, o la actualizacion no entra encima."
fi

# --------------------------------------------------------------------------
# 5. Publicar
# --------------------------------------------------------------------------
echo "==> Publicando"
git push origin "$version"
gh release create "$version" "$apk" \
    --title "App repartidor ${version#v}" \
    --notes "${notas:-Sin notas.}"

publicado="si"

cat <<FIN

Listo. El link para mandarle a Diego:

  https://github.com/Matt122133/flash-urbano/releases/download/$version/app-release.apk

Y el mensaje, con el paso que evita que se trabe en un permiso:

  Che, actualizacion de la app. Toca este link, y cuando termine de bajar
  anda a Archivos -> Descargas y toca app-release.apk.
  Se instala encima, no desinstales nada.

FIN
