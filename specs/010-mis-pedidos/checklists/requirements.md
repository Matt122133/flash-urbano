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

**Estado**: 16/16 en verde, sin ningún `[NEEDS CLARIFICATION]`. Las tres
preguntas que había se resolvieron **antes** de escribir el spec, con el dueño
del proyecto, y están en *Clarifications* con la alternativa descartada y su
motivo.

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

### Lo que el plan tiene que decidir, y no puede empujar hacia adelante

- **Este feature es casi todo interfaz, y hoy este repo no puede probar
  interfaz.** `web/vitest.config.ts` corre en entorno `node` e incluye
  únicamente `lib/**/*.test.ts`: los componentes no están ni en el barrido, no
  hay DOM, y no hay nada que renderice React. Ya hay una fila abierta del
  2026-08-14 en el tracker por exactamente esto —una corrección de `007` que
  quedó sostenida sólo por una prueba manual—. Con `010`, **esa fila deja de ser
  una anécdota**: US1 y US2 son pantalla de punta a punta, y planificarlas sobre
  el entorno actual significa que el `verify:` puede estar en verde sin haber
  ejercitado una sola línea de lo que se construyó. El plan tiene que elegir
  explícitamente entre montar un entorno con DOM y aceptar verificación manual
  documentada; **elegir por omisión es la única opción inaceptable**.
- **SC-003 y SC-004 son guardas negativas** —cero pedidos al precio viejo, cero
  pedidos ajenos a la vista—. Una prueba que afirma que algo no pasa necesita un
  caso que demuestre que sabría detectarlo. Vale acá lo que ya vale para
  `cotizar-abierto.test.ts`, que tiene su control positivo justamente porque sin
  él borrar el envío entero lo dejaba en verde.
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
