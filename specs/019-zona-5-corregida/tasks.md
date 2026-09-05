# Tasks: El borde corregido de la zona 5 llega al sitio

**Feature**: `019-zona-5-corregida` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Fecha**: 2026-09-05

Feature chico y de un solo archivo generado. Lo que lo hace no-trivial no es el
volumen sino el orden. Tres pares donde el segundo se olvida y el primero queda
inservible:

- **T006 antes de creerle a T005**: una prueba de cobertura sin control negativo
  no prueba nada.
- **T010 despues de T009**: el encabezado de `zonas.ts` lo escribe el generador,
  asi que arreglar el comentario obliga a regenerar.
- **T013 antes de cerrar el plan**: el sensor de cobertura rebota el commit si el
  plan ya paso a `completed`.

Tests: se generan igual que en `002` y `011`, porque el area ya tiene pruebas y
porque una guarda de cobertura sin control positivo no prueba nada.

## Phase 1: Setup

- [x] T001 Correr `cd web && npm test` **antes de tocar nada** y anotar el
      resultado, para que cualquier rojo posterior sea atribuible a este feature
      y no a un clon sucio. Si algo ya viene en rojo, se resuelve eso primero.
- [x] T002 Correr `python3 scripts/harness/check_plan_coverage.py --doctor` y
      anotar si el sensor esta cableado en este clon. Importa para este feature en
      particular: FR-002 y SC-004 —que no se toque logica— **no los comprueba
      ninguna prueba**, los sostiene que `web/lib/zona-lookup.ts` no este en
      `covers:`. Si el doctor dice `UNWIRED`, esa garantia es convencion y no
      control, y hay que revisar a mano el `git diff` antes de commitear.

## Phase 2: Foundational (bloquea todo lo demas)

- [x] T003 Regenerar el trazado publicado ejecutando
      `cd web && node design-source/build-zonas.js design-source/zonas-flash-urbano.kml lib/zonas.ts`,
      que reescribe `web/lib/zonas.ts`.
- [x] T004 Verificar la salida del generador contra el control del paso 1 del
      [quickstart](quickstart.md): **`Zona 1: 128 vertices` y `Zona 5: 32
      vertices`**, 476 en total. Si dice 119 y 24 leyo el KML viejo y no se sigue.
      Confirmar ademas con `git diff --stat web/lib/zonas.ts` que el archivo
      efectivamente cambio.

## Phase 3: User Story 1 — el territorio ganado resuelve a zona 5 (P1)

**Goal**: Que un pedido con entrega en el tramo que la zona 5 gano se pueda
confirmar, donde antes no se podia.

**Independent test**: `npm test` con el caso nuevo en verde y, revertido el
trazado, en rojo.

- [x] T005 [US1] Agregar en `web/lib/zona-lookup.test.ts`, junto a las cinco
      referencias de barrio existentes, el caso que afirma que
      `-34.867420, -56.008911` resuelve a la zona 5. El punto sale de research D1
      y se elige porque **antes no tenia zona**.
- [x] T006 [US1] **Control negativo, y es obligatorio**: revertir
      `web/lib/zonas.ts` al trazado viejo (`git stash push web/lib/zonas.ts`),
      correr `cd web && npm test`, y comprobar que **el caso de T005 queda en
      rojo y ningun otro**. Restaurar con `git stash pop`. Si queda verde, el
      punto esta sobre territorio que ya estaba cubierto y T005 no prueba este
      feature: hay que elegir otro punto de la lista de research D1.

## Phase 4: User Story 2 — el borde movido no abre un hueco (P1)

**Goal**: Que ninguna direccion quede aislada por el trazado nuevo.

**Independent test**: la medicion de research D2 — maximo 96 m, mediana 41 m,
cero puntos a mas de 100 m de cobertura.

- [x] T007 [US2] Confirmar que lo publicado es lo que se midio: que
      `web/design-source/zonas-flash-urbano.kml` no cambio desde la medicion
      (research D1/D2 corrieron contra el working tree) y que los conteos de
      vertices de T004 coinciden con los de research D1. **Si el KML se toco
      despues de medir, la medicion no vale y hay que rehacerla** — no alcanza
      con que `verify:` este verde, porque `verify:` no mide huecos.

## Phase 5: User Story 3 — las cinco zonas siguen siendo las de antes (P2)

**Goal**: Que nada fuera del tramo movido cambie de zona, y que lo que quedaba
afuera siga afuera **con su salida al contacto intacta**.

**Independent test**: los cinco puntos de referencia y los tres de fuera de
cobertura que `zona-lookup.test.ts` ya verifica, mas la comprobacion a mano de
que el formulario sigue encaminando al contacto.

- [x] T008 [US3] Correr `cd web && npm test` y confirmar que los cinco casos de
      referencia de barrio y los tres de fuera de cobertura siguen en verde en
      `web/lib/zona-lookup.test.ts`, **sin editarlos**. Si alguno cambia de
      respuesta, el defecto esta en el trazado: se para y se mira el KML, nunca
      se actualiza la prueba para que pase.
