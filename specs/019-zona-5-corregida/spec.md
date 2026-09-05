# Feature Specification: El borde corregido de la zona 5 llega al sitio

**Feature Branch**: `019-zona-5-corregida`

**Created**: 2026-09-05

**Status**: Draft

**Input**: Mateo, el 2026-09-05, trayendo una lista de cambios que junto con
Diego. Sobre este punto dio el trabajo por hecho: *"la parte de modificar mapa
zona 5, ya lo hice en el .kml y son los cambios que estan ahora. asique eso ya
quedaria tachado"*. El item sale de la seccion **MODIFICACIONES** del documento
del cliente, donde figura como *"modificar mapa zona 5"*.

## El problema: el KML no es lo que el sitio lee

El trazado esta editado y el cambio **no esta en el sitio**. Son dos archivos
distintos y solo uno decide algo:

- `web/design-source/zonas-flash-urbano.kml` — la fuente, editada a mano el
  2026-09-05, **sin commitear**.
- `web/lib/zonas.ts` — **generado** por `design-source/build-zonas.js`, y el
  unico que el sitio importa. Sin tocar desde `013`.

Nada corre ese generador solo. Mientras no se ejecute y se commitee, el borde
nuevo existe unicamente en la maquina de Mateo, y produccion sigue resolviendo
con el viejo. Eso no es un mapa desactualizado: desde `013` **la zona decide si
el pedido se toma o no** (Principio V), asi que un borde viejo es un pedido de
Ciudad de la Costa rechazado, o uno aceptado donde ya no se llega.

## Lo que el cambio toca de verdad: dos zonas, no una

El pedido se llama *"modificar mapa zona 5"* y **el archivo modifica dos
poligonos**: `Zona 5` y `Zona 1`. Los dos crecen sobre el mismo tramo de borde
compartido, en sentidos opuestos —Zona 5 gana los vertices en un orden y Zona 1
los mismos al reves—, que es la forma que tiene un limite movido de escribirse
en un KML donde cada zona es un anillo cerrado independiente.

**La verificacion no puede mirar solo la zona 5.** Si los dos anillos quedaron
desalineados, aparece un hueco o un solape en el medio de Montevideo, y ninguna
prueba existente lo mira. Lo que el trazado hace de verdad esta medido en
[research.md](research.md), sobre una grilla de ~50 m y con la misma regla que
usa el sitio:

| | puntos de grilla | que significa |
|---|---:|---|
| `Zona 1 -> Zona 5` | 135 | el borde se movio |
| `fuera -> Zona 5` | 82 | **cobertura nueva** (~0,2 km2) |
| `Zona 5 -> fuera` | 44 | fleco de borde |
| `Zona 1 -> fuera` | 35 | fleco de borde |

Los 79 puntos que salen de cobertura **no son un hueco**: cada uno queda a menos
de 96 m de area que sigue cubierta, con mediana de 41 m. Es el borde corriendose
menos de una cuadra, visto con una grilla de 50 m. Las zonas 2, 3 y 4 no se
tocan.

## Lo que este feature no hace

- **No toca logica.** La constitucion exige que un borde corregido se regenere
  sin tocar codigo, y esa propiedad se comprueba aca: si hiciera falta editar
  `zona-lookup.ts` para que el borde nuevo funcione, el defecto seria del diseño
  y no del borde.
- **No redibuja nada.** El trazado que se publica es exactamente el que ya esta
  en el KML. Si el trazado esta mal, se corrige el KML y se vuelve a generar; no
  se ajusta la salida.
- **No revisa los precios.** `zonas.ts` sigue llevando el `precio` por zona
  porque el generador lo escribe, pero desde `013` no lo lee nadie y el
  Principio V prohibe leerlo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un cliente pide un envio a la parte de la zona 5 que Diego agrego (Priority: P1)

Alguien carga un pedido cuya entrega cae en el tramo que el trazado nuevo suma a
la zona 5 y que el viejo dejaba afuera. Marca el punto en el mapa y el sitio le
confirma que se llega hasta ahi, nombrando la zona.

