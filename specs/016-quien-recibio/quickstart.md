# Quickstart — `016` Quién recibió el paquete

## Nivel 1 — desde la sesión

### Q1. `verify:` verde, **y mirando el conteo de skips**

```
cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
```

**Con `TEST_DATABASE_URL` puesto, y comprobando que los skips de Go sean cero.**
En este feature eso no es una formalidad: **la migración nueva y la guarda de
FR-010 viven en las pruebas contra Postgres**, y sin esa variable se saltean
solas. Un verde con skips no diría nada sobre lo único que este feature tiene
que garantizar.

La barra invertida de `.\gradlew.bat` tampoco es estilo: `verify:` corre en
`cmd`. Ver research D6.

### Q2. La guarda de la cédula sabe fallar

**No es opcional.** Agregarle a mano el documento al tipo del cliente tiene que
poner la prueba en rojo, nombrando el campo. Deshacer y confirmar verde.

Sin este paso, la única regla que este feature no puede permitirse romper queda
sostenida por una prueba que nadie vio fallar.

### Q3. La migración corre sobre una base que ya tiene filas

Levantar la base de desarrollo **con pedidos y con historial ya adentro**, y
recién ahí aplicar `0006`.

**Esperado**: corre sin tocar las filas que estaban, y las dos columnas quedan
en nulo para todo lo anterior.

**Por qué este paso existe**: el 2026-08-12 una migración de esta base se probó
contra una tabla vacía, entró `NOT NULL`, producción tenía filas, y **el
servicio no arrancó**. Probar una migración contra una base vacía es no
probarla.

## Nivel 2 — el emulador, contra el servicio local

### Q4. Dos toques cuando recibe quien tenía que recibir

Con un pedido en *En curso*: tocar **Entregado** → aparece la pregunta con la
persona del pedido propuesta → tocar la propuesta.

**Esperado**: **dos toques en total**, contados. El pedido pasa a Entregados.

Es SC-001, y si son tres el feature empeoró la app.

### Q5. Recibe otra persona, con y sin cédula

1. Tocar Entregado → elegir que recibió otra persona → escribir un nombre → **sin
   cédula** → confirmar. **Esperado**: se registra igual.
2. Repetir con cédula. **Esperado**: se registra con las dos cosas.
3. Tocar Entregado y **cerrar la hoja sin confirmar**. **Esperado**: el pedido
   **sigue en En curso**. Nada se movió.

### Q6. Diego ve las dos cosas

En la tarjeta de un pedido entregado, en la app: aparecen el nombre y la cédula
de quien recibió.

### Q7. La cédula no llega al cliente — mirado en la respuesta, no en la pantalla

```bash
curl -s -H "Authorization: Bearer <credencial del CLIENTE>" \
  http://localhost:8080/pedidos | grep -i "documento\|1.234.567"
```

**Esperado: nada.** Y con la credencial de **admin**, la misma búsqueda **tiene
que encontrarlo** — si no, no se está probando nada.

**Mirar la respuesta y no la pantalla es el punto entero de este paso.** Una
pantalla que no muestra un dato que igual viajó es exactamente la forma en que
esto se rompe sin que nadie lo note.

### Q8. La web muestra el nombre y nada más

En *Mis pedidos*, con la sesión del cliente: el pedido entregado dice quién lo
recibió. Un pedido entregado **antes** de este feature no muestra nada — ni un
hueco, ni "sin datos".

## Nivel 3 — con el cliente

### Q9. Que Diego lo use en una entrega real

Que entregue un paquete de verdad, incluyendo **una a un tercero**, que es el
caso que motivó todo esto. Dos preguntas: si los dos toques le alcanzan cuando
tiene las manos ocupadas, y si pedir la cédula le resulta natural o incómodo
frente a la persona.

Lo segundo no lo puede contestar nadie más que él, y puede cambiar el diseño.
