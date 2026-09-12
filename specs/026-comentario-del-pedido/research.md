# Research: El comentario del pedido

**Fase 0** de [plan.md](plan.md). Cada decisión es un hallazgo del código, no una
preferencia: la que importa (D1) sale de un contrato que ya existe y que la
respuesta del clarify no podía conocer.

---

## D1 — En la app NO hay dónde "abrir" el pedido, y eso cambia el diseño

**Hallazgo.** El spec dice, en D1, que en la app la lista *marca* el pedido y el
texto completo se lee *al abrirlo*. **No existe ese "abrir".**

`specs/012-app-repartidor/contracts/servicio-y-pantallas.md` §4.2 fija que cada
pedido muestra, **sin desplegar nada**: el código, de dónde retira y a dónde
lleva, tamaño y cantidad, y los dos teléfonos. Y `Principal.kt` lo repite en el
código, con el motivo:

> **Nada se plegó.** El contrato 4.2 dice que la tarjeta muestra todo sin
> desplegar y no se toca: Diego no puede tener que tocar para leer una dirección
> parado en una puerta.

`HojaEntrega.kt` no es una pantalla de detalle: es la hoja de confirmación de
entrega, con el nombre y el documento de quien recibió (migración `0006`).

**Decisión**: el comentario se muestra **dentro de la tarjeta**, como un bloque
propio y visualmente distinto del resto —no una línea más entre las direcciones—,
y **sólo aparece en los pedidos que lo tienen**. No se crea pantalla de detalle,
no se pliega nada, la tarjeta sigue sin ser tocable.

**Rationale**: es la única forma que respeta 4.2 y que cumple lo que Mateo pidió
—"que le marca el pedido justamente para que sepa si hay alguna forma específica
de entregar algo"—. La intención de esa frase es que Diego lo sepa **al decidir
qué lleva**, y con el texto en la tarjeta lo sabe sin tocar nada: es más directo
que una marca que obligue a abrir algo. El tope de 280 caracteres acota el
crecimiento a unos tres renglones, y sólo en los pedidos que traen indicación.

**Alternativas consideradas**:

- *Marca en la lista y texto en un detalle*: es lo que decía D1 literalmente.
  **Rechazada**: exige inventar la pantalla de detalle que 4.2 prohíbe, y
  obligaría a Diego a tocar para leer justo lo que necesita parado en la puerta.
- *Sólo una marca, sin el texto*: le dice que hay algo y no le dice qué. Diego
  tendría que llamar al cliente para enterarse, que es el canal que esta función
  vino a sacar del medio.

**Esto contradice la letra de D1 y hay que decirlo en la promoción del plan.** Si
Mateo prefiere la pantalla de detalle, se puede: cuesta enmendar el contrato 4.2
de `012`, no este plan.

---

## D2 — El impreso es la etiqueta que se pega al paquete, no un resumen privado

**Hallazgo.** Lo que se imprime **no es un resumen para el cliente**: es la
etiqueta que se pega al paquete. `web/lib/etiqueta.ts` lo dice en la primera
línea: *"Lo que se imprime y se pega al paquete"*. La dibuja `etiqueta-pdf.ts`,
y el corte entre las dos existe para poder afirmar cosas sobre el texto en una
prueba en vez de raspar bytes de un PDF.

**Consecuencia que el spec no había visto**: FR-013 dice que la indicación viaja
sólo entre el cliente y la administración. **Una etiqueta pegada al paquete la
lee cualquiera que lo manipule**, incluido quien recibe. No es privada.

**Decisión**: el comentario **sí va en la etiqueta** —Mateo lo pidió explícito,
"se lee en el resumen, en el pdf que se arma cuando se quiere imprimir"— y
FR-013 se corrige para que no prometa una privacidad que el papel no puede dar.
El texto de ayuda del campo (FR-001a) es el lugar donde el cliente se entera de
que lo que escriba puede ir impreso en el paquete.

**Rationale**: una indicación de entrega en la etiqueta del paquete es
justamente donde sirve. Lo que no se puede es prometer confidencialidad y
después imprimirla.

**Alternativa considerada**: imprimirla sólo en la copia del cliente y no en la
etiqueta. **Rechazada**: la etiqueta es el único impreso que existe; no hay dos
documentos que separar.

---

## D3 — Agregar el campo NO rompe la app que Diego ya tiene instalada

**Hallazgo.** `datos/Pedido.kt` lee la respuesta con
`Json { ignoreUnknownKeys = true }`, y el archivo explica por qué en términos
que aplican exactamente a este caso:

> `ignoreUnknownKeys` NO es comodidad: (…) **el día que el servicio agregue un
> campo la app deja de andar entera**, y la única forma de arreglarlo es
> instalar un archivo nuevo a mano en el teléfono de otra persona.

