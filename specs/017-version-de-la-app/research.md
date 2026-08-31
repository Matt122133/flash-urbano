# Research: Qué versión tiene el teléfono

**Feature**: `017-version-de-la-app` | **Fecha**: 2026-08-31

Todo lo de acá se midió sobre este repo el 2026-08-31, no se dedujo. Donde algo
salió de leer código y no de ejecutarlo, se dice.

---

## D1 — El tag tiene que existir **localmente**, y hoy no existía

**Decisión**: publicar es `git tag vX.Y.Z` **local**, después compilar, y recién
después `gh release create` sobre ese tag ya existente.

**Cómo se descubrió**: después de publicar `v0.1.0` con
`gh release create v0.1.0 <apk>`, en el repo local:

```
$ git tag -l
(vacío)
$ git ls-remote --tags origin
a4dbd9b...  refs/tags/v0.1.0
```

`gh release create` **crea el tag del lado del servidor**. El repo local no se
entera hasta un `git fetch --tags`. Es exactamente la trampa que hunde el
enfoque elegido en la clarification de FR-002: si el número se deriva de
`git describe` y el tag sólo existe en GitHub, **la compilación no lo ve** y el
APK sale con un número que no es el de la publicación — el modo de falla que
FR-004 existe para impedir, ocurriendo en silencio.

Por eso el orden del procedimiento no es cosmético: **tag primero, compilar
después, publicar último**.

**Alternativa descartada**: dejar que `gh` cree el tag y hacer `git fetch --tags`
antes de compilar. Funciona, pero mete un paso cuyo olvido no falla — vuelve a
compilar con el tag anterior y produce el APK equivocado sin decir nada.

---

## D2 — `git describe` sólo ve tags **alcanzables desde HEAD**

**Medido**, sobre la rama de este mismo feature y ya con `v0.1.0` traído:

```
$ git tag -l
v0.1.0
$ git describe --tags --always
c3eb8fe
```

No es un error: `v0.1.0` está en `a4dbd9b`, el merge de `016` en `master`, que
**no es ancestro** de esta rama. `describe` no lo alcanza y cae a `--always`.

**Consecuencia buena**: es justamente lo que hace cierto FR-006 sin escribir
nada. Un binario compilado en una rama de trabajo se identifica solo, con un
hash en vez de una versión, y **no puede hacerse pasar por publicado**.

**Consecuencia a manejar**: la compilación tiene que funcionar igual cuando no
hay tag alcanzable —es el caso normal mientras se desarrolla— y no reventar el
build. Ver D3.

---

## D3 — Cómo lee Gradle el tag, y qué hace cuando no hay

**Decisión**: `providers.exec { ... }` en `android/app/build.gradle.kts`, con
tres caídas explícitas.

`providers.exec` es la API de Gradle para ejecutar un proceso en configuración
sin romper el cacheo; la wrapper de este repo es **Gradle 8.13** (medido en
`android/gradle/wrapper/gradle-wrapper.properties`), muy por encima del 7.5 que
la introdujo. `org.gradle.caching=true` ya está puesto en
`android/gradle.properties`, así que la forma importa.

Las tres situaciones y qué produce cada una:

| Situación | `versionName` | `versionCode` |
|---|---|---|
| HEAD tiene un tag `vX.Y.Z` exacto | `X.Y.Z` | `X*10000 + Y*100 + Z` |
| Hay tag alcanzable pero HEAD está más adelante | `X.Y.Z+<n>-g<hash>` | el de `X.Y.Z` |
| No hay tag, o no hay git | `0.0.0-<hash>` o `0.0.0-desconocido` | `1` |

**El build nunca falla por no tener tag.** Compilar tiene que seguir andando en
un clon recién bajado, sin tags y sin red — si no, se rompe el trabajo diario
para resolver un problema de publicación. Lo que no puede pasar es lo contrario:
que un binario sin tag *parezca* publicado, y las tres filas lo impiden.

**Alternativa descartada**: fallar el build sin tag. Convierte cada sesión de
desarrollo en un trámite y no aporta nada: la guarda que importa es la de
publicar, y ésa vive en el script de publicación (D4).

---

## D4 — Qué impide publicar dos veces el mismo número

**Decisión**: un script de publicación en `scripts/` que hace las
comprobaciones **antes** de subir nada, en este orden:

1. El árbol de trabajo está limpio. Publicar con cambios sin commitear produce
   un APK que no corresponde a ningún estado del repositorio.
2. El tag pedido **no existe ya**, ni local ni en el remoto. Es lo que hace
   cierto FR-005: un identificador retirado no se reutiliza.
3. Recién ahí: crear el tag, compilar, verificar el APK, publicar.

