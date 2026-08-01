# Feature Specification: Web MVP — sitio de clientes de Flash Urbano

**Feature Branch**: `001-web-mvp`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Web para que los clientes de Flash Urbano (paquetería/logística de Diego) carguen sus propios pedidos de retiro/entrega en vez de coordinar todo por WhatsApp, con secciones Sobre Nosotros, Contacto y Reseñas. Primera prioridad: algo visual y funcional para mostrarle al cliente." Derived from the client's requirements doc (Google Doc "FLASH URBANO — DOCUMENTACIÓN LOGÍSTICA Y PAQUETERÍA") and the client's Q&A answers (price is variable/address-dependent/no fixed cost, no daily delivery cap, pickup-and-delivery only, no physical location).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear pedido/paquete (Priority: P1) 🎯 MVP

Un cliente de Diego (empresa o particular) entra al sitio, completa un
formulario con los datos de su paquete (quién lo entrega/retira, dirección,
tipo de paquete, fechas) y lo envía, reemplazando la coordinación manual por
WhatsApp.

**Why this priority**: Es la razón de ser del proyecto — sacarle a Diego el
trabajo de transcribir a mano lo que los clientes le mandan por WhatsApp. Sin
esto no hay producto.

**Independent Test**: Completar el formulario con datos válidos y llegar a
una pantalla de confirmación, sin depender de ninguna otra sección del sitio.

**Acceptance Scenarios**:

1. **Given** un cliente sin cuenta (guest), **When** completa todos los campos
   obligatorios del formulario y confirma, **Then** ve una pantalla de éxito
   con un resumen de lo que cargó.
2. **Given** un cliente que deja un campo obligatorio vacío o inválido (p.ej.
   teléfono con letras), **When** intenta enviar, **Then** el formulario
   marca el error puntual y no permite el envío.
3. **Given** un cliente en un celular (viewport angosto), **When** navega el
   formulario, **Then** todos los campos y botones son usables sin zoom ni
   scroll horizontal.

---

### User Story 2 - Conocer a Flash Urbano (Sobre Nosotros) (Priority: P2)

Un cliente potencial quiere confirmar que Diego es confiable antes de dejarle
un paquete: horarios, zona de cobertura y volumen de trabajo previo.

**Why this priority**: Da confianza antes del primer pedido, pero el sitio
igual funciona sin esta sección — no es bloqueante para P1.

**Independent Test**: Navegar a "Sobre Nosotros" desde la home y ver
horarios, zona de entrega y una cifra de paquetes entregados, sin haber
tocado el formulario de pedidos.

**Acceptance Scenarios**:

1. **Given** un visitante en la home, **When** navega a "Sobre Nosotros",
   **Then** ve días/horarios de trabajo, la zona de entregas (representación
   visual) y una cifra de paquetes entregados históricamente.

---

### User Story 3 - Contactar a Flash Urbano (Priority: P2)

Un cliente con una duda que el formulario no resuelve quiere un contacto
directo.

**Why this priority**: Vía de escape para lo que el autoservicio no cubre;
igual de simple que P2 anterior, sin dependencias.

**Independent Test**: Navegar a "Contacto" y ver un link de WhatsApp que abre
un chat prellenado y un email visible/copiable.

**Acceptance Scenarios**:

1. **Given** un visitante en "Contacto", **When** toca el botón de WhatsApp,
   **Then** se abre WhatsApp (o `wa.me`) con el número de Diego.
2. **Given** un visitante en "Contacto", **When** mira la sección, **Then** ve
   una dirección de email visible.

---

### User Story 4 - Ver reseñas (Priority: P3)

Un cliente quiere ver qué opinan otros clientes antes de usar el servicio.

**Why this priority**: El propio cliente (Diego) marcó esta sección como
"última cosa a realizar" en el brief — se modela pero no se construye en el
MVP visual.

**Independent Test**: Navegar a "Reseñas" y ver un placeholder claro de
"próximamente", sin errores ni contenido roto.

**Acceptance Scenarios**:

1. **Given** un visitante, **When** navega a "Reseñas", **Then** ve un aviso
   de sección en construcción en vez de una página vacía o rota.

---

### Edge Cases

- ¿Qué pasa si el cliente no completa el apto? Es el único subcampo
  opcional de la dirección; el formulario debe aceptar el envío igual.
  Calle, número y esquina son obligatorios porque el operador los necesita
  para ubicar el domicilio al armar la ruta.
- ¿Qué pasa si el cliente elige "Descripción libre" en vez de un tipo de
  paquete predefinido? Debe poder escribir texto libre y el envío sigue
  siendo válido con esa sola descripción.
- ¿Qué pasa si el visitante abre el sitio desde un navegador sin WhatsApp
  instalado? El link de WhatsApp usa `wa.me`, que redirige a WhatsApp Web
  como fallback.
- ¿Qué pasa si el cliente recarga la página después de confirmar un pedido?
  Sin backend en este milestone (ver Assumptions), la confirmación se pierde;
  aceptable para esta etapa visual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sitio MUST permitir crear un pedido como invitado (guest),
  sin requerir cuenta.