- [ ] T009 [US3] Comprobar la **segunda mitad de FR-006**, la que ninguna prueba
      cubre: marcar en `/pedido` una entrega fuera de toda zona y ver que el sitio
      no deja confirmar y ofrece el contacto directo, **sin nombrar una zona
      cercana ni mostrar monto alguno**. Paso 3 del [quickstart](quickstart.md).
      Es comportamiento que ya existe desde `013` y este feature no lo toca; se
      mira igual porque el trazado nuevo cambia cuales son los puntos de afuera.

## Phase 6: Polish & Cross-Cutting

- [x] T010 Corregir en `web/design-source/build-zonas.js` el comentario que
      afirma que `resolverZona()` "recorre la lista tal cual y devuelve el primer
      match, y eso ES la regla de desempate": aparece en la cabecera del script y
      en el encabezado que el script escribe dentro de `zonas.ts`. La regla real
      desde `004` es **menor precio, con el id desempatando solo precios
      iguales**. Ver research D3.
- [x] T011 Volver a correr el generador de T003 despues de T010, porque el
      encabezado de `web/lib/zonas.ts` lo emite el script. Sin esto el comentario
      queda arreglado en el `.js` y viejo en el generado.
- [x] T012 [P] Agregar una fila a `docs/tech-debt-tracker.md`: la decision de
      cobertura desempata leyendo la tabla de precios por zona, un dato que el
      producto dejo de publicar en `013`. No es la columna que el Principio V
      prohibe leer (esa es `pedidos.precio`) pero es una rareza que conviene
      tener escrita antes de que alguien "limpie" el campo. Ver research D4.
- [x] T013 Correr `verify:` completo: `cd web && npm run lint && npm test && npm run build`.

## Phase 7: Cierre — el commit y el gate humano

- [x] T014 Commitear **el KML y el generado juntos, en un solo commit** (FR-007),
      con `web/design-source/build-zonas.js` si T010 lo toco. Que la fuente y su
      proyeccion viajen juntas es el requisito entero: este feature existe porque
      una vez quedaron separadas. Convencion del repo:
      `feat: mensaje corto 019-zona-5-corregida`, sin tildes.

      **Antes de que el plan pase a `completed`**, o el sensor de cobertura
      rebota el commit.

- [ ] T015 Ejecutar el paso 4 del [quickstart](quickstart.md) con Diego delante:
      levantar el sitio, mirar el mapa de `/sobre-nosotros`, y confirmar que el
      borde entre zona 1 y zona 5 corre donde el lo quiso. **Contarle
      explicitamente que el cambio mueve tambien la zona 1** (~0,34 km2 pasan de
      1 a 5) y que gana ~0,21 km2 de cobertura nueva al este. FR-008 y
      constitucion: un limite que el cliente no confirmo no llega a produccion.

      **BLOQUEA EL MERGE A `master`, no solo el despliegue.** En este repo no son
      dos momentos distintos: `.github/workflows/deploy-pages.yml` dispara con
      `push` a `master` filtrado por `paths: web/**`, y este feature toca
      `web/lib/zonas.ts`. O sea que **el merge ES el despliegue**, y no hay
      ninguna ventana entre uno y otro para mostrarle el mapa a Diego. Si esta
      tarea queda abierta, el trabajo se queda en la rama.

## Dependencies

```text
T001, T002
   └─> T003 ─> T004                 (regenerar y comprobar los conteos)
         ├─> T005 ─> T006           (US1: el caso nuevo y su control negativo)
         ├─> T007                   (US2: lo publicado es lo medido)
         └─> T008 ─> T009           (US3: nada mas cambio, y la salida al contacto)
               └─> T010 ─> T011 ─> T013 ─> T014 ─> T015
                    T012 [P] en paralelo con T010/T011
```

- **T006 depende de T005** y no se puede saltear: sin el, T005 podria estar
  probando territorio que ya estaba cubierto.
- **T011 depende de T010** por el encabezado generado. Es el paso que mas
  facilmente se olvida.
- **T014 antes de cerrar el plan**, no despues.
- **T015 depende de todo** y no lo cierra ningun comando.

## Parallel opportunities

Pocas, y es correcto que sean pocas: casi todo pasa por el mismo archivo
generado. Una sola:

- **T012** (fila en el tracker) no toca ningun archivo de `web/` y puede correr
  en cualquier momento despues de leer research D4.

T005, T007 y T008 leen el mismo `zonas.ts` recien generado; se pueden pensar en
paralelo pero corren la misma suite, asi que no hay nada que ganar.

## Implementation strategy

**MVP = Phase 2 + Phase 3** (T003 a T006). Con eso el borde corregido ya esta
publicado y probado, que es el feature entero. Las fases 4 y 5 son verificacion
de que no se rompio nada, y la 6 es la deuda de comentario que este feature paga
por estar abriendo justo ese archivo.

**La fase 7 no es opcional aunque `verify:` no la mida.** T014 cierra el
requisito que este feature existe para no volver a incumplir, y T015 es la unica
tarea que puede detectar el modo de falla que importa: un trazado bien construido
y equivocado.
