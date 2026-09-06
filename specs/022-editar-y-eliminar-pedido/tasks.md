# Tasks: Corregir o dar de baja un pedido, mientras nadie lo tomo

**Feature**: `022-editar-y-eliminar-pedido` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Fecha**: 2026-09-05

El feature mas grande de la tanda, y el orden importa en dos lugares:

- **La ventana se construye en el SQL (Fase 2) antes que cualquier pantalla.** Si
  se hace al reves, la tentacion es que la pantalla decida quien puede editar, y
  eso no es una autorizacion.
- **La tercera fuente de precarga (Fase 5) es donde esto se rompe sin verse.** Su
  verificacion no es una prueba unitaria, es el paso 2 del quickstart.

Tests: se generan. Lo que hay que probar son **prohibiciones** —no editar lo
ajeno, no editar lo tomado, no ganar una carrera— y una prohibicion sin control
positivo queda verde por no mirar donde cree.

## Phase 1: Setup

- [ ] T001 Levantar `flash-pg-test` (puerto 55432) y exportar
      `TEST_DATABASE_URL`. Correr `cd backend && go test ./... -p 1` y **anotar
      el conteo de salteadas** como linea base.
- [ ] T002 Correr `cd web && npm test` y anotar el resultado.

## Phase 2: Foundational — la ventana, en la base

**Es el cimiento de todo el feature**: la autorizacion y la ventana viven en el
`WHERE`, no en un `if` de un handler ni en una pantalla.

- [ ] T003 Agregar `Editar()` a `backend/internal/pedidos/pedido.go`. Recibe
      `usuarioID` y acota en la misma sentencia:
      `WHERE id = $1 AND usuario_id = $2 AND estado = 'creacion'`. Decide por
      **filas afectadas**. **No leer antes para validar** — ver research D2: entre
      el `SELECT` y el `UPDATE` Diego puede tomar el pedido.
- [ ] T004 Agregar `Eliminar()` con el mismo acotamiento, `DELETE ... WHERE id AND
      usuario_id AND estado = 'creacion'`. Funciona sin chocar el
      `ON DELETE RESTRICT` **porque un pendiente no tiene historial** (research
      D1); si alguna vez chocara, es señal de que la ventana se abrio de mas.
- [ ] T005 Devolver **un solo tipo de "no"** desde los dos: no existe, no es
      tuyo, o ya no esta pendiente colapsan en la misma respuesta (FR-004).
      Distinguirlas le confirma a un desconocido que el pedido existe.

## Phase 3: User Story 1 — corregir un dato (P1)

**Goal**: Que un telefono mal tipeado se arregle sin crear otro pedido.

**Independent test**: editar un pedido pendiente y comprobar que se guardo con el
mismo codigo.

- [ ] T006 [US1] Prueba: editar un pendiente propio guarda, y **el codigo no
      cambia** (FR-005). En `backend/internal/pedidos/pedido_test.go`.
- [ ] T007 [US1] Prueba: editar un pedido **ajeno** no hace nada y responde como
      si no existiera (FR-004).
- [ ] T008 [US1] Prueba de la **carrera** (FR-012): con el pedido movido a
      `aceptacion` entre medio, la edicion no afecta ninguna fila.
- [ ] T009 [US1] Handler `Editar` en `handlers.go` + ruta
      `PATCH /pedidos/{id}` en `backend/cmd/api/main.go`, con el mismo
      `conSesion` que el resto. **Mensaje legible en el 404**: es lo que Diego va
      a leer en la app (FR-014).
- [ ] T010 [US1] `editarPedido()` en `web/lib/api.ts`.

## Phase 4: User Story 2 — dar de baja (P1)

**Goal**: Que un pedido cargado por error deje de existir para las dos partes.

**Independent test**: darlo de baja y comprobar que no esta en ninguna lista.

- [ ] T011 [US2] Pruebas de `Eliminar()`: sobre un pendiente propio borra la
      fila; sobre uno **tomado** no borra nada; sobre uno **ajeno** tampoco.
