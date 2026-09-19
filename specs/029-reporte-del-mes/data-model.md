# Data Model: El reporte del mes

**Feature**: `029-reporte-del-mes` | **Fecha**: 2026-09-19

**Ninguna migracion.** No hay columna nueva, ni tabla nueva, ni campo nuevo en un
pedido. Todo lo que el reporte necesita ya esta guardado; lo que no existia es un
camino para leerlo.

---

## Lo que ya existe y se lee

| De donde | Que aporta | Nota |
|---|---|---|
| `pedidos.codigo` | `FU-####` | Para cruzar con la app. |
| `pedidos.retiro_fecha` | La fecha del periodo | **`date`, no timestamp**: el corte del mes no tiene trampa de zona. |
| `pedidos.entrega_*` | calle, esquina, numero, apto, cooperativa | Se componen en la web con la misma funcion que la pantalla y la etiqueta. |
| `pedidos.entrega_punto` | El punto | **De aca sale la zona**, resuelta en la web. Nulo en pedidos anteriores a `011`. |
| `pedidos.cantidad` | Paquetes | |
| `pedidos.usuario_id` | La cuenta | Es por lo que se filtra, en el servicio. |
| `pedidos_estados` | La fecha de entrega | `estado='entrega'`, la marca **mas reciente**. **Camino de lectura nuevo** (ver abajo). |

### El historial de estados: primera lectura de su vida

La migracion que lo creo dice, textual: *"El historial NO SE MUESTRA en ningun
lado (FR-014): se escribe y se guarda. La unica lectura previsible es a mano,
meses despues, cuando alguien reclama"*.

Este feature abre esa lectura. **Se anota como decision y no como detalle**,
porque es la segunda vez que este repo lee una columna que se escribio sin
pensar en leerla — y la primera, `precio`, termino en una prohibicion. La
diferencia es real y hay que dejarla escrita: **`ocurrido_en` registra un hecho
—cuando Diego marco el pedido— y no un valor de relleno**. Leerla es legitimo.
Lo que no es legitimo es olvidarse de que **puede no existir**, que es de donde
sale toda la historia 2 del spec.

### Lo que NO se lee, y no puede leerse

`pedidos.precio`. Ni directa ni indirectamente. Dos guardas automaticas lo
custodian (research D6).

---

## Lo que viaja: `GET /admin/reporte`

**Pide** — los tres obligatorios, y `cliente` es lo que hace estructural a
FR-006:

| Parametro | Que es | Si falta |
|---|---|---|
| `cliente` | La cuenta | **400.** Nunca "todos": no existe forma de pedir un archivo mezclado. |
| `desde`, `hasta` | El periodo, como fechas de calendario inclusive | **400.** |

**Devuelve** una lista de filas, y nada mas. Sin totales, sin agrupar: el
servicio devuelve hechos, como en `025`.

```text
{ "pedidos": [ { codigo, retiroFecha, entrega{calle,esquina,numero,apto,cooperativa,punto}, entregadoEn, cantidad } ] }
```

- `entregadoEn` — instante RFC 3339 **o ausente**. Ausente y no `null` ni `""`,
  por el mismo criterio que `016` y `026`: deja distinguir "no se marco" de "se
  marco y no se pudo leer" sin que el formateo tenga que adivinar.
- `punto` — `{lat,lng}` **o ausente**, para un pedido anterior a `011`.
- **No hay campo de plata, y no hay donde ponerlo.**

---

## Lo que nace en la web: `FilaDeReporte`

En `web/lib/reporte.ts`, modulo puro. Es el CSV resuelto **antes** de ser texto,
por el mismo motivo por el que `020` separo `etiqueta.ts` de `etiqueta-pdf.ts`:
una afirmacion sobre esta estructura se prueba en tres lineas; la misma
afirmacion sobre una cadena con comillas y puntos y comas, no.

| Campo | Que es |
|---|---|
| `codigo` | Tal cual. |
| `retiro` | `YYYY-MM-DD`, tal cual viene: ya es una fecha de calendario. |
| `entrega` | `YYYY-MM-DD` **de Montevideo**, o `""` si no se marco. |
| `direccion` | Compuesta con la misma funcion que la pantalla y la etiqueta. |
| `zona` | El nombre, o `""` si el pedido no tiene punto. **Nunca deducida de la direccion escrita.** |
| `paquetes` | Numero. |

Y el archivo entero:

| Campo | Que es |
|---|---|
| `filas` | `FilaDeReporte[]`, en orden de fecha de retiro. |
| `cuenta` | El nombre o el mail de la cuenta, para el pie. |
| `periodo` | El rotulo del periodo, el mismo que muestra el cuadro. |
| `generadoEl` | Fecha y hora **de Montevideo**. |

## Las reglas que esta estructura hace comprobables

1. **Ninguna fila lleva plata** (FR-009): no hay campo donde ponerla.
2. **Una fila por pedido** (FR-002), nunca una por paquete.
3. **Zona vacia solo sin punto** (FR-007): con punto, siempre hay zona o el punto
   cae fuera de toda zona — y las dos cosas se distinguen.
4. **Entrega vacia solo sin marca** (US2): un pedido sin marcar aparece igual.
5. **La fecha de entrega es la de Montevideo** (FR-006b): un instante de las
   22:00 del ultimo dia del mes no se corre al dia siguiente.
6. **El texto generado cita bien** (FR-016): una direccion con `;`, comillas o
   salto de linea no parte la fila.
