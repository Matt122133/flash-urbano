# Research: La app de Diego

**Feature**: `012-app-repartidor` | **Fecha**: 2026-08-23

Lo que se averiguó antes de planificar, con lo descartado. D1..D11.

---

## D1 — Se puede construir todo desde la sesión, y eso no era obvio

**Hallazgo**, comprobado y no supuesto:

| | |
|---|---|
| Android Studio + su JDK propio (JBR 21) | `C:\Program Files\Android\Android Studio\jbr` |
| SDK con `android-36`, build-tools 35 y 36, NDK | `%LOCALAPPDATA%\Android\Sdk` |
| Emuladores ya creados | `Medium_Phone`, `Medium_Phone_API_36.0` |
| **Distribuciones de Gradle ya descargadas** | 8.13 y 9.0.0, en `~/.gradle/wrapper/dists` |

**Lo último es lo que cambia el plan.** Sin una distribución de Gradle habría que
crear el proyecto con el asistente de Android Studio —a mano, por una persona—
porque el `gradle-wrapper.jar` es un binario que no se escribe a mano. Con
Gradle 8.13 disponible, **el esqueleto se genera desde la sesión** y el wrapper
sale de `gradle wrapper`.

**Decisión**: el proyecto se crea desde la sesión, no con el asistente.

**Lo que sigue sin poder hacerse desde acá**: probar en el teléfono de Diego.
El emulador cubre casi todo; lo que no cubre es el tamaño real de la pantalla en
su mano y su versión de Android (ver D3).

---

## D2 — Dónde vive la app

**Decisión**: `android/`, en la raíz del repo, hermano de `web/` y `backend/`.

**Rationale**: el repo ya es de dos superficies y `ARCHITECTURE.md` las trata
así. Una tercera carpeta hermana es la extensión obvia. Anidarla dentro de
`backend/` o `web/` sugeriría una dependencia que no existe: la app habla con el
servicio por HTTP, igual que el sitio.

**Consecuencia para el harness**: `covers:` gana un directorio que **todavía no
existe**, y el `.gitignore` de la raíz necesita las salidas de compilación de
Gradle. Ese archivo **no está entre los exentos del sensor**, así que va en
`covers:` explícitamente.

---

## D3 — Hasta qué Android soporta, y el dato que falta

**Decisión**: `minSdk = 26` (Android 8.0, 2017), `targetSdk = 36`.

**Rationale**: 26 cubre prácticamente cualquier teléfono en uso y evita las
concesiones que piden las versiones viejas. `targetSdk` alto porque no se publica
en tienda y no hay política de plazos que cumplir.

**El dato que falta, y hay que conseguirlo antes de entregar el APK**: **nadie
sabe qué versión de Android tiene el teléfono de Diego.** Si fuera anterior a 8,
la app no instala y el defecto aparece en el peor momento — con él esperando.
Se comprueba en un minuto (Ajustes → Acerca del teléfono) y **está en el
quickstart como paso previo**.

---

## D4 — Cómo habla con el servicio

**Decisión**: OkHttp + `kotlinx.serialization`. Sin Retrofit.

**Rationale**: son **dos** llamadas —traer la lista, cambiar un estado— más el
ingreso. Retrofit resuelve el problema de tener veinte endpoints tipados; acá
sumaría una capa y un procesador de anotaciones para ahorrar treinta líneas.
Principio III.

**Alternativa descartada**: Ktor client. Igual de válida; OkHttp gana porque ya
viene en el árbol de dependencias de Android y es lo que menos agrega.

---

## D5 — A qué servicio apunta la app

**Decisión**: por tipo de compilación.

| Compilación | URL | Por qué |
|---|---|---|
| `debug` | `http://10.0.2.2:8080` | Es como el emulador ve `localhost` de la máquina |
| `release` | `https://flash-urbano-production.up.railway.app` | Es el APK que se instala en el teléfono de Diego |

**Y una trampa que hay que resolver a propósito**: Android **bloquea el tráfico
sin cifrar** desde API 28. El backend local es `http://`, así que `debug`
necesita una excepción de texto plano — **limitada a `debug`**. Si esa excepción
se cuela en `release`, la app quedaría aceptando conexiones sin cifrar contra
producción, que es exactamente lo que el bloqueo existe para impedir.

---

## D6 — Dónde se guarda la sesión

**Decisión**: `DataStore` de Preferences, con la credencial como única clave.

**Rationale**: es el reemplazo actual de `SharedPreferences` y no arrastra la API
vieja. El almacenamiento de la app ya está cifrado por el sistema mientras el
teléfono esté bloqueado, que es la protección real (FR-016).

