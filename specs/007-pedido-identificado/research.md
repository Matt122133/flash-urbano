# Research: El pedido se crea identificado y se guarda

**Feature**: `007-pedido-identificado` | **Fecha**: 2026-08-12

Las decisiones técnicas que el spec deja abiertas, resueltas antes de escribir
código. Cada una dice qué se eligió, por qué, y qué se descartó — porque lo
descartado es lo que alguien va a proponer de nuevo dentro de tres meses.

---

## D1 — Cómo confirma el formulario sin romper la guarda de FR-001

**El problema, que es el más grande del feature.**
`web/lib/cotizar-abierto.test.ts` recorre el grafo de imports desde cuatro
entradas y falla si alguna alcanza `lib/api.ts` o `lib/sesion.ts`. Una de esas
entradas es **`components/pedido-form.tsx`**. Este feature necesita que el
formulario confirme el pedido contra el servicio. Escrito de la forma obvia
—`import { pedir } from "@/lib/api"` dentro del formulario— **la guarda se pone
en rojo**, y FR-004 prohíbe retirarla.

No es un obstáculo de la prueba: la prueba está diciendo la verdad. Un
formulario que importa el cliente del API es un formulario que puede terminar
dependiendo de él para cotizar.

**Decisión: inversión de dependencia. El formulario recibe `onConfirmar` como
prop y nunca sabe que existe un servicio.**

```
app/pedido/page.tsx  (servidor, sólo metadata y encabezado)
  └── components/pedido/crear-pedido.tsx   (cliente, NUEVO — la composición)
        ├── importa lib/api.ts y lib/sesion.ts   ← acá sí, y está bien
        ├── <PedidoForm onConfirmar={...} />     ← le pasa la función
        └── <DialogoIngreso />                    ← la puerta
```

`pedido-form.tsx` declara qué necesita (`onConfirmar(datos): Promise<Resultado>`)
y quien lo monta decide cómo se cumple. El grafo de imports del formulario
**no cambia**: sigue sin llegar a `api.ts` ni a `sesion.ts`, y la guarda sigue
verde sin tocarle una línea a sus `ENTRADAS`.

**Por qué esto es mejor diseño y no un truco para pasar la prueba**: el
formulario pasa a ser probable sin red y sin sesión, y la pieza que habla con el
servicio queda aislada en un archivo cuyo trabajo es exactamente ese.

**Descartado: `await import("@/lib/api")` dentro del handler de envío.** El
regex de la guarda (`ESPECIFICADOR`) reconoce `import("x")`, así que la prueba
fallaría igual — y si se la enseñara a ignorar los imports dinámicos, se abriría
un agujero por donde entraría cualquier cosa.

**Descartado: sacar `pedido-form.tsx` de `ENTRADAS`.** Es retirar la guarda, que
es lo que FR-004 prohíbe explícitamente.

**Lo que hay que agregarle a la guarda**, porque si no se vuelve verde por el
motivo equivocado: un **control positivo** que afirme que
`components/pedido/crear-pedido.tsx` **sí** alcanza `lib/api.ts`. Sin él, borrar
el envío entero deja la prueba en verde y nadie se entera. Es la misma técnica
que ya usa el bloque *"el detector encuentra lo prohibido cuando está"*.

---

## D2 — Dónde vive el diálogo de ingreso, sin duplicar la pantalla de ingreso

**Decisión: extraer la composición de ingreso de `app/ingresar/page.tsx` a un
componente reutilizable, y montarlo en los dos lugares.**

Hoy `/ingresar` compone `BotonGoogle`, `IngresoPorCodigo` y `CompletarAlta`, y
al terminar hace `router.push("/")`. El diálogo necesita la misma composición
con otro final: cerrarse y avisar. Se factoriza a
`components/sesion/panel-ingreso.tsx`, que recibe qué hacer al terminar, y
`/ingresar` pasa a ser una página que lo monta con `router.push("/")`.

**Por qué importa**: dos composiciones distintas del mismo login divergen. La de
`/pedido` recibiría un arreglo que la de `/ingresar` no, y el bug aparecería en
el camino que nadie prueba.

**Consecuencia para `covers:`**: `web/app/ingresar/page.tsx` entra, aunque el
spec no hable de esa pantalla. Sin ella, la alternativa es duplicar.