- [ ] T012 [US2] Prueba de que **no queda en ninguna de las dos listas** despues
      de la baja: ni en `PorUsuario()` ni en `Todos()`.
- [ ] T013 [US2] Handler `Eliminar` + ruta `DELETE /pedidos/{id}`.
- [ ] T014 [US2] `eliminarPedido()` en `web/lib/api.ts`.

## Phase 5: La tercera fuente de precarga — el riesgo del feature

- [ ] T015 Agregar el modo **editar** a la precarga de
      `web/components/pedido/crear-pedido.tsx`, **en la misma cadena de decision
      que hoy elige entre `?repetir=` y el perfil, y con `editar` primero**. Las
      tres MUTUAMENTE EXCLUYENTES. El archivo ya advierte por escrito por que:
      dos fuentes sobre el mismo formulario produjeron un defecto el 2026-08-14.
      **Aca el modo de falla es peor** — guardar sobre el pedido equivocado.
- [ ] T016 Hacer que **el modo de guardado viaje con la precarga**, no que se
      deduzca despues volviendo a leer la URL. Que la decision se tome una sola
      vez es lo que evita que las dos lecturas discrepen.
- [ ] T017 Adaptar los textos de `web/components/pedido-form.tsx` al modo
      editar: el boton no dice confirmar un pedido nuevo, y la pantalla de exito
      **no dice "anota tu codigo"** sobre un codigo que la persona ya tenia.
- [ ] T017b Comprobar FR-006 y FR-005a, que es lo que ata este feature al
      Principio V y **hoy no lo cubre ninguna prueba**: que editar la entrega
      **revalide la cobertura** con las mismas reglas que crear —fuera de zona
      no guarda, y nunca ofrece la zona mas cercana— y que el guardado mande el
      pedido **entero**. Sale gratis SOLO si el formulario se reusa completo; el
      dia que alguien 'optimice' la precarga para mandar solo lo que cambio, se
      pierde sin ruido. Paso 3 del [quickstart](quickstart.md).
- [ ] T018 Comprobar el cruce a mano, paso 2 del [quickstart](quickstart.md):
      entrar por `?editar=A` sin guardar, navegar a `?repetir=B`, guardar, y ver
      que **crea uno nuevo con los datos de B**. Y al reves. **No lo cubre
      ninguna prueba automatica** — el defecto vive en la composicion con React.

## Phase 6: User Story 3 — la ventana, vista desde el cliente (P1)

- [ ] T019 [US3] Botones **Editar** y **Eliminar** en
      `web/components/pedido/tarjeta-pedido.tsx`, visibles solo mientras el
      pedido este pendiente. Eliminar **pide confirmacion** (FR-007).
- [ ] T020 [US3] Cuando la ventana esta cerrada, **escribir el motivo** en la
      tarjeta (FR-011). Un boton que desaparece sin explicacion es un producto
      que parece roto: la persona no vio lo que paso del otro lado.
- [ ] T021 [US3] Que un guardado rechazado **se vea** (FR-012): la persona no
      puede quedar creyendo que guardo. Mismo criterio que el boton de confirmar,
      que el 2026-08-14 no hacia nada visible.

## Phase 6b: Que Mi cuenta recuerde en que vista estaba

**Ampliacion de alcance del 2026-09-06**, pedida con el plan ya en ejecucion y
`verify:` verde. Entra aca y no en un feature aparte porque es la misma pantalla
que este plan vuelve util, y porque **es este feature el que vence la premisa**
de FR-027 de `010`.

- [ ] T021b Leer la vista de `/perfil` desde la URL (`?ver=pedidos`) en
      `web/app/perfil/page.tsx`, en vez de un `useState` que arranca siempre en
      *Mis datos*. **Dejar escrito que es una REVERSION de FR-027 y por que**: esa
      decision tenia motivo —"quien entra a Mi cuenta viene, casi siempre, a
      escribir su direccion"— y lo que la vence es `022`. Sin decirlo, el proximo
      que lea el comentario viejo la deshace creyendo que corrige algo.
