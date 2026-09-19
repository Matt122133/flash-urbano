# Data Model: La etiqueta de 12 x 10

**Feature**: `028-etiqueta-12x10` | **Fecha**: 2026-09-19

**Nada persistido cambia.** No hay migracion, no hay columna, no hay campo nuevo
en ningun JSON, y el servicio y la app Android no se enteran de este feature. Lo
que sigue es la **estructura en memoria** que nace con D4 y que existe por una
sola razon: que la geometria de la hoja se pueda afirmar en una prueba.

---

## Lo que NO cambia

- **`Etiqueta`** (`web/lib/etiqueta.ts`) — codigo, bloque de entrega, bloque de
  retiro, fecha, cantidad, comentario opcional. **Intacta.** Este feature toca
  como se dibuja, no que dice, y esa frontera es la que hace que
  `etiqueta.test.ts` siga valiendo sin tocarle una linea de afirmacion.
- **`BloqueEtiqueta`**, **`PedidoParaEtiqueta`** — intactos.
- **`Pedido`** en Postgres — intacto.

---

## Lo que nace: `Maqueta`

En `web/lib/etiqueta-maqueta.ts`. **Todo en milimetros**, origen en el borde
superior izquierdo de la hoja A4, que es como piensa jsPDF y como piensa una
regla.

### `Maqueta`

La hoja resuelta en posiciones.

| Campo | Tipo | Que es |
|---|---|---|
| `recorte` | `Rect` | El rectangulo de 120 x 100. La frontera de FR-003. |
| `marcas` | `Segmento[]` | Las ocho lineas de las cuatro escuadras de esquina. **Viven afuera de `recorte` a proposito** y por eso se excluyen de la comprobacion de FR-003. |
| `elementos` | `Elemento[]` | Todo lo que se dibuja adentro, ya ubicado. |
| `ajuste` | `number` entre 0 y 1 | Cuanto hubo que achicar (FR-006). **0 = nada, nadie se movio de su cuerpo corriente. 1 = todos los bloques estan en su piso.** Se expone para que la prueba pueda afirmar que un pedido corriente NO se achico (FR-005): `ajuste === 0`. |
| `comentarioCortado` | `boolean` | `true` solo si se activo el ultimo recurso de FR-008. Que sea un campo y no un efecto invisible es lo que lo hace probable. |

### `Elemento`

Una cosa dibujable, ya medida.

| Campo | Tipo | Que es |
|---|---|---|
| `bloque` | `"encabezado" \| "codigo" \| "entrega" \| "retiro" \| "comentario" \| "pie"` | A que parte pertenece. **Es lo que permite comparar contra la tabla de pisos** de FR-007 sin adivinar por posicion. |
| `tipo` | `"texto" \| "recuadro" \| "regla" \| "imagen"` | Que llamada de jsPDF le corresponde. |
| `x`, `y` | `number` | Esquina superior izquierda, en mm. Para texto, `y` es la linea base menos el alto: se guarda la **caja**, no la baseline, porque lo que FR-003 pregunta es si la caja entra. |
| `ancho`, `alto` | `number` | La caja que ocupa, en mm. Para texto sale del medidor inyectado (D5), nunca de contar caracteres. |
| `texto` | `string?` | Solo en `tipo: "texto"`. |
| `pt` | `number?` | Solo en `tipo: "texto"`. El cuerpo con el que se dibuja, **despues** de aplicar `ajuste`. Es el numero que la prueba compara contra el piso. |
| `peso` | `"normal" \| "bold"?` | |
| `alineacion` | `"izquierda" \| "centro" \| "derecha"?` | El codigo va centrado; la zona, a la derecha. |
| `gris` | `number` | 17 o 105, la misma escala de grises de `020`. Sin color: la hoja se imprime en mono. |

### Por que `ajuste` interpola por bloque y **no** es un multiplicador global

Lo detecto el `/speckit-analyze` del 2026-09-19, y es la clase de error que se ve
solo con los numeros adelante.

La tentacion es que `ajuste` sea un factor que multiplica todos los cuerpos:
`pt x 0.9` y listo. **No funciona, porque cada bloque tiene distinto aire hasta
su piso.** Los rotulos van de 6.5 a 6 pt: **8 %**. El codigo va de 34 a 26 pt:
**24 %**. Un multiplicador global se frena cuando el bloque mas apretado toca su
piso —los rotulos, casi enseguida— y ahi se detiene **con 9.08 mm todavia
recuperables** en el codigo, la entrega y el retiro. Medido, no estimado.
El sintoma seria FR-008 cortando comentarios que entraban perfectamente.

La regla correcta es **interpolar cada bloque contra su propio piso**, con un
solo mando:

```text
pt(bloque) = corriente(bloque) + (piso(bloque) - corriente(bloque)) x ajuste
```

Con `ajuste = 0` nadie se movio; con `ajuste = 1` **todos** estan exactamente en
su piso, cada uno habiendo recorrido su propia distancia. La implementacion sube
`ajuste` hasta que el contenido entra, y **FR-008 solo puede dispararse con
`ajuste === 1`**: antes de eso todavia queda aire en algun lado y cortar seria
mentir.

### `Rect` y `Segmento`

`Rect` es `{ x, y, ancho, alto }`. `Segmento` es `{ x1, y1, x2, y2, grosor }`.
Los dos en mm.

---

## Las reglas que esta estructura hace comprobables

Son las que justifican que exista. Cada una es una afirmacion sobre el array, no
sobre un PDF:

1. **Todo elemento entra en el recorte** (FR-003):
   para cada `e` de `elementos`, `e.x >= recorte.x`, `e.y >= recorte.y`,
   `e.x + e.ancho <= recorte.x + recorte.ancho`,
   `e.y + e.alto <= recorte.y + recorte.alto`. Las `marcas` quedan fuera de esta
   regla, deliberadamente.
2. **Ningun cuerpo baja de su piso** (FR-007): para cada elemento de texto,
   `e.pt >= PISO[e.bloque]`, con la tabla de `research.md` D3.
3. **Un pedido corriente no se achica** (FR-005): `ajuste === 0` y
   `comentarioCortado === false`.
4. **Un pedido en el tope sigue entrando** (FR-006): la regla 1 vale igual, con
   `ajuste > 0` permitido.
5. **Si algo se corta, es el comentario** (FR-008): cuando
   `comentarioCortado === true`, los elementos de `bloque: "entrega"` y
   `bloque: "retiro"` siguen completos — ningun texto de esos bloques termina en
   la marca de corte. **Y ademas `ajuste === 1`**: no se corta nada mientras
   quede aire sin usar en algun bloque.
6. **No existe la pagina dos** (FR-004): no hay campo donde expresarla.
7. **La hoja no lleva nada mas** (FR-002b): fuera de `recorte` solo existen las
   `marcas`. La estructura no tiene donde poner un pie de pagina ni una linea de
   instrucciones, y la prueba lo afirma sobre `elementos` + `marcas`.

---

## Por que no hay `contracts/`

Este feature no expone ni consume ninguna interfaz externa. No hay endpoint, no
hay comando, no hay formato de intercambio: el unico artefacto que sale del
producto es un PDF que se descarga, y **su contrato es el papel**, que es lo que
verifica `quickstart.md` con una regla. La carpeta no se crea vacia.