**Why this priority**: Es el feature entero. Todo lo demas es como se comprueba.

**Independent Test**: Se resuelve un punto del tramo agregado contra las zonas
publicadas y se comprueba que devuelve `Zona 5` en vez de nada.

**Acceptance Scenarios**:

1. **Given** un punto dentro del tramo que el trazado nuevo agrega a la zona 5,
   **When** se resuelve su zona, **Then** devuelve la zona 5 y el pedido se puede
   confirmar.
2. **Given** un punto que estaba dentro de la zona 5 en el trazado viejo y que el
   nuevo deja afuera de toda zona, **When** se resuelve su zona, **Then** no
   devuelve ninguna y el sitio encamina al contacto directo, **sin** caer en la
   zona mas cercana.
3. **Given** el mapa de `/sobre-nosotros` y el de `/pedido`, **When** se abren,
   **Then** los dos dibujan el borde nuevo, porque leen la misma fuente.

---

### User Story 2 - El borde movido no abre un hueco (Priority: P1)

Zona 1 y zona 5 se redibujaron por separado sobre el mismo tramo. Si los dos
anillos no coinciden, queda una franja que no es de nadie, y ahi el sitio
rechaza pedidos en el medio de la ciudad sin que nada lo delate.

**Why this priority**: Misma prioridad porque es invisible mirando el mapa —una
franja de una cuadra no se ve— y porque cuesta un pedido perdido cada vez.

**Independent Test**: Se compara el trazado nuevo contra el viejo sobre una
grilla y se mide cuanto se aleja de la cobertura cada punto que la perdio.

**Acceptance Scenarios**:

1. **Given** el trazado nuevo, **When** se mide cada punto que dejo de tener
   zona, **Then** ninguno queda a mas de 100 m de area cubierta — o sea, el borde
   se movio, no se abrio un hueco.
2. **Given** los dos anillos nuevos, **When** se busca un punto que caiga dentro
   de los dos a la vez, **Then** no hay ninguno, igual que en el trazado viejo.
   El desempate de `resolverZonaEntre` —gana el menor precio, y a igual precio el
   id menor— **no interviene entre estas dos zonas** y este feature no lo toca.

---

### User Story 3 - Las cinco zonas siguen siendo las de antes (Priority: P2)

Nada mas que el tramo movido cambia de zona.

**Why this priority**: Es la red que atrapa un KML editado con la mano
equivocada. Barata: la prueba ya existe.

**Independent Test**: Las cinco referencias de barrio de `zona-lookup.test.ts`
siguen resolviendo a la misma zona que antes.

**Acceptance Scenarios**:

1. **Given** los cinco puntos de referencia de barrio que la prueba ya usa,
   **When** se resuelven contra las zonas regeneradas, **Then** cada uno devuelve
   la misma zona que devolvia antes.
2. **Given** los puntos fuera de cobertura que la prueba ya usa, **When** se
   resuelven, **Then** siguen sin devolver zona.

---

### Edge Cases

- **Un anillo que no cierra.** El generador lo rechaza y no escribe salida: un
  archivo generado a medias es peor que ninguno. Si eso pasa, el defecto esta en
  el KML.
- **135 puntos de grilla pasan de zona 1 a zona 5.** Es lo que significa mover un
  limite y no es un defecto, pero **el cliente tiene que saberlo**: el pedido
  decia "modificar mapa zona 5" y esto cambia tambien lo que se le nombra a quien
  entrega ahi. Como el precio no se muestra desde `013`, el efecto visible es el
  nombre de la zona; el efecto real es de que lado del borde trabaja Diego.
- **Un punto de otra zona que cambia de respuesta.** Las zonas 2, 3 y 4 estan
  medidas como intactas. Si alguna cambiara, hay que parar y mirar el trazado —
  nunca actualizar la prueba para que pase.
