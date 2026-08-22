---
ticket: none
status: draft
covers:
  # Los dos modos del bloque de direccion, que dejan de nombrarse por la
  # direccion que ocupan y pasan a nombrarse por lo que hacen. Ver research D1.
  - web/components/bloque-direccion.tsx
  # Quien monta las dos secciones, decide el modo de cada una, ubica el mapa y
  # deriva el precio. Es el archivo central del feature.
  - web/components/pedido-form.tsx
  # La rama de "descartar el punto y avisar" se muda del retiro a la entrega.
  # Ver research D6: es la trampa mas facil de este plan.
  - web/components/sesion/rehidratar-retiro.ts
  # Conserva su mapa (FR-016) pero consume el modo renombrado.
  - web/components/sesion/formulario-perfil.tsx
  # El camino de ?repetir= y sus avisos.
  - web/components/pedido/crear-pedido.tsx
  # PedidoGuardado deja de tener punto solo en el retiro.
  - web/lib/api.ts
  # El mapeo y la decision del reajuste se mudan a la entrega. Con sus pruebas.
  - web/lib/repetir.ts
  - web/lib/repetir.test.ts
  # La migracion 0004 y las dos guardas que exigen el punto de retiro.
  - backend/migrations/
  - backend/internal/pedidos/
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./...
analyzed:
---

# Implementation Plan: El precio sale de la entrega, no del retiro

