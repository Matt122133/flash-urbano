# Specification Quality Checklist: Mis pedidos — el historial y el botón de repetir

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-21
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**Estado**: 16/16 en verde antes y después del barrido de `/speckit-clarify`
(2026-08-22), sin ningún `[NEEDS CLARIFICATION]`. Seis clarificaciones aceptadas
en total: tres en la sesión de `/speckit-specify` (2026-08-21) y tres más en el
barrido. **Ninguna de las tres del barrido salió como se recomendaba**, y las
tres quedaron escritas con su motivo y su consecuencia — que es para lo que
sirve el registro. La del aviso de precio se resolvió **dos veces**: primero no
avisar, y después avisar sin mostrar el monto viejo, que es una forma que no
estaba entre las opciones ofrecidas y es mejor que la que se había recomendado
(ver el porqué en el spec). En el spec queda sólo la respuesta final; el hecho
de que hubo una corrección queda dicho ahí y acá, y no como dos requisitos que
se contradicen.

### Sobre el primer ítem, dicho de frente

El spec nombra tres cosas concretas —`GET /pedidos`, `/perfil`, y el cálculo de
zona de `web/lib/`— y bajo la letra del template eso es una fuga de
implementación. Se marca en verde igual, por la misma razón que `007`: en este
repo vale *"si no está en el repo, no existe"*, y **el hecho que decide el
alcance de este feature es que el servicio ya guarda y ya sirve el pedido
entero**. Un spec que lo dijera en abstracto —"el sistema ya dispone de los
datos"— escondería justo lo que hace que esto sea una pantalla y no medio
backend. La fuga está acotada a esos anclajes; ninguna FR prescribe cómo se
construye la pantalla.

### Lo que el barrido resolvió, y lo que eso deja abierto

- **La verificación es manual y documentada.** Se preguntó explícitamente y se
  eligió no montar entorno con DOM ni extraer lógica a `lib/` sólo para poder
  probarla. Ya no es una decisión pendiente del plan — es una decisión tomada,
  con su costo escrito en el spec y dos requisitos colgando de ella: **FR-025**
  (el plan dice qué **no** cubre su `verify:`, y hay un quickstart con pasos
  ejecutables para cada escenario, incluidos los caminos feos) y **FR-026** (el
  agujero se anota en el tracker con el tamaño que tiene después de `010`).
  **Si el plan se cierra sin esas dos, el feature queda sin ninguna red**: ni
  automática ni escrita.
- **SC-003 y SC-004 son guardas negativas** —cero pedidos al precio viejo, cero
  pedidos ajenos a la vista— y con verificación manual **no hay control positivo
  posible**: no existe una prueba a la que romperle la implementación para verla
  en rojo. Lo que queda en su lugar son pasos de quickstart que **produzcan** el
  caso malo a propósito (mover el precio de una zona y repetir; abrir el
  historial con dos cuentas distintas), no pasos que sólo miren el caso bueno.
  Un quickstart que sólo recorre el camino feliz deja estas dos SC sin nada
  detrás.
- **El remitente se copia del pedido viejo** (FR-013), no del perfil. Lo que
  hace aceptable esa elección es **FR-013a**: todo lo precargado es editable
  antes de confirmar. Las dos viajan juntas; separarlas convierte la decisión en
  resucitar un teléfono viejo en silencio.
- **FR-013b es el requisito que más fácil se rompe sin querer**: sobre `/pedido`
  van a convivir dos precargas —la del perfil y la del pedido repetido— y la de
  repetir tiene que ganar **entera**. `007` ya pagó una vez el defecto de dos
  cosas escribiendo sobre el mismo formulario, y ahí ni siquiera eran dos
  fuentes: era la misma corriendo dos veces.
- **FR-017 es el requisito con más riesgo escondido.** Rehidratar una dirección
  guardada contra el índice de calles no es copiar texto: hay ~50 grupos de
  calles homónimas en Montevideo, y `web/lib/direcciones.ts` ya carga con esa
  trampa. Para el **retiro** el punto guardado desempata y existe
  `rehidratar-retiro.ts` desde `007`; para la **entrega**, que no tiene punto,
  no hay nada equivalente y el plan tiene que decir qué pasa cuando el nombre de
  calle guardado no resuelve a una sola opción.
- **FR-024 obliga a anotar la deuda del paginado con un número.** Si al cerrar
  la fila del tracker dice "puede crecer", el requisito no se cumplió: pide el
  umbral.

### Lo que se verificó contra el código antes de escribir, no se asumió

- `GET /pedidos` devuelve el pedido **completo**, con el punto de retiro, no un
  resumen (`backend/internal/pedidos/pedido.go`, struct `Pedido`), ordenado por
  `creado_en DESC` (`PorUsuario`), y sin admitir filtro que esquive al usuario.
- `web/lib/api.ts` ya expone `misPedidos()`, pero su tipo `PedidoGuardado` es
  **más angosto que la respuesta real** —le faltan direcciones, paquete y
  destinatario—. Ensancharlo es trabajo de este feature; no es un endpoint
  nuevo.
- El formulario ya acepta valores iniciales (`inicial?: Partial<FormState>`) y
  ya los toma **una sola vez al montarse**, que es lo que sostiene FR-007 de
  `007`. La precarga de este feature entra por esa misma puerta.
- Los tres estados que la base acepta son `creacion`, `aceptacion` y `entrega`,
  y **`007` sólo escribe el primero**: de ahí sale FR-006 y el supuesto de que
  hoy la columna de estado dice siempre lo mismo.