Que esto sea posible depende de un detalle de `006` que se verificó en el
código, no se supuso: **Google Identity Services (`google.accounts.id`) abre un
popup, no redirige**, y el camino del código por mail es un `POST` al servicio.
Ningún camino abandona la página. Si Google redirigiera, la decisión del spec
—no persistir el borrador— sería inviable y habría que reabrirla.

---

## D3 — Idempotencia: dónde viaja la clave y hasta dónde llega su unicidad

**Decisión: header `Idempotency-Key` con un UUID de `crypto.randomUUID()`,
único por `(usuario_id, clave)`.**

- **Header y no cuerpo**: es la convención, y mantiene la clave fuera del
  documento que describe el pedido. La clave identifica un *intento de envío*,
  no un atributo del paquete; ponerla en el cuerpo invita a guardarla como si
  fuera parte del pedido.
- **Único por usuario y no globalmente**: dos usuarios no pueden colisionar ni
  usar la clave de otro para sondear si existe. Con un UUID la colisión global
  es improbable igual, pero el índice compuesto lo hace imposible en vez de
  improbable, y cuesta lo mismo.
- **La genera el navegador al montar el intento**, no en cada click. Un
  `useRef` con la clave del intento en curso: los reintentos y la reanudación
  posterior al ingreso la comparten; después de un pedido creado con éxito se
  descarta y el siguiente intento genera otra.

**Comportamiento ante clave repetida (FR-016a): `200` con el pedido existente**,
no `409` y no un pedido nuevo. Quien reintenta porque no supo si funcionó tiene
que llegar al mismo lugar que si hubiera funcionado a la primera. Un pedido
nuevo devuelve `201`; la diferencia entre `200` y `201` es lo que hace
observable —y por lo tanto probable— que la deduplicación actuó.

**Descartado: deduplicar por contenido dentro de una ventana de tiempo.** Está
razonado en el spec y el motivo es del negocio: dos paquetes iguales a la misma
dirección el mismo día son normales, y comerse el segundo produce un paquete que
nadie retira.

---

## D4 — El código `FU-0142`

**Decisión: una secuencia de Postgres, formateada por una función.**

```sql
CREATE SEQUENCE pedidos_codigo_seq;

CREATE OR REPLACE FUNCTION pedidos_codigo_nuevo() RETURNS text
LANGUAGE sql VOLATILE AS $$
    SELECT 'FU-' || CASE WHEN v < 10000
                         THEN lpad(v::text, 4, '0')
                         ELSE v::text
                    END
    FROM (SELECT nextval('pedidos_codigo_seq') AS v) AS s;
$$;

codigo text NOT NULL UNIQUE DEFAULT pedidos_codigo_nuevo()
```

- **La base lo genera, no el servicio.** Dos instancias del servicio no pueden
  emitir el mismo código, y no hace falta reintentar ante colisión.
- **La secuencia deja huecos** si una transacción falla después de tomar el
  número. Es correcto: el código sirve para nombrar un pedido, no para contar
  cuántos hubo.

### CORRECCIÓN del 2026-08-12 — esta decisión decía algo falso

La primera versión de este apartado afirmaba: *"`lpad` **no trunca** — el pedido
10.000 sale `FU-10000` y sigue siendo único y legible. No hay desbordamiento
silencioso, que es el defecto que este tipo de formato suele esconder."*

**Es exactamente al revés.** La documentación de PostgreSQL dice que `lpad`
*"if the string is already longer than length then it is truncated (on the
right)"*. Medido en Postgres 17:

| valor | `lpad(v,4,'0')` | `to_char(v,'FM0000')` | el `CASE` |
|---|---|---|---|
| 9999 | `9999` | `9999` | `9999` |
| 10000 | **`1000`** | **`####`** | `10000` |
| 10001 | **`1000`** | **`####`** | `10001` |

O sea que el pedido 10.000 y el 10.001 salían **con el mismo código**, y el
`UNIQUE` de la columna convertía eso en un `INSERT` que revienta — el día que el
negocio esté en su mejor momento y con un error que no menciona el código.

**Lo encontró la prueba que cruza `FU-9999` a propósito**, que existe porque
`/speckit-analyze` marcó (G2) que SC-008 no tenía tarea. Es el caso de libro de
por qué una afirmación razonada no es una afirmación comprobada: el párrafo
original sonaba informado y era falso.