**Branch**: `precio-por-entrega` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-precio-por-entrega/spec.md`

## Summary

El punto que decide la zona y el precio pasa del **retiro** a la **entrega**. La
sección *a dónde llevamos el paquete* gana el mapa, la resolución obligatoria del
cruce y la lista de candidatos; la sección de retiro los pierde y conserva un
punto que se resuelve en silencio, no decide plata, y puede faltar.

**Es un cambio de las dos superficies.** El navegador cambia de qué punto deriva
el precio; la base gana `entrega_punto` obligatorio y afloja `retiro_punto`. Lo
que **no** cambia es dónde se calcula: sigue siendo el navegador, sin red, porque
cotizar tiene que funcionar con el servicio apagado.

**El contrato de la API no cambia de forma** (research D3): `Direccion` es un
solo tipo compartido por las dos direcciones y ya lleva `Punto` opcional. Cambian
las validaciones, no el JSON.

**Lo que gobierna este plan y no se puede perder de vista**: el precio tiene que
tener **una sola fuente**, `resolverZona(entrega.punto)`. Cualquier segunda vía
de cálculo —una copia en el servicio, un precio heredado del pedido viejo, un
punto de retiro que todavía cotice— reintroduce la posibilidad de dos precios
distintos para el mismo envío, que es el defecto que este feature existe para
sacar.

## Technical Context

**Language/Version**: TypeScript sobre Next.js 16 (App Router, export estático) y
Go 1.26 sobre Postgres con PostGIS. `web/AGENTS.md` obliga a leer la guía de la
versión de Next bajo `node_modules/next/dist/docs/` antes de escribir código web.

**Primary Dependencies**: ninguna nueva. Se usa lo que ya está: `resolverZona()`
de `lib/zona-lookup.ts`, el índice de calles de `lib/direcciones.ts`, el mapa de
`mapa-zonas-dinamico.tsx`, `rehidratarRetiro()` y `claveDeIntento()`.

**Storage**: Postgres + PostGIS. Una migración, `0004`: `entrega_punto` entra
`NOT NULL`, `retiro_punto` pierde el `NOT NULL`. Sin relleno y sin default —ver
research D5—, lo que implica que **la base local hay que vaciarla**.

**Testing**: `vitest` en `web/lib/**/*.test.ts` y `go test ./...` en el backend.
**Las pruebas de Go que tocan Postgres se saltean solas sin `TEST_DATABASE_URL`**
(ver `backend/README.md`), así que el `verify:` verde no dice nada de la
migración a menos que se mire el conteo de skips. Las pantallas siguen sin prueba
automática: su verificación es [`quickstart.md`](quickstart.md).

**Target Platform**: navegador de teléfono primero (Principio IV); sitio estático
en `flashurbano.uy`, servicio en Railway.

**Project Type**: aplicación web de dos superficies, y **este feature vive en las
dos**.

**Performance Goals**: ninguno nuevo. Se mueve trabajo de una sección a otra.

**Constraints**: cotizar tiene que seguir funcionando con el servicio apagado
(FR-004); nunca adivinar una zona (Principio V); el servicio no resuelve zonas
(FR-010).

**Scale/Scope**: dos secciones de un formulario, dos guardas del servicio, una
migración, un módulo puro con pruebas, y un tipo. Sin endpoint nuevo.

## Constitution Check

*GATE: pasa antes de Phase 0 y se vuelve a evaluar después del diseño.*

**Este feature existe porque la constitución decía lo contrario**, y por eso el
gate se evalúa contra la versión **4.0.0**, enmendada el 2026-08-22 por el
[ADR pricing-from-delivery-zone](../../docs/decisions/pricing-from-delivery-zone.md).
Contra la 3.0.0 este plan sería una violación directa del Principio V. **Si al
leer esto la constitución dice "pickup zone", entonces la enmienda se perdió en
un merge y hay que frenar.**

- **Principio I (visual-first)**: el cambio es visible en la pantalla más
  importante del producto, y el cliente lo pidió mirándola.
- **Principio II (autoservicio)**: la fricción no aumenta —se muda—, y FR-002a
  protege lo que sí importaba: ver el precio sin completar el retiro.
- **Principio III (simplicidad/YAGNI)**: sin endpoint nuevo, sin cambio de
  contrato, sin índice espacial que nadie consulta, sin relleno de datos. Se
  renombran dos modos que ya existían en vez de escribir un tercer bloque de
  dirección.
- **Principio IV (móvil, poca fricción)**: **un solo mapa en el formulario**. La
  alternativa de validar el área del retiro con un segundo mapa se descartó por
  esto.
- **Principio V (el sitio cotiza)**: cumplido en su forma enmendada. El precio
  sale del punto de entrega, en firme, calculado sin red; fuera de zona no hay
  precio ni pedido; nunca la zona más cercana.
- **Alcance (no hay pedido sin cliente identificado)**: intacto.
- **Plan acotado (harness)**: `covers:` nombra doce caminos. `web/lib/zonas.ts`,
  `web/lib/zona-lookup.ts` y `web/lib/cotizar-abierto.test.ts` **no están, a
  propósito**: las zonas no cambian, la regla de resolución tampoco, y la guarda
  de FR-022 se usa como control, no se toca.
- **Verificado antes de terminar (harness)**: `verify:` cubre las dos
  superficies. **Y no alcanza**, igual que en `010`: lo que prueba las pantallas
  es el quickstart.

Sin violaciones que justificar **contra la 4.0.0**.

## Project Structure

### Documentation (this feature)

```text
specs/011-precio-por-entrega/
├── plan.md              # Este archivo
├── spec.md              # El qué y el porqué
├── research.md          # D1..D8, con lo descartado
├── data-model.md        # Lo que cambia de forma y lo que cambia de significado
├── quickstart.md        # LA verificación, más la deuda de `010`
├── contracts/
│   └── formulario-y-pedido.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo emite /speckit-tasks
```

### Source Code (repository root)

```text
web/
├── components/
│   ├── bloque-direccion.tsx          # MODIFICADO: modos por comportamiento
│   ├── pedido-form.tsx               # MODIFICADO: el corazón del cambio
│   ├── pedido/crear-pedido.tsx       # MODIFICADO: el camino de ?repetir=
│   └── sesion/
│       ├── rehidratar-retiro.ts      # MODIFICADO: la guarda se muda
│       └── formulario-perfil.tsx     # MODIFICADO: consume el modo renombrado
└── lib/
    ├── api.ts                        # MODIFICADO: el tipo admite las dos formas
    ├── repetir.ts                    # MODIFICADO: lee la entrega
    └── repetir.test.ts               # MODIFICADO

backend/
├── migrations/0004_*.sql             # NUEVO
└── internal/pedidos/
    ├── handlers.go                   # MODIFICADO: la guarda del punto
    ├── pedido.go                     # MODIFICADO: la guarda antes del INSERT
    └── *_test.go                     # MODIFICADO