- **FR-002**: El formulario MUST mostrar un botón de "Iniciar sesión con
  Google" visible pero puede quedar deshabilitado/"próximamente" en este
  milestone (ver Assumptions) — no bloquea el flujo guest.
- **FR-003**: El formulario MUST capturar si el pedido es de una empresa o un
  particular.
- **FR-004**: El formulario MUST capturar nombre y teléfono de quien pide el
  envío.
- **FR-005**: El formulario MUST capturar una dirección compuesta: calle,
  número de puerta y esquina (obligatorios), apto (opcional), y si el
  domicilio es una cooperativa (sí/no, por defecto "no").
- **FR-006**: El formulario MUST permitir elegir un tipo de paquete predefinido
  (Chico / Mediano / Grande) o escribir una descripción libre.
- **FR-007**: El formulario MUST capturar forma de pago
  [NEEDS CLARIFICATION: el brief no especifica los métodos de pago
  concretos que maneja Diego — se asume Efectivo / Transferencia como
  placeholder inicial, a confirmar con el cliente].
- **FR-008**: El formulario MUST capturar fecha y hora de entrega, y fecha y
  hora de retiro, por separado.
- **FR-009**: El formulario MUST capturar los datos de la persona que recibe
  el paquete: nombre y CI.
- **FR-010**: El formulario MUST capturar la cantidad de paquetes del pedido.
- **FR-011**: El sistema MUST registrar internamente la fecha de creación del
  pedido sin pedírsela al usuario.
- **FR-012**: El sitio MUST validar los campos obligatorios antes de permitir
  el envío y mostrar el error puntual junto al campo.
- **FR-013**: Al enviar un pedido válido, el sitio MUST mostrar una pantalla
  de confirmación con el resumen de los datos cargados.
- **FR-014**: La sección "Sobre Nosotros" MUST mostrar días/horarios de
  trabajo, una representación visual de la zona de entregas, y una cifra de
  paquetes entregados históricamente.
- **FR-015**: La sección "Contacto" MUST ofrecer un link de WhatsApp
  (`wa.me`) y un email visible.
- **FR-016**: La sección "Reseñas" MUST existir en la navegación pero mostrar
  un placeholder de "próximamente" en este milestone.
- **FR-017**: El sitio MUST ser usable en mobile (viewport ≥360px de ancho)
  sin scroll horizontal ni elementos cortados.
- **FR-018**: La home MUST entrar en una sola pantalla (sin scroll vertical)
  en viewports de tamaño habitual: es la primera impresión del cliente y no
  debe obligar a bajar para ver contenido secundario.
- **FR-019**: El texto de cara al usuario MUST usar voz institucional
  ("nosotros", "Flash Urbano") y no nombrar personas del equipo.

### Key Entities

- **Pedido/Paquete**: tipo de cliente (empresa/particular), nombre, teléfono,
  dirección compuesta, tipo o descripción del paquete, forma de pago, fecha y
  hora de entrega, fecha y hora de retiro, fecha de creación (interna),
  persona que recibe (nombre, CI), cantidad de paquetes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario nuevo completa el formulario de pedido y llega a la
  confirmación en menos de 3 minutos en un celular, sin ayuda externa.
- **SC-002**: El 100% de los campos obligatorios listados en el brief del
  cliente están presentes y se validan antes del envío.
- **SC-003**: Desde la home, "Sobre Nosotros" y "Contacto" son alcanzables en
  un máximo de 1 clic/tap.
- **SC-004**: El sitio se ve y funciona correctamente tanto en un viewport de
  375px (mobile) como en uno de escritorio (≥1280px), verificado
  manualmente.

## Assumptions

- **Sin login funcional en este milestone**: el flujo real es guest-only; el
  botón de Google queda como UI estática. Justificación: Principio I
  (visual-first) y III (simplicity/YAGNI) de la constitución — invertir en
  OAuth real antes de validar el formulario con el cliente sería prematuro.
- **Sin persistencia real en este milestone**: el envío del formulario
  termina en una pantalla de confirmación en el cliente; no hay base de
  datos ni backend todavía. Guardar los pedidos de verdad es un milestone
  siguiente, con su propio plan.
- **Mapa de zonas estático, no interactivo**: se decidió mantener una imagen
  en vez de un mapa interactivo para este milestone (carga instantánea, sin
  dependencias externas). La imagen se genera con
  `web/design-source/build-map.js` a partir de la captura que entregó el
  cliente; ver ese README para el procedimiento y las limitaciones.
- **Los límites de zona del mapa NO están validados por el cliente**: se
  derivaron de las líneas que él trazó a mano, cerrando los extremos que
  quedaban abiertos. Las zonas 3 y 5 además se cortan en el borde de la
  captura, aunque en la realidad se extienden más. El mapa se publica como
  *referencia* y la página lo aclara; antes de tratarlo como fuente de verdad
  para cobrar, el cliente tiene que confirmar los límites.
- **Cifra de "paquetes entregados históricamente"**: valor placeholder
  visible hasta que exista una fuente de datos real.
- El sitio es responsive/mobile-first pero no se construye como app nativa;
  es la web para clientes (la app Android de administración es un feature
  aparte, fuera de este spec).