Se descartó `to_char(v, 'FM0000')` por la misma medición: cambia un código
repetido por uno inválido, que no es mejor. Y hace falta una **función** y no
una expresión inline porque hay que mirar el valor dos veces para decidir si se
rellena, `nextval` no se puede llamar dos veces sin avanzar la secuencia, y un
`DEFAULT` no admite subconsultas.

**Descartado: códigos aleatorios.** Obligan a manejar colisión, y son peores
para dictar por teléfono.

**Riesgo asumido y ya declarado en el spec**: el formato es un supuesto, la
pregunta 6 a Diego sigue sin respuesta. Cambiarlo mientras no haya pedidos
reales es una migración de una línea; después, no.

---

## D5 — Precio, zona y moneda

**Decisión: `precio integer` en pesos uruguayos enteros, más `zona_id smallint`,
los dos tal como el navegador los declaró.**

Los precios de zona son montos enteros (`$350`), no hay centavos en ningún lado
del producto, y un entero no tiene el problema de redondeo de un flotante. No se
guarda la moneda como columna: el producto opera en una sola, y una columna que
siempre dice lo mismo es una que nadie mantiene y que un día miente.

**Se guarda también `zona_id`** aunque sea derivable del punto: es lo que el
cliente vio, y compararlo después contra lo que el punto resuelve es lo que
convierte una sospecha en una verificación.

---

## D6 — La verificación del precio que NO se hace, y la que sí conviene hacer

La clarificación del 2026-08-12 decidió que el servicio **no** resuelve la zona:
no se duplica la geometría que decide la plata. Eso se respeta.

**Lo que queda dentro del alcance**: el servicio exige que `precio` y `zonaId`
**estén presentes y sean coherentes entre sí** sólo en la forma más débil —
tipos correctos, `precio > 0`, `zonaId` entre 1 y 5. Nada más. Un pedido con
`precio: 1` y `zonaId: 5` se guarda.

**Lo que se evaluó y se dejó anotado en vez de construir**: el servicio **no
necesita la geometría para saber que la Zona 3 cuesta tanto**. Cinco zonas,
cinco precios — una tabla de cinco filas, sin un solo polígono. Con eso, un
pedido con `precio: 1` sería rechazado, y el riesgo residual se achicaría de
*"puede declarar cualquier monto"* a *"puede declarar una zona que no es la
suya"*, que es mucho más chico.

**Por qué no se hace acá igual**: mete los precios en un segundo lugar. Hoy
viven en `web/lib/zonas.ts`, que es **archivo generado** desde
`web/design-source/build-zonas.js`. Un precio cambiado en un lado y no en el
otro no produce un precio equivocado — produce **pedidos rechazados**, que es un
modo de falla peor porque el cliente no puede comprar y nadie sabe por qué. La
forma correcta es generar la tabla del servicio desde la misma fuente, y eso es
trabajo en `web/design-source/`, fuera del alcance de este feature.

**Se anota como deuda al cerrar** (lo obliga FR-021a). Es la evolución natural de
esta decisión, no una corrección de ella.

---

## D7 — La revalidación del punto guardado (FR-022), y dónde puede vivir

**Decisión: en el navegador, al precargar el formulario. No en el servicio.**

`FR-019b` de `006` difirió a este feature la verificación de que el punto
guardado siga cayendo dentro de la cuadra declarada. Esa comprobación es
`regionPermitida()` en `web/lib/direcciones.ts`, y necesita el índice de calles
—`web/public/calles-mvd.json`, ~megabytes— que el servicio no tiene y no debería
tener.

Al precargar: se reconstruye la esquina desde calle y esquina guardadas, se
comprueba que el punto guardado caiga en la cuadra, y

- **si cae**: se usa tal cual, incluido el arrastre que la persona hizo;
- **si no cae**: se descarta el punto, se recoloca en el cruce resuelto, y se le
  avisa que revise la ubicación antes de confirmar.

Nunca se cobra en silencio sobre un punto que ya no corresponde. El precio se
recalcula desde el punto que quede, como hoy.

**Precedente que hay que reusar y no reinventar**: `formulario-perfil.tsx` ya
resuelve el caso de las **calles homónimas** —prueba todas las combinaciones y
desempata con el punto guardado— porque el índice tiene 50 grupos de nombres que
se normalizan igual. La precarga del pedido tiene exactamente el mismo problema.
Reutilizar esa lógica, no escribirla de nuevo.

---

## D8 — La fecha y la hora de retiro