```

**Structure Decision**: no aparecen archivos nuevos del lado del navegador, y eso
es deliberado. Todo lo que este feature necesita ya existe: los dos modos, el
mapa, el índice, la resolución de cruces. **Un archivo nuevo acá sería la señal
de que se está reimplementando algo en vez de moverlo.**

## Cómo se ejecuta

Cinco tramos. El primero es el único que puede romper datos; los tres del medio
entregan US1; el último, US2. Después de cada tramo el `verify:` queda verde.

### Tramo 1 — La base acepta la forma nueva

Migración `0004`: `entrega_punto` `NOT NULL`, `retiro_punto` sin `NOT NULL`, y la
corrección del comentario del esquema.

**El comentario falso vive en `0003`, que ya está aplicada, y `0003` no se
edita.** La corrección va como comentario de `0004`, que es donde un lector la va
a encontrar junto al cambio que la causó. Editar una migración aplicada es
reescribir historia que otra base ya ejecutó.

**Vaciar `pedidos` en local es parte del procedimiento, no un accidente** — la
columna entra obligatoria sin default y no hay con qué rellenar.

**Resultado observable**: la migración corre sobre una base vacía y
`\d pedidos` muestra las dos columnas con la nulabilidad nueva.

### Tramo 2 — El servicio exige el punto correcto

Las dos guardas de research D4 se mudan del retiro a la entrega:
`handlers.go:209` y `pedido.go:212`. Un pedido sin punto de retiro pasa a ser
**válido**; uno sin punto de entrega, rechazado con un mensaje legible.

**Resultado observable**: las pruebas de `internal/pedidos` cubren los tres casos
del [contrato](contracts/formulario-y-pedido.md) §2 — con los dos puntos, sin el
de retiro, y sin el de entrega.

### Tramo 3 — Los modos dicen lo que hacen

`bloque-direccion.tsx`: `retiro`/`entrega` pasan a `exigente`/`oportunista`
(research D1), y el modo `oportunista` gana lo único que no existía — capturar el
punto cuando el cruce resuelve solo, y **no ofrecer candidatos cuando no**
(research D2).

**Resultado observable**: el perfil y el formulario compilan contra los nombres
nuevos, y ningún archivo del repo menciona `modo="retiro"`.

### Tramo 4 — El formulario invierte (US1)

`pedido-form.tsx`: la entrega recibe `exigente` y el mapa; el retiro recibe
`oportunista`. El precio pasa a derivarse de `entrega.direccion.punto` en el
único lugar donde hoy se deriva del retiro. La validación de "sin ubicación no
hay pedido" se muda; la de "el retiro tiene que estar en el área" nace, y **sólo
actúa cuando hay punto** (FR-011).

**El orden de las secciones no cambia** (FR-002a), y ver el precio no puede
depender de que el retiro esté completo — eso es lo que mantiene viva la
cotización pública.

`rehidratar-retiro.ts` pierde, del camino del retiro, la rama que descarta el
punto y avisa (research D6, FR-017).

**Resultado observable**: M1 a M8 del [quickstart](quickstart.md).

### Tramo 5 — Repetir un pedido (US2)

`repetir.ts` y sus pruebas leen la entrega. `crear-pedido.tsx` maneja el caso
nuevo: un pedido anterior a `011` no tiene punto de entrega, así que precarga
todo lo demás y deja la entrega por completar, con un aviso — **nunca una
pantalla a medio cargar** (FR-013).

`api.ts` ensancha `PedidoGuardado` para admitir las dos formas y corrige el
comentario que hoy afirma que sólo el retiro tiene punto.

**Resultado observable**: M9 y M10 del quickstart, con los cuatro casos de la
tabla del contrato §4.

### Al cerrar

- Correr **H1, H2 y H3** del quickstart: la deuda de verificación que `010` dejó,
  y que no depende de qué punto cobra. **H3 es la que cubre un agujero de
  seguridad y sigue sin verificarse.**
- Anotar en el tracker cuántos pedidos quedaron con `retiro_punto IS NULL`. La
  deuda ya está escrita; lo que le falta es el número.

## Complexity Tracking

Sin violaciones de la constitución que justificar contra la 4.0.0.

Dos cosas que un revisor va a querer discutir, y que están decididas a la vista:

**El plan acepta que su `verify:` no ejercita las pantallas.** Es la misma
decisión de `010`, con el mismo costo, y ahora con una consecuencia acumulada:
`011` cambia el camino del precio **y** arrastra tres pasos que `010` no corrió.
El agujero no crece por descuido sino por elección repetida, y ya es la cuarta
vez que un feature pide la misma herramienta.

**El punto de retiro sobrevive sin decidir nada.** Es dato que se guarda para un
consumidor que todavía no existe —la app Android—, lo que en cualquier otro
contexto sería especulación y Principio III lo prohibiría. Se acepta porque el
dato **no se puede reconstruir después**: una dirección que hoy resuelve puede no
resolver mañana, y la persona que la escribió no vuelve. Guardar es barato;
recuperar es imposible.