- **Un pedido ya guardado en el tramo que salio de la zona 5.** No se recalcula
  nada: el pedido guardo su punto y su zona cuando se creo. Repetirlo si
  revalida la entrega, y ahi el cliente vera que ya no se llega — que es el
  comportamiento correcto y ya construido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Las zonas que el sitio publica MUST derivarse del KML actual,
  regeneradas con el generador existente y sin edicion manual del archivo
  generado.
- **FR-002**: La regeneracion MUST NOT requerir ningun cambio en la logica que
  resuelve zonas. Si lo requiriera, se detiene el trabajo y se levanta como
  defecto de diseño.
- **FR-003**: Un punto en el tramo que el trazado nuevo suma a la zona 5 MUST
  resolver a la zona 5.
- **FR-004**: Ningun punto que pierda cobertura con el trazado nuevo MUST quedar
  a mas de **una cuadra** —100 m, que es el largo tipico de una manzana en la
  trama de Montevideo— de area cubierta. Un fleco de borde es aceptable; un hueco
  no.

  El umbral es la cuadra, no el 96 m que dio la medicion. Se dice porque el orden
  en que pasaron las cosas invita a confundirlos: primero se midio, despues se
  escribio el requisito. Un numero elegido para que la medicion pase no es un
  criterio, es un sello. La justificacion es que si un punto queda a menos de una
  cuadra de cobertura, la direccion de esa cuadra sigue estando en zona; a mas de
  una cuadra, empieza a haber puertas del lado de afuera.
- **FR-005**: Las cinco zonas MUST seguir resolviendo los puntos de referencia
  que la prueba de zonas ya verifica.
- **FR-006**: Un punto fuera de todas las zonas MUST seguir sin devolver zona, y
  el sitio MUST seguir encaminando al contacto directo. **Nunca la zona mas
  cercana** (Principio V).
- **FR-007**: El KML editado MUST quedar versionado en el mismo commit que el
  archivo generado, para que el borde publicado siempre tenga su fuente al lado.
- **FR-008**: El trazado publicado MUST corresponder a lo que Diego pidio. Es una
  comprobacion humana —mirar el mapa dibujado antes de desplegar—, no una prueba
  automatica: la constitucion prohibe que llegue a produccion un limite que el
  cliente no confirmo, y quien dibujo este no fue el.

### Key Entities

- **Zona** — una de las cinco areas de cobertura: id, nombre, color, anillo de
  vertices, y un precio que ya no se muestra ni se lee. Decide si un envio se
  toma.
- **El KML** — la fuente autoritativa del trazado, editada por fuera del codigo.
- **`zonas.ts`** — la proyeccion tipada de ese KML que el sitio importa. Generada,
  nunca editada a mano.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un pedido con entrega en el tramo agregado a la zona 5 se puede
  confirmar, donde antes no se podia.
- **SC-002**: Cero puntos a mas de una cuadra (100 m) de cobertura entre los que
  la perdieron. Medido antes de publicar: maximo 96 m, mediana 41 m. **Pasa por
  4 m**, asi que el margen es real pero flaco: si el trazado se vuelve a tocar por
  esta zona, se vuelve a medir.
- **SC-003**: Las cinco zonas resuelven igual que antes en todo punto que el
  trazado no movio.
- **SC-004**: El trazado se corrige y se publica sin modificar una sola linea de
  logica.

## Assumptions

- El trazado que esta hoy en el KML es el que Diego pidio. Mateo lo dibujo a
  partir de lo que le indico; FR-008 existe porque eso es un supuesto y no un
  hecho verificado.
- Los dos poligonos modificados son `Zona 5` y `Zona 1`, leidos del archivo. El
  pedido nombraba solo la zona 5.
- La regla de seleccion de `resolverZonaEntre` —gana el menor precio, y a igual
  precio el id menor— se mantiene sin cambios. Medido: entre zona 1 y zona 5 no
  llega a intervenir, porque sus anillos no se solapan en ningun punto.
- El sitio se despliega como export estatico, asi que el borde nuevo llega a la
  gente recien con el proximo deploy de `web/`.