**Decisión: `retiro_fecha date` y `retiro_hora time`, tal como la persona las
escribió. No un `timestamptz`.**

El retiro ocurre en Montevideo, siempre. Convertir a UTC y volver es una fuente
conocida de errores de un día —un retiro a las 00:30 guardado como el día
anterior— a cambio de una generalidad que este producto no usa. Lo que la
persona escribió en un campo `date` y uno `time` es lo que Diego tiene que leer.

**La validación de fecha vencida (edge case del spec)**: el servicio compara
contra la hora actual **en `America/Montevideo`**, explícitamente, no contra la
zona horaria del proceso —que en Railway es UTC—. Sin eso, entre las 21:00 y la
medianoche de Montevideo el servicio cree que ya es mañana y rechaza retiros
válidos de hoy.

Se rechaza un retiro cuya fecha ya pasó. **No** se rechaza por la hora dentro
del día de hoy: alguien que pide a las 10:05 un retiro "hoy 10:00" está pidiendo
"lo antes posible", y la logística es manual — Diego lo llama. Rechazarlo sería
el sistema opinando sobre algo que no gestiona.

---

## D9 — Cómo se leen los pedidos sin abrir la base (FR-031, FR-032)

**Decisión: dos endpoints, ninguna pantalla.**

- `GET /pedidos` — los del usuario que pide. Es también lo que va a consumir el
  futuro *Mis Pedidos* sin tener que rehacerlo.
- `GET /admin/pedidos` — todos, sólo para una dirección administradora.

El administrador se decide con `config.EsAdmin`, que `006` ya construyó y probó
(FR-022 de aquel feature: sale del entorno, no de una columna, y no hay forma de
volverse administrador desde el sitio). **No se agrega ningún concepto nuevo de
permisos.**

**Sin UI, a propósito.** FR-030 difiere *Mis Pedidos* y la clarificación
descartó la vista web para Diego. Estos endpoints son instrumentación: hacen que
"el pedido se guardó" sea comprobable por una persona con `curl`.

---

## D10 — La migración `0003`

Una sola migración: la secuencia del código y la tabla `pedidos`. Sigue las dos
reglas que `0001` fijó — **sólo hacia adelante** (la marcha atrás real es
restaurar una copia) y el estado como `text` con `CHECK`, no un enum nativo,
porque la lista de estados **ya cambió una vez** (se cayó "confirmación").

El detalle en [`data-model.md`](data-model.md).

---

## D11 — El `.gitignore` de la raíz (FR-033)

**Decisión: al `.gitignore` de la raíz van `.env` y `.env.*`, con `!.env.example`
como excepción explícita.**

```gitignore
.env
.env.*
!.env.example
!*.env.example
```

Dos precisiones que hacen la diferencia entre que funcione y que parezca que
funciona:

1. **`.env*` a secas también taparía `backend/.env.example`**, que es un archivo
   que queremos versionado — es la documentación de qué variables hacen falta.
   Por eso la negación.
2. **Un `.gitignore` no destapa ni desprotege lo ya rastreado**: `.env.example`
   sigue en el índice porque ya está commiteado. La negación es para el clon
   nuevo, no para éste.

`backend/.gitignore` **se deja como está**. Dos redes que se superponen es lo
correcto acá; sacarlo para "no duplicar" es cambiar una protección segura por
una elegante.

**Lo que esto NO arregla, y hay que decirlo**: sigue siendo una protección por
nombre de archivo. Un secreto pegado dentro de un `.go` o un `.md` pasa igual.
El arreglo robusto —un hook que rechace contenido que parezca una credencial,
independiente de `covers:`— sigue anotado en el tracker y no entra acá.

---

## D12 — Qué NO se toca

- **`web/lib/zonas.ts` y `web/lib/zona-lookup.ts`**: intactos. FR-001 y FR-002.
- **`web/components/bloque-direccion.tsx`**: fuera de `covers:`, igual que en
  `006`. Sus dos deudas conocidas —el campo *Esquina* deshabilitado con una
  dirección precargada, y el estado interno no rehidratable— **van a molestar
  acá también**, porque este feature precarga direcciones. No se arregla de
  paso: se verifica que la precarga funcione con el componente tal cual, y si no
  alcanza, se extiende `covers:` con motivo escrito en vez de a escondidas.
- **El esquema de `usuarios`**: no cambia. El pedido copia, no referencia.