- [ ] T021c **El limite de Suspense, que es donde esto falla en silencio.**
      `useSearchParams` empuja el arbol al cliente y sin `<Suspense>` **el build
      estatico falla directamente** — pero en desarrollo anda, que es la trampa.
      Mismo motivo por el que `app/pedido/page.tsx` lleva el suyo desde `010`.
      Comprobar con `npm run build` que `/perfil` **sigue saliendo como estatica**.

## Phase 7: Los avisos a Diego

- [ ] T022 Dos tipos de entrada nuevos en `backend/internal/avisos/mensaje.go`,
      al lado de `PedidoNuevo`, **cada uno con solo los campos que su mensaje
      puede decir**. El de la baja alcanza con el codigo: Diego no va a ir a
      ningun lado, asi que la calle no aporta y su ausencia es una superficie
      menos. La garantia de FR-010 es **el tipo, no el texto**: un descuido no
      compila.
- [ ] T023 Pruebas de los dos mensajes: que digan lo suyo y que **no puedan**
      decir importes, nombres, telefonos, numero de puerta ni esquina.
- [ ] T024 Disparar los avisos desde los handlers de T009 y T013, con el mismo
      patron que `Crear` usa hoy.

## Phase 8: Cierre

- [ ] T025 Correr `verify:` completo con la base levantada, y **comparar el
      conteo de salteadas contra T001**. Verde con skips de mas no es verde.
- [ ] T026 [P] Actualizar `ARCHITECTURE.md`: los dos caminos nuevos, y sobre todo
      **que la autorizacion y la ventana viven en el `WHERE`** — es lo que alguien
      podria "simplificar" a un `if` en el handler sin ver que reintroduce la
      carrera.
- [ ] T027 Quickstart entero (pasos 1 a 7), con la app de Diego contra el backend
      local. **No se puede cerrar desde la sesion**: necesita telefono o emulador
      para los avisos y para la ventana cerrada.
- [ ] T028 Commitear con el plan todavia en `active`, o el sensor rebota.
      Convencion: `feat: mensaje corto 022-editar-y-eliminar-pedido`, sin tildes.

## Dependencies

```text
T001, T002
   └─> T003, T004 ─> T005              (la ventana, en el SQL)
         ├─> T006, T007, T008 ─> T009 ─> T010     (US1)
         ├─> T011, T012 ─> T013 ─> T014           (US2)
         └─> T022 ─> T023 ─> T024                 (avisos)
               └─> T015 ─> T016 ─> T017 ─> T017b ─> T018   (la precarga)
                     └─> T019 ─> T020, T021       (la ventana en pantalla)
                           └─> T025 ─> T026 [P], T027 ─> T028
```

- **T003/T004 antes que todo lo demas.** Si las pantallas se hacen primero, la
  ventana termina viviendo en la pantalla, que no es una autorizacion.
- **T016 depende de T015** y es la mitad que se olvida: agregar la rama sin mover
  el modo de guardado deja las dos lecturas de la URL pudiendo discrepar.
- **T018 no la cubre ninguna prueba** y es la verificacion del mayor riesgo.

## Parallel opportunities

- **T022 a T024** (los avisos) son independientes de las pantallas y se pueden
  hacer en paralelo con la Fase 5.
- **T026** (ARCHITECTURE) en paralelo con el cierre.

Las fases 3 y 4 comparten `pedido.go` y `handlers.go`; se pueden pensar en
paralelo pero conviene hacerlas seguidas.

## Implementation strategy

**MVP = Fases 2, 3 y 5** (T003 a T010 y T015 a T018): con eso se puede corregir
un pedido, que es el caso que el cliente describio con sus palabras. La baja
(Fase 4) es igual de prioritaria como requisito pero es mas chica.

**Las fases 6 y 7 son las que deciden si el feature se siente bien.** El motivo
escrito cuando la ventana se cierra y los dos avisos son lo que evita que esto
parezca roto: uno del lado del cliente, el otro del de Diego.

**T018 y T027 no las cierra ningun comando**, y T018 es la mas importante de las
dos: el defecto que vigila no se ve en pantalla.