**Alternativa descartada**: `EncryptedSharedPreferences`. Agrega una dependencia
y una capa de cifrado sobre algo que el sistema ya cifra, para un teléfono que si
está desbloqueado deja ver la app entera igual. Sería sensación de seguridad, no
seguridad.

---

## D7 — La renovación de la sesión

**Hallazgo**: `SesionPorDefecto` son 4 semanas fijas (`config.go:26`), y hoy la
sesión **no se renueva al usarse**: se emite con su vencimiento y se muere ahí.

**Decisión**: renovación deslizante, **con umbral**. Al validar una sesión, si le
queda menos de la mitad de su vida, se le extiende el vencimiento.

**Rationale del umbral**: renovar en cada petición sería un `UPDATE` por request
sobre la tabla más caliente, para ganar nada — la diferencia entre renovar hoy y
renovar en dos semanas es invisible para quien la usa. Con el umbral, quien entra
todos los días **nunca ve una pantalla de ingreso** (US3) y la base escribe una
vez cada dos semanas.

**Esto vale también para la web**, y es correcto que valga: es la misma sesión y
el mismo problema. No se construye una renovación "para la app".

---

## D8 — El camino que escribe el estado

**Decisión**: `PATCH /admin/pedidos/{id}/estado`, cuerpo `{"estado": "..."}`.

- **`PATCH` y no `POST`**: modifica un recurso que existe, y no crea nada.
- **Idempotente por construcción** (FR-009): manda el estado **destino**, no una
  transición. Repetir "entrega" deja el pedido igual; mandar "una transición"
  obligaría a llevar la cuenta de dónde venía.
- **Acepta cualquiera de los tres estados, en cualquier dirección** (FR-004). No
  hay máquina de estados que impida volver atrás: la reversión es un requisito,
  no un accidente.
- **Rechaza cualquier otro valor.** El estado es texto con `CHECK` en la base;
  el handler no puede confiar en que el `CHECK` dé un mensaje legible.
- **Protegido por lo mismo que `GET /admin/pedidos`**: credencial y
  `ADMIN_EMAILS`.

---

## D9 — El historial de estados

**Decisión**: tabla nueva `pedidos_estados` (pedido, estado, cuándo), y una fila
por cambio. Migración `0005`.

**Rationale**: es lo único que este feature agrega al modelo. Una columna
`estado_anterior` en `pedidos` no serviría — con reversiones, la historia tiene
más de un paso.

**No se purga.** A diferencia de `rastro`, que se borra a los 90 días porque son
datos personales que crecen rápido, esto son tres filas por pedido y es
justamente el dato que se quiere tener cuando alguien reclama meses después.

**No se muestra en ningún lado** (FR-014). Se escribe y se guarda.

**Y una decisión sobre el arranque**: los pedidos que ya existen **no reciben una
fila de "creación" hacia atrás**. Inventarla sería fabricar un momento que nadie
observó; el historial empieza cuando empieza.

---

## D10 — Qué prueba el `verify:`, y qué no

**Decisión**: `verify:` cubre **las tres** superficies, y la de Android sólo
compila y corre pruebas de JVM.

```
web (lint, test, build) → backend (vet, test) → android (assembleDebug, testDebugUnitTest)
```

**Lo que eso NO prueba**: que la app se vea bien, que los botones se toquen con
una mano, que la lista se lea al sol. Como en `010` y `011`, **eso lo prueba el
quickstart** — con la diferencia de que acá hay dos niveles: el emulador, que
puedo manejar desde la sesión con `adb`, y el teléfono de Diego, que no.

**Las pruebas instrumentadas (`connectedAndroidTest`) quedan fuera del
`verify:`**: necesitan un emulador levantado, tardan minutos y fallan por
razones que no son el código. Lo que se prueba en JVM es lo que se puede probar
sin dispositivo: el mapeo de la respuesta del servicio, y qué se muestra cuando
un pedido viene sin puntos.

---

## D11 — Lo que este plan NO va a construir, y conviene tenerlo escrito

- **Nada de ruta ni ordenamiento por proximidad.** PostGIS está puesto desde el
  día uno para eso (ADR `backend-persistence-stack`) y **sigue esperando**.
- **Sin notificaciones.** Ni push, ni servicio en segundo plano.
- **Sin base de datos local.** La app lee del servicio; sin señal lo dice.
- **Sin firma de release propia.** El APK se firma con la clave de depuración,
  que alcanza para instalar a mano. Una clave propia hace falta el día que se
  publique en una tienda, y ese día no está en el horizonte.
