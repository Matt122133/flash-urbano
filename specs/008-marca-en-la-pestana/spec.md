# Feature Specification: La marca en la pestaña

**Feature Branch**: `marca-en-la-pestana`

**Created**: 2026-08-12

**Status**: Draft

**Input**: El dueño del proyecto notó el 2026-08-12 que la pestaña del navegador
muestra un triángulo blanco en vez del logo, y pidió que aparezca la marca — "de
última solo un camión blanco".

## Lo que hay hoy

`web/app/favicon.ico` es **el logo de Vercel**: el archivo que deja
`create-next-app`, sin tocar desde el 2026-08-02, cuando se armó el MVP.
Verificado analizando el binario — tiene cuatro tamaños, y el de 32×32 es 66 %
negro, 21 % transparente y 7 % blanco, **con cero azul y cero naranja**. No hay
un solo pixel de Flash Urbano ahí.

No es un defecto funcional. Es que **el sitio de un negocio real se presenta con
el logo de la herramienta con la que se construyó**, en el único lugar de la
pantalla que queda visible cuando la pestaña no está en foco, y en un sitio que
desde `009` vive en su propio dominio.

## Alcance

Reemplazar el icono del sitio por la marca de Flash Urbano, en los formatos que
usan los navegadores y el teléfono.

**No entra**: rediseñar el logo, tocar el logo de la navegación, ni agregar
imágenes de previsualización para redes (Open Graph). Son features distintas y
ninguna es esto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La pestaña dice de quién es (Priority: P1)

Alguien abre el sitio y deja la pestaña abierta mientras hace otra cosa. Al
volver, reconoce cuál es entre ocho pestañas por el icono, sin leer el título.

**Why this priority**: Es el feature entero.

**Independent Test**: Abrir el sitio en Chrome y en Firefox, con **tema claro y
tema oscuro**, y comprobar que el icono se ve y se distingue en los cuatro casos.

**Acceptance Scenarios**:

1. **Given** el sitio publicado, **When** alguien lo abre en una pestaña,
   **Then** ve el camión de Flash Urbano, no un triángulo.
2. **Given** una pestaña con **tema claro**, **When** se muestra el icono,
   **Then** se distingue del fondo. Un camión blanco sobre transparente no
   cumple esto, y es el motivo por el que va sobre el azul de marca.
3. **Given** una pestaña con **tema oscuro**, **When** se muestra el icono,
   **Then** también se distingue.
4. **Given** un teléfono, **When** alguien agrega el sitio a la pantalla de
   inicio, **Then** el ícono es la marca y no una captura de la página.

### Edge Cases

- **El icono a 16×16.** Es el tamaño real de una pestaña. El logo completo
  —texto, camión y barra— es ilegible ahí; por eso se usa sólo el camión. **Si
  el camión recortado tampoco se lee a 16 px, hay que simplificarlo**, y eso es
  una decisión que se toma mirando el resultado, no antes.
- **El navegador cachea el favicon con ganas.** Un icono viejo puede sobrevivir
  a varios despliegues. La verificación tiene que hacerse en una ventana privada
  o forzando el recargado, o se va a "comprobar" el icono anterior.
- **El export estático.** El sitio se publica sin servidor. Los iconos tienen
  que quedar como archivos en el export, no depender de que Next los genere en
  tiempo de pedido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sitio MUST mostrar la marca de Flash Urbano como icono de
  pestaña, en lugar del icono por defecto de la herramienta de build.
- **FR-002**: El icono MUST ser legible a **16×16**, que es el tamaño real de
  una pestaña.
- **FR-003**: El icono MUST distinguirse tanto en pestañas de tema claro como de
  tema oscuro. Esto descarta un camión blanco sobre fondo transparente.
- **FR-004**: El icono MUST derivarse del logo existente
  (`web/public/logo-flash-urbano.png`), no de un dibujo nuevo hecho a ojo, para
  que sea la misma marca y no una parecida.
- **FR-005**: El sitio MUST ofrecer un icono para la pantalla de inicio de un
  teléfono. Los clientes entran desde el teléfono: es el Principio IV aplicado a
  esta superficie.
- **FR-006**: Los iconos MUST quedar como archivos en el export estático, sin
  depender de generación en tiempo de pedido.
- **FR-007**: La generación de los iconos MUST ser **repetible desde el repo**,
  con un script versionado, y no un archivo binario que alguien produjo una vez
  en su máquina y nadie sabe cómo rehacer.
- **FR-008**: El feature MUST NOT tocar el logo de la navegación ni ninguna
  pantalla. Es el icono del sitio y nada más.

### Key Entities

- **Marca de pestaña**: El camión del logo, blanco, sobre un cuadrado redondeado
  en el azul de marca. El azul es **`#032F9A`**, medido del propio logo, no
  elegido a ojo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La pestaña muestra el camión en Chrome y Firefox, en tema claro y
  oscuro — **cuatro combinaciones, las cuatro comprobadas**.
- **SC-002**: A 16×16 se distingue que es un camión. Verificado mirando el
  archivo al tamaño real, no una ampliación.
- **SC-003**: Agregar el sitio a la pantalla de inicio de un teléfono muestra la
  marca.
- **SC-004**: Borrar los iconos generados y correr el script del repo los
  reproduce.
- **SC-005**: El export estático contiene los archivos de icono.
- **SC-006**: Ninguna pantalla del sitio cambia. El logo de la navegación queda
  igual.

## Assumptions

- **El camión es la parte reconocible del logo.** Es la decisión del dueño del
  proyecto del 2026-08-12, y coincide con que el resto del logo es texto, que a
  16 px no se lee.
- **El azul de marca es `#032F9A`.** Medido sobre `logo-flash-urbano.png`: es el
  color exacto más frecuente entre los azules del archivo. No se inventa un azul
  "parecido".
- **El camión ocupa `x 430–599, y 5–168` del logo**, o sea 170×164 px — casi
  cuadrado, así que entra en un icono cuadrado sin deformarse. Medido, no
  estimado.
- **`sharp` ya está disponible** (0.35.3) y el repo ya lo usa en
  `web/design-source/make-logo-transparent.js`. No hace falta ninguna
  dependencia nueva.
- **El logo tiene el fondo transparente**, y las contraformas internas del
  camión —ventana, huecos de las ruedas— también. Sobre el azul del icono, ese
  azul vuelve a asomar por donde asomaba en el logo original, que es como el
  camión fue dibujado.

## Dependencies

- `web/public/logo-flash-urbano.png` — la fuente. No se modifica.
- `web/design-source/make-logo-transparent.js` — el precedente de cómo este repo
  procesa el logo. El script nuevo sigue esa forma.
- Next 16 resuelve los iconos por convención de archivo en `app/`. Antes de
  escribir código hay que leer
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`,
  como manda [`web/AGENTS.md`](../../web/AGENTS.md).
