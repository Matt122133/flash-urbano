# Phase 1 — Data model: Dirección por cruce de calles

**Feature dir**: `specs/003-direccion-por-esquina` | **Date**: 2026-08-04

Dos cosas distintas viven acá y conviene no confundirlas: **el índice**, que es
dato generado y sólo se lee, y **la dirección**, que es lo que el cliente arma
y lo que mañana va a ser una fila en una tabla.

## El índice de calles — `web/public/calles-mvd.json`

Generado por `web/design-source/build-calles.js`. **No se edita a mano.**
Regenerable. Recortado al área de servicio.

### Calle

Una vía con nombre dentro del área de servicio.

| Campo | Qué es |
|---|---|
| `nombre` | El nombre tal como se muestra: `Avenida 18 de Julio` |
| `busqueda` | El nombre normalizado: minúsculas, sin tildes, espacios colapsados |
| `canonico` | `busqueda` sin el prefijo de tipo de vía (`avenida`, `bulevar`, `calle`, `camino`, `pasaje`, `continuación`, `rambla`, `ruta`) |

**La identidad de una calle es `nombre`, no `canonico`.** `canonico` sirve sólo
para que tipear "varela" encuentre `José Pedro Varela` y
`Avenida José Pedro Varela`. Agrupar geometría por `canonico` juntaría calles
homónimas de barrios distintos — ver research R3, donde eso hacía que
`josé pedro varela` midiera 15,6 km.

Volumen medido: **6.184 calles**.

### Esquina

El punto donde dos calles se cruzan. Es lo que el formulario resuelve.

| Campo | Qué es |
|---|---|
| `calleA`, `calleB` | Referencias a dos `Calle` distintas |
| `punto` | Latitud y longitud del cruce |
| `contiguasA` | Las esquinas vecinas sobre `calleA`: hasta dos, una para cada lado |
| `contiguasB` | Lo mismo sobre `calleB` |

`contiguasA` y `contiguasB` son lo que hace calculable la región de arrastre sin
embarcar la geometría completa (research R7). Se guardan como desplazamientos
respecto de `punto`, con resolución de aproximadamente un metro: números chicos
y repetidos, que es lo que comprime bien.

Un par de calles puede producir **más de una esquina** — calles que se cruzan
dos veces, u homónimas en barrios distintos. Por eso `calleA` + `calleB` **no
es clave única**, y por eso existe FR-021: ante más de un resultado se muestran
todos y elige el cliente.

Volumen medido: **23.191 esquinas**, tras colapsar las calzadas dobles a 60 m.

### Reglas de construcción

Salen de research R1, R3 y R4, y son las que el índice tiene que respetar:

- Un tramo sin nombre no entra. Son 10.624 en el recuadro (35%).
- Un tramo con nombre genérico de clasificación vial no entra: `Vehicular/
  Peatonal` y similares, 445 tramos.
- Las esquinas se calculan por intersección geométrica real, no agrupando
  extremos compartidos — el atajo pierde el 80%.
- Puntos del mismo par de calles a menos de 60 m se colapsan en uno, con el
  centroide como resultado.
- Sólo entra lo que cae dentro del área de servicio más un margen.

## La dirección — `web/lib/direccion.ts`

Lo que el cliente arma en el formulario. **Es la forma que mañana se persiste
por pedido**, así que se define una vez y se respeta (FR-025).

| Campo | Obligatorio | Qué es |
|---|---|---|
| `calle` | sí | Nombre de calle como se muestra |
| `esquina` | sí | Nombre de la calle que la cruza |
| `numero` | no | Número de puerta. Texto libre, informativo |
| `apto` | no | Texto libre |
| `cooperativa` | no | Booleano |
| `punto` | **sólo retiro** | Latitud y longitud resueltas |
| `zona` | **sólo retiro** | La zona que contiene a `punto` |
| `precio` | **sólo retiro** | El precio de esa zona |

`punto`, `zona` y `precio` son opcionales **por diseño**: el retiro los tiene,
la entrega no, porque la entrega quedó como texto libre (FR-007a). La entrega
entra igual en este molde para que el día que se persista no haya dos formas de
dirección conviviendo.

`zona` y `precio` **no se guardan como estado independiente**: se derivan de
`punto` en cada render, que es la disciplina que ya sigue `pedido-form.tsx` hoy
—  *"el punto es la única fuente de verdad del precio"*. Aparecen en la tabla
de arriba porque son parte de la dirección **cuando se persiste**: ahí sí hay
que congelarlos, o un cambio futuro de límites reescribiría lo ya cobrado.

### Ciclo de vida en el formulario

```text
vacía
  → con calle              (elegida del autocompletado)
  → con calle y esquina    (la esquina sólo ofrece calles que cruzan)
  → ambigua                (más de un cruce: se muestran y se elige)
  → resuelta               (hay punto, zona y precio; aparecen los complementos)
  → ajustada               (el pin se movió dentro de la región permitida)
  → fuera de zona          (hay cruce pero no cae en ninguna zona: sin precio)
```

Transiciones que importan:

- Cambiar `calle` o `esquina` desde *resuelta* o *ajustada* vuelve el bloque
  atrás e **invalida `punto`, `zona`, `precio` y los complementos** (FR-013).
  Quedarse con el punto viejo mostraría un precio que ya no corresponde a la
  dirección escrita.
- *fuera de zona* no es un error ni un estado intermedio: es un final. Sin
  precio y sin pedido, deriva a contacto directo (FR-019, Principio V).
- *ajustada* nunca puede salir de la región permitida: el arrastre se clampea
  en el momento, no se rechaza al enviar (FR-015).

## Región permitida

No es una entidad guardada: se calcula al resolver la esquina.

Es el buffer alrededor de la polilínea `contigua anterior → esquina → contigua
siguiente` sobre **la calle declarada** — no sobre la esquina, porque la puerta
pertenece a la calle. Ancho del orden de 50 m a cada lado, para cubrir veredas
y retiros.

Dentro de esa región el punto es libre: no se proyecta ni se imanta al eje, así
que puede quedar sobre la vereda o sobre el edificio, que es lo que el
repartidor necesita ver.

Si la esquina no tiene contigua de un lado — es la punta de la calle — ese lado
se acota con la esquina misma.