**Por qué un script y no sólo el documento**: SC-005 pide comprobar que publicar
sin subir el número *se detiene o avisa*, provocándolo a propósito. Un párrafo
en un runbook no es comprobable; un script que sale con error sí.

**Lo que el script NO hace**: firmar con otra clave, publicar desde CI, ni tocar
nada del servicio. Sigue siendo un acto manual desde la máquina donde vive la
clave de depuración, como dice el spec.

---

## D5 — Dónde se guarda la versión del lado del servicio, y en cuántas consultas

**Decisión**: convertir el `SELECT` de `Sesiones.Resolver` en un
`UPDATE ... RETURNING` con **el mismo `WHERE`**.

Hoy `backend/internal/auth/sesion.go:128` resuelve la credencial con un `SELECT`
que filtra `revocada_en IS NULL AND expira_en > now()`. El comentario de arriba
de esa función es explícito sobre por qué el filtro va **en la consulta y no en
Go**: filtrar después deja la puerta abierta a un camino que se olvide de mirar
`revocada_en`, y ese descuido es FR-018 de `012` roto sin que nada falle.

Un `UPDATE ... RETURNING` con el mismo `WHERE` **conserva esa propiedad**,
escribe la versión y la marca de tiempo, y **no agrega una segunda ida a la
base**: es el mismo viaje que ya se hacía.

**El costo, dicho de frente**: cada pedido autenticado pasa de leer una fila a
escribirla. Con un repartidor y un puñado de pedidos por día eso no se nota, y
es reversible volviendo al `SELECT` y dejando la columna quieta. Con una flota
habría que revisarlo — igual que todo lo demás que este repo decide para un
operador (Principio III).

**El problema de la firma, y por qué no se toca**: `Resolver(ctx, token)` no ve
el `*http.Request`, así que no puede leer una cabecera. Cambiar su firma
arrastraría `httpx.ConSesion`, que es genérico a propósito y cuyo comentario
explica que `httpx` es transporte y no puede importar `internal/usuarios` sin
invertir las capas. **No se cambia ninguna firma**: un middleware de `httpx`
deja la versión declarada en el `context`, y `Resolver` la lee de ahí. La
dependencia queda en el contexto, que es para lo que existe.

**La web también tiene sesiones y no manda versión.** El `UPDATE` MUST usar
`COALESCE` sobre lo declarado, para que un pedido del sitio **no borre** la
versión que había anotado la app. Sin eso, cada vez que Diego mirara sus pedidos
desde el navegador se perdería el dato que este feature existe para tener.

**Alternativa descartada**: una segunda consulta después de resolver. Duplica
las idas a la base y abre la ventana en que una falló y la otra no.

---

## D6 — Qué viaja del teléfono al servicio

**Decisión**: una sola cabecera con la versión y **nada más**.

FR-011 lo acota: ni modelo, ni versión de Android, ni identificador de
dispositivo. No hace falta ninguno para contestar la pregunta que motivó el
feature, y un dato que no hace falta no se guarda. `android/.../datos/Servicio.kt`
ya arma cada pedido con `Request.Builder()` y pone `Authorization` a mano en los
dos que la necesitan, así que hay un solo lugar donde agregarla.

El servicio MUST tratar esa cabecera como **texto no confiable**: viene de un
cliente y se guarda en la base. Acotar largo y descartar lo que no tenga forma
de versión, antes de escribirla.

---

## D7 — Dónde aparece la versión en la app

**Decisión**: dos lugares, ninguno con costo permanente de pantalla.

- **Al pie de `PantallaIngreso`**, después del botón. Es la pantalla de la que
  ya cuelgan el título y el subtítulo (`Ingreso.kt:39-40`).
- **Al final de la lista de pedidos**, después de la última tarjeta.

El segundo es el que cumple FR-003 en la práctica: la sesión no expira, así que
Diego puede pasar meses sin ver la pantalla de ingreso, y **llegar a ella
significaría cerrar sesión**. Ver la clarification del 2026-08-31 en el spec.

Lo que **no** se hace: un renglón fijo arriba. `015` existió para recuperar
milímetros de pantalla y alcance del pulgar en una app que Diego usa con una
mano y un paquete en la otra; gastar alto permanente en un dato que se mira dos
veces por año desharía parte de eso.

Las dos leen el **mismo** valor de `BuildConfig` que se manda al servicio, que
es lo que hace cierto FR-012 sin esfuerzo: no hay dos fuentes que puedan
discrepar. `buildConfig = true` ya está activo en `android/app/build.gradle.kts`
—es lo que publica `BASE_URL`— así que no hay que habilitar nada.