**Decisión**: el servicio puede desplegar el campo nuevo **antes** de que el APK
esté publicado, sin coordinación. La app vieja lo ignora y sigue funcionando.

**Rationale**: desacopla el despliegue de las dos superficies, que es lo que
salva a esta feature de necesitar una ventana coordinada con el teléfono de otra
persona.

**Consecuencia operativa**: FR-011 queda cubierto por una propiedad que ya
existe, no por trabajo nuevo. Lo que sí hay que hacer es **no romperla**: el
campo se agrega como opcional en Kotlin, con `null` por defecto, igual que
`Direccion.punto`, que documenta la misma trampa.

---

## D4 — La indicación se guarda como columna del pedido, no como tabla aparte

**Decisión**: una columna `comentario text` en `pedidos`, anulable, sin default,
con un `CHECK` de largo máximo. Migración nueva `0009`.

**Rationale**: es un atributo del pedido, uno por pedido (D2 del spec), sin
historial ni autor ni hilo. Una tabla aparte agregaría un `JOIN` a todas las
consultas de `pedidos` a cambio de nada. La constitución tiene *Simplicity over
infrastructure* como Principio III.

**El `CHECK` va en la base y no sólo en el servicio**: es la única capa por la
que pasan sí o sí las tres superficies y la carga manual. El tope de 280 se
valida además en el navegador (para avisar mientras se escribe) y en el servicio
(para rechazar), pero la base es la que lo garantiza.

**Anulable y no `NOT NULL DEFAULT ''`**: "sin comentario" y "comentario vacío"
tienen que ser el mismo estado, y `NULL` lo dice sin ambigüedad. FR-004 —el
texto de sólo espacios cuenta como ausencia— se implementa recortando en el
servicio y guardando `NULL` si queda vacío, así la regla vive en un solo lugar.

---

## D5 — `internal/tablero` NO se toca, y hay una guarda que lo sostiene

**Hallazgo.** `025` dejó `internal/tablero` sin importar `internal/pedidos`, con
una prueba que lo verifica, y su consulta selecciona columnas explícitas
(`SELECT creado_en, cantidad, usuario_id`).

**Decisión**: la columna nueva no entra en esa consulta y el paquete no se toca.
FR-012 —el tablero sigue sin mostrar detalle— queda cubierto sin trabajo.

**Rationale**: agregar la columna a `pedidos` no la mete en el tablero porque el
tablero nombra las columnas que quiere. Es exactamente el beneficio de no haber
escrito `SELECT *`.

---

## D6 — Dónde toca el web, pantalla por pantalla

**Hallazgo**, siguiendo un campo comparable (`destinatarioTelefono`) por todo el
repositorio, que es lo que da el mapa completo de superficies:

| Archivo | Qué cambia |
|---|---|
| `web/lib/pedido.ts` | `DatosDelPedido` (lo que se tipea) y `CuerpoPedido` (lo que se manda), más `armarCuerpoPedido()` |
| `web/components/pedido-form.tsx` | el campo en pantalla, con su ayuda y su contador |
| `web/components/pedido/crear-pedido.tsx` | el estado del formulario, el resumen de confirmación y el camino de edición de `022` |
| `web/components/pedido/tarjeta-pedido.tsx` | mostrarlo en *Mis pedidos* |
| `web/lib/etiqueta.ts` | qué dice la etiqueta impresa |
| `web/lib/etiqueta-pdf.ts` | dónde se dibuja en la hoja |
| `web/lib/api.ts` | el tipo `PedidoGuardado` que devuelve el servicio |
| `web/lib/repetir.ts` | que "repetir pedido" arrastre el comentario |

**`web/lib/api.ts` aparece en la lista y hay que tener cuidado**: la guarda de
`cotizar-abierto.test.ts` exige que **el formulario no dependa del servicio**.
Tocar el *tipo* en `api.ts` no mete `api.ts` en el grafo de importación del
formulario; meter una *llamada* sí. La prueba lo va a decir.

**Sobre `repetir.ts`**: repetir un pedido arrastra el comentario. Es la decisión
por defecto y se puede discutir —una indicación puede haber sido de esa vez—,
pero el resto de los campos se repiten y hacer la excepción sin motivo sería la
sorpresa, no la regla.

---

## D7 — El precio no se toca, y conviene demostrarlo

`etiqueta.ts` ya tiene una guarda de que la etiqueta no muestra ningún importe
(Principio V), y existe `lib/sin-precio-a-la-vista.test.ts`. Este feature agrega
un campo de **texto libre del cliente** a la etiqueta: alguien podría escribir
`$300` ahí adentro.

**Decisión**: no se filtra ni se censura el texto del cliente. La guarda protege
que **el producto** no muestre el precio, no que un cliente no escriba un número
en su propia indicación. Se deja anotado para que nadie lea un falso positivo
como un defecto.
