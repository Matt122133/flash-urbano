# Data Model: La etiqueta que se pega al paquete

**No se agrega ni se guarda ningun dato.** La etiqueta es una **vista**: se
recompone cada vez desde el pedido y no existe en ningun lado despues de que el
PDF se descarga. Este archivo describe la unica estructura nueva —la que viaja
entre la composicion y el dibujo— y por que existe.

## El problema que resuelve: dos formas del mismo pedido

```text
Confirmacion                          Mis pedidos
FormState + codigo                    PedidoGuardado
  name, phone                           remitenteNombre, remitenteTelefono
  retiro.direccion (Direccion)           retiro (DireccionGuardada)
  entrega.direccion (Direccion)          entrega (DireccionGuardada)
  quantity: string                       cantidad: number
  pickupDate: string                     retiroFecha: string
  receiverName, receiverPhone            destinatarioNombre, destinatarioTelefono
        |                                       |
        +---------------+-----------------------+
                        v
                    Etiqueta            <- el tipo neutro
                        v
                  el PDF dibujado
```

Los nombres de campo no coinciden, los tipos tampoco (`quantity` es texto de un
`<input>`, `cantidad` es un numero del servicio), y las direcciones vienen en dos
formas. **Sin el tipo del medio, la hoja se arma dos veces**, y el mismo pedido
impreso desde los dos lados puede diferir sin que nadie lo note.

## Etiqueta

Lo que se imprime, ya resuelto: sin opcionales que el dibujo tenga que
interpretar, sin campos que dependan de la pantalla de origen.

| campo | tipo | notas |
|---|---|---|
| `codigo` | texto | `FU-####`. El elemento dominante de la hoja. |
| `entrega.nombre` | texto | destinatario |
| `entrega.telefono` | texto | |
| `entrega.direccion` | texto | **ya compuesta** por `lib/direccion.ts` (FR-010) |
| `entrega.zona` | texto \| ausente | el nombre, `"Zona 3"`. **Ausente**, no vacio, cuando el pedido no tiene punto de entrega. |
| `retiro.nombre` | texto | remitente |
| `retiro.telefono` | texto | |
| `retiro.direccion` | texto | ya compuesta |
| `fechaRetiro` | texto | `YYYY-MM-DD` tal como se guarda. No es un instante. |
| `cantidad` | numero | |

**Ausente y no vacio**, para la zona, por el mismo motivo que `016` lo hizo con
quien recibio: deja distinguir "no hay punto guardado" de "hay punto y la zona
dio vacio", sin que el dibujo tenga que adivinar. Un `""` obligaria a decidir en
el layout si dejar el renglon o no, que es exactamente donde aparecen los huecos
raros.

### Lo que el tipo NO tiene, y es deliberado

- **Ningun importe.** Principio V, FR-007. **No es que se deje sin dibujar: no
  existe en la estructura.** Por eso la prueba de FR-007 puede ser una afirmacion
  sobre este objeto y no un raspado del PDF.
- **`paqueteTamano` ni `retiroHora`.** Desde `014` son `chico` y `16:00` fijos:
  relleno, no datos (FR-008).
- **La cedula de quien recibio.** El servicio no se la manda al cliente (`016`).
- **El estado.** Cambia; el papel no.
- **Coordenadas.** La etiqueta lleva direcciones escritas. El punto se usa para
  resolver la zona y no se imprime.

## De donde sale cada cosa

| campo | desde la confirmacion | desde Mis pedidos |
|---|---|---|
| `codigo` | el que devolvio el servicio | `pedido.codigo` |
| `retiro.nombre` / `.telefono` | `form.name` / `form.phone` | `remitenteNombre` / `remitenteTelefono` |
| `entrega.nombre` / `.telefono` | `form.receiverName` / `form.receiverPhone` | `destinatarioNombre` / `destinatarioTelefono` |
| direcciones | `componerDireccion(form.*.direccion)` | `componerDireccion` sobre la guardada |
| `entrega.zona` | `resolverZona(form.entrega.direccion.punto)` | `resolverZona(pedido.entrega.punto)` |
| `fechaRetiro` | `form.pickupDate` | `pedido.retiroFecha` |
| `cantidad` | `Number(form.quantity)` | `pedido.cantidad` |

La columna de la derecha es la unica que puede quedarse sin punto de entrega —un
pedido anterior a `011`—, y ahi `zona` viene ausente.

## Assets

| archivo | que es |
|---|---|
| `public/logo-flash-urbano.png` | la marca original, **fuente**. 600x245, con canal alfa. Para fondo azul: la mitad de sus elementos son blancos. |
| `public/silueta-camion.png` | **GENERADO** por `design-source/build-silueta.js`. Negro sobre transparente, ~3,5 KB. Nunca se edita a mano. |

Misma relacion que `zonas.ts` con su KML, y con la misma trampa: **el generado no
se actualiza solo**. Si el logo cambia, hay que volver a correr el script.
