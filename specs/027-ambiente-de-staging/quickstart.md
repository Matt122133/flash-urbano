# Quickstart: Un ambiente de staging

**Feature**: `027-ambiente-de-staging` | **Date**: 2026-09-13

Lo que el `verify:` no puede ver. **Casi toda esta feature vive acá**: el
`verify:` compila y corre pruebas, pero no crea un entorno en Railway, no manda
un correo y no comprueba que dos bases estén separadas de verdad.

Cada paso dice **qué se mira** y **qué lo daría por fallado**. Un paso que se
recorre y no se reporta no está hecho.

---

## Q1 — La guarda existe y sabe fallar

**Antes que nada, porque decide el resto.** Se recorre en la Fase 2, **cuando
todavía no existe ningún entorno de staging**, y no lo necesita: lo que la
guarda tiene que rechazar es *cualquier* URL que no sea la de producción. Por
eso abajo va una URL de ejemplo y no la real.

Desde `web/`:

```bash
GITHUB_PAGES=true NEXT_PUBLIC_API_URL=https://flash-urbano-production.up.railway.app npm run build
```

**Se espera**: compila.

Ahora el **control positivo**, que es la mitad que importa:

```bash
GITHUB_PAGES=true NEXT_PUBLIC_API_URL=https://ejemplo-que-no-es-produccion.up.railway.app npm run build
```

**Se espera**: **falla**, con un mensaje que nombra la URL que recibió y la que
esperaba.

Y la tercera, que protege el uso normal (FR-008a):

```bash
NEXT_PUBLIC_API_URL=https://ejemplo-que-no-es-produccion.up.railway.app npm run build
```

**Se espera**: compila. Sin `GITHUB_PAGES=true` la guarda es inerte.

**Falla si**: la segunda compila. Una guarda que nunca vio rojo no distingue
"está bien" de "no está mirando".

---

## Q2 — El entorno de staging existe y arranca solo

Crear el entorno `staging` en Railway con su servicio Go y su `postgis`, con las
seis variables obligatorias y **sin** `FCM_CREDENCIAL_BASE64`.

**Se mira**: el log del primer despliegue.

**Se espera**: las nueve migraciones aplicándose en orden, desde
`migracion aplicada: 0001_esquema_inicial.sql`. La base estaba vacía y se llenó
sola.

**Falla si**: hay que correr algo a mano (FR-004), o si el servicio no arranca
por una variable faltante — en cuyo caso el log dice cuáles, todas juntas.

---

## Q3 — Los dos ambientes se distinguen desde afuera

```bash
curl -s https://flash-urbano-production.up.railway.app/salud
curl -s https://<la-url-de-staging>/salud
```

**Se espera**: `"ambiente": "production"` y `"ambiente": "staging"`.

**Falla si**: los dos dicen lo mismo, o si el campo no está.

**Dos comprobaciones de configuración en la misma pasada**, que no son de
comportamiento y por eso se miran acá y no en el Q6:

- **La cadena de conexión de staging apunta a la base de su propio entorno.** Es
  lo único que demuestra FR-002 — el aislamiento **estructural**. El Q6 prueba
  que no pasó nada; esto prueba que **no puede** pasar, y son afirmaciones
  distintas: el Q6 daría verde igual con dos schemas bien configurados.
- **`ADMIN_EMAILS` de staging tiene sólo la cuenta de Mateo** (FR-007). Se
  cargó al crear el entorno y hasta acá nadie la había vuelto a mirar.

---

## Q4 — El servicio arranca sin el nombre del ambiente

Levantar el backend local **sin** `RAILWAY_ENVIRONMENT_NAME` y pedir `/salud`.

**Se espera**: arranca, y el campo dice `desconocido`.

**Falla si**: el servicio se niega a arrancar. Eso significaría que la variable
entró como obligatoria, que es FR-022 roto y la forma conocida de dejar
producción sin arrancar.

**Control positivo barato**: moverla a `obligatoria(...)` a propósito y ver que
esta prueba se pone en rojo. Después revertir.

---

## Q5 — Se puede entrar a staging, que es donde vive el riesgo del correo

Apuntar `web/.env.local` a staging —**leyendo el archivo antes de escribirlo**,
que no está versionado— y `npm run dev`. Pedir un código de acceso.

**Se espera**: el correo **llega**, y su remitente es **distinto** del de
producción, distinguible de un vistazo.

**Falla si**: no llega. Eso es un remitente sin verificar en Resend, y significa
que **staging no tiene forma de entrar** (FR-016a). Es el fallo que no se ve
hasta este momento exacto.

---

## Q6 — El aislamiento, comprobado y no supuesto

El paso que justifica la feature entera.

1. Anotar el total de pedidos que muestra el **tablero de producción**.
2. Con la web apuntada a staging, crear un pedido, editarlo y borrar otro.
3. Volver a mirar el tablero de **producción**.

**Se espera**: el total de producción es **idéntico** (SC-002), y el pedido
creado se ve en *Mis pedidos* de staging y **no** en el de producción.

**Falla si**: cambia cualquier número de producción.

**Control positivo, para que la prueba valga algo**: comprobar que el pedido de
staging **existe** de verdad antes de afirmar que producción no lo tiene. Sin
eso, "producción no cambió" también sería cierto si el pedido no se hubiera
creado en ningún lado.

---

## Q7 — Ninguna notificación sale de staging

Con la app instalada y funcionando contra **producción**, crear un pedido en
**staging**.

**Se espera**: el teléfono **no suena**.

**Falla si**: suena. Sería `FCM_CREDENCIAL_BASE64` cargada en staging por
error, y es el peor defecto posible de esta feature: molestar a Diego con una
prueba.

---

## Q8 — La app contra staging, en un emulador

```bash
cd android && .\gradlew.bat assembleDebug -PurlDeDebug=https://<la-url-de-staging>
adb -s emulator-5554 install <apk>
```

**Se espera**: la lista trae los pedidos de staging.

**Falla si**: se usó `installDebug`, o `adb` sin `-s`. **Nunca contra un
teléfono**: mismo `applicationId` y misma firma que el release, así que pisa la
app de producción en silencio. Con dos dispositivos conectados, `installDebug`
instala en los dos.

**Se verifica antes de instalar nada** que el teléfono siga en la versión de
producción, leyéndolo — no suponiéndolo.

---

## Q9 — Saber qué está corriendo en staging

Desplegar, y después leer con el CLI la fecha del último despliegue de staging.

**Se espera**: la fecha es la de hace un momento.

**Falla si**: el procedimiento de `docs/processes/` no dice cómo hacer esto.
FR-020 no se satisface con "acordate".

---

## Q10 — El costo, medido de nuevo al cierre

Repetir la consulta de uso de la API de Railway sobre una ventana de 24 h con
staging ya andando.

**Se espera**: el total del proyecto sigue dentro de los US$5 incluidos
(SC-005).

**Falla si**: se reporta la estimación de `research.md` en vez de una medición
nueva. La de `research.md` es una extrapolación previa a que staging existiera.

---

## Q11 — Alguien más puede seguirlo

Releer el procedimiento escrito, de arriba a abajo, sin usar nada de lo que quedó
en la cabeza durante la ejecución.

**Se espera**: alcanza para levantar la web contra staging (SC-006).

**Falla si**: hay un paso que sólo funciona si ya sabías algo que no está
escrito.
