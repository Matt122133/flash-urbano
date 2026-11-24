# Quickstart: Orden de la dirección en la app

Lo que el `verify:` no prueba: que se lea bien en la pantalla.

## 1. Pruebas JVM

```bash
cd android
.\gradlew.bat assembleDebug testDebugUnitTest
```

Esperado: verde, con `TextoDeDireccionTest` entre las corridas.

## 2. Emulador contra staging

Sólo emulador y siempre con `-s` (ver `docs/processes/staging.md`, "La app
contra staging"): el APK de debug reemplaza la app real si se instala en un
teléfono.

```bash
cd android
.\gradlew.bat assembleDebug -PurlDeDebug=https://flash-urbano-staging-staging.up.railway.app
adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
```

**La web de staging no está desplegada: es la local.** Antes, dejar sin
comentar la URL de staging en `web/.env.local` (`staging.md`, "Apuntar la web
local") y levantar `web/` en `localhost:3000`; si no, el pedido se crea en
producción.

En staging, crear desde esa web un pedido con **todos** los campos en la entrega
(calle, número, apto, esquina, cooperativa) y otro con solo calle y esquina.

| Dónde | Pedido completo | Solo calle y esquina |
|---|---|---|
| Tarjeta, ENTREGA | `Calle 1234, apto 3, esq. Otra, cooperativa` | `Calle, esq. Otra` |
| Tarjeta, RETIRA | mismo orden que la entrega | — |
| Hoja de entrega | `CODIGO · Calle 1234, esq. Otra` | `CODIGO · Calle, esq. Otra` |
| Web (perfil o tablero) | el mismo texto que la tarjeta | — |

Mirar además que la línea larga no corte un botón ni empuje la acción de la
tarjeta fuera de su franja.

## 3. Publicar

Desde `master`, con el árbol limpio, después del merge:

```bash
scripts/publicar-app.sh v0.6.1 "La direccion muestra el numero de puerta antes que la esquina"
```

Diego (o Mateo) la instala con el link y confirma SC-003 mirando un pedido real.
