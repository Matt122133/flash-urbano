# Quickstart: Qué versión tiene el teléfono

**Feature**: `017-version-de-la-app` | **Fecha**: 2026-08-31

Tres niveles, como en `012` y `016`: lo que se comprueba sin teléfono, lo que
necesita un emulador contra el servicio local, y lo que sólo se comprueba
publicando de verdad. **Un nivel no se da por bueno si el anterior no pasó.**

---

## Nivel 1 — Sin teléfono

### Q1. Las dos patas del `verify:` en verde

```
cd backend && go vet ./... && go test ./...
cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
```

**Mirar el conteo de `SKIP` de Go, no sólo que diga `ok`.** Las pruebas que
tocan Postgres **se saltan solas y en silencio** sin `TEST_DATABASE_URL`
(`backend/README.md`), así que un verde con saltos **no dice nada sobre la
migración `0007`**. Con la variable puesta, los saltos tienen que ser **0**.

`web/` no entra: este feature no lo toca y no está en `covers:`.

### Q2. Romper la guarda a propósito y verla en rojo

Es la comprobación que este repo exige para toda prueba que afirma que algo *no*
pasa. Dos, y las dos tienen que salir en **rojo** al romperlas:

1. **La que protege el dato de la web**: sacar el `COALESCE` del `UPDATE` de
   `Resolver` (research D5). La prueba que dice que un pedido sin cabecera no
   borra la versión anotada **tiene que fallar**. Si sigue verde, no está
   probando nada.
2. **La que acota lo que se guarda**: sacar la validación de largo. La prueba
   que manda una cabecera larguísima y espera que la sesión quede intacta
   **tiene que fallar**.

Volver a poner las dos antes de seguir.

### Q3. Las tres situaciones del número, medidas

Con la wrapper de Gradle, comprobar que salen los tres casos de research D3:

```
git tag -l                      # que exista el tag que se va a probar
.\gradlew.bat :app:assembleDebug
```

- **Sin tag alcanzable**: `versionName` con hash, `versionCode` 1.
- **Con tag exacto**: `versionName` = el del tag, `versionCode` = la cuenta.
- **Con tag alcanzable pero HEAD adelante**: nombre con sufijo.

Leer el resultado del APK, no del build.gradle:

```
aapt2 dump badging app-debug.apk | grep -E "versionCode|versionName"
```

**Ojo con D2**: en una rama de trabajo el tag de `master` no es alcanzable, así
que el caso "sin tag" es el que sale por defecto. Para probar los otros dos hay
que crear un tag local sobre la rama y borrarlo después.

### Q4. La migración sobre datos reales

Correrla contra una copia con las sesiones que ya existen y comprobar que
**todas quedan en `NULL`** y ninguna fila se rompe. Es la comprobación barata
que `016` hizo sobre 24 filas y que evita descubrir un `NOT NULL` olvidado en
producción.

---

## Nivel 2 — Emulador contra el servicio local

Con el backend local levantado y la app `debug` en el emulador.

### Q5. La versión aparece en los dos lugares

Entrar a la app: la versión al pie de la pantalla de Ingreso. Ya adentro,
desplazar hasta el final de una lista de pedidos: la versión otra vez, **con el
mismo texto**. Que coincidan es FR-012 mirado con los ojos.

### Q6. Llega a la base

Después de que la app haya pedido la lista de pedidos al menos una vez:

```sql
SELECT version_app, version_vista_en FROM sesiones
WHERE revocada_en IS NULL ORDER BY version_vista_en DESC;
```

Tiene que traer **lo mismo** que muestra la pantalla. **Esto se mira en la base
y no en la pantalla**: una pantalla que muestra un dato correcto mientras al
servicio le llega otro es exactamente la forma en que FR-012 se rompe sin que
nadie lo note — la misma lección que Q7 de `016`.

### Q7. Un pedido sin cabecera no borra lo anotado

Con la versión ya guardada, hacer un pedido autenticado **sin**
`X-App-Version` —lo que hace el sitio web— y volver a mirar la fila. Tiene que
seguir estando lo de antes. Es el `COALESCE` de research D5 comprobado sobre el
servicio real y no sólo en una prueba.

### Q8. La cabecera basura no rompe nada

Mandar un pedido con `X-App-Version` de miles de caracteres y otro con algo que
no es una versión. En los dos casos: **la respuesta es normal** —no un error— y
la fila queda intacta. Que un defecto acá pudiera dejar a Diego sin trabajar
sería invertir el problema y su instrumento.

---

## Nivel 3 — Publicando de verdad

### Q9. El script se planta cuando tiene que plantarse

Provocarlo a propósito, que es lo que pide SC-005:

- Intentar publicar con el árbol sucio → se detiene.
- Intentar publicar un tag que ya existe → se detiene.
- Intentar publicar `v0.1.0`, que ya está publicado → se detiene.

Si alguna de las tres publica, la guarda no existe.

### Q10. El ciclo completo, con un teléfono de verdad

Publicar una versión nueva, mandar el link, instalarla **encima** de la que ya
está. Comprobar las tres cosas que sólo se ven acá:

1. **No hubo que desinstalar y Diego no volvió a ingresar** (FR-009, SC-003).
   Es lo que prueba que la firma es la misma.
2. La versión que muestra la pantalla es la nueva.
3. La consulta de `data-model.md` **contesta sola**, sin preguntarle nada a él
   (SC-006).

### Q11. **TUYA** — El documento se sigue solo

Que alguien —o vos dentro de seis meses— publique una versión leyendo
únicamente `docs/processes/app-repartidor.md`, sin esta conversación. Es SC-004,
y es lo único que dice si el runbook quedó bien. Lo que haya que preguntar es un
agujero del documento, no del lector.
