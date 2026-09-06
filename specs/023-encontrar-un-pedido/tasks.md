# Tasks: Encontrar un pedido entre muchos

**Feature**: `023-encontrar-un-pedido` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Organizacion**: por historia. US1 sola es entregable y ya resuelve el problema
que motivo el pedido; US2 se le suma sin tocar lo que US1 dejo hecho.

**Sobre las pruebas**: las de `lib/` no son opcionales en este repo, y no por
disciplina abstracta — **es el unico lugar donde algo de este feature puede
probarse solo** (research D1). Lo que quede en el componente lo cubre el
quickstart, a mano.

---

## Fase 1: Preparacion

- [ ] T001 Confirmar el prerequisito del plan: PR #35 (`022`) mergeado, y esta
  rama rebasada sobre `master` con `git rebase master`. **Sin esto no se empieza**:
  los tres archivos que este feature toca son los que `022` acaba de cambiar, y
  el `?ver=` que se extiende ni siquiera existe en `master` todavia.
- [ ] T002 Correr `cd web && npm run lint && npm test && npm run build` sobre la
  rama ya rebasada y anotar el resultado. Es la linea de base: si algo ya esta en
  rojo, se sabe antes de escribir nada.

## Fase 2: Base compartida (bloquea a las dos historias)

- [ ] T003 Crear `web/lib/filtrar-pedidos.ts` con el tipo del filtro
  (`{ estado: EstadoFiltro; texto: string }`) y `filtrarPedidos(pedidos, filtro)`
  **devolviendo la lista intacta** cuando el filtro esta vacio. Sin criterios
  todavia: primero la forma y el contrato.
- [ ] T004 Crear `web/lib/filtrar-pedidos.test.ts` con dos casos: filtro vacio
  devuelve todo, y **el orden de entrada se conserva** (FR-009). El segundo es la
  guarda de que filtrar quita y no reordena.

## Fase 3: US1 — Ver solo los pendientes (P1)

**Meta**: con un toque y sin escribir nada, ver lo que esta en curso.

**Prueba independiente**: con pedidos en los tres estados, tocar *Pendientes* y
que queden solo esos.

- [ ] T005 [P] [US1] Pruebas del corte por estado en
  `web/lib/filtrar-pedidos.test.ts`: cada estado deja pasar lo suyo, y **un estado
  que la pantalla no conoce sigue apareciendo cuando no hay filtro** (FR-005).
  Este ultimo es el caso que evita que un estado nuevo del servicio haga
  desaparecer pedidos en silencio.
- [ ] T006 [US1] Implementar el corte por estado en `web/lib/filtrar-pedidos.ts`.
- [ ] T007 [US1] Leer `?estado=` en `web/components/pedido/historial.tsx` con
  `useSearchParams()`. Un valor desconocido en la URL se trata como "todos", no
  como lista vacia: la URL la puede escribir cualquiera a mano.
- [ ] T008 [US1] Escribir `?estado=` con `router.replace()` **partiendo de los
  parametros actuales** y cambiando solo esa clave (research D2). `replace` y no
  `push`: cambiar de filtro no es navegar.
- [ ] T009 [US1] Corregir `irA()` en `web/app/perfil/page.tsx`, que hoy arma la
  URL con literales y **borraria el filtro al alternar de vista** (research D2).
  Es el defecto silencioso mas probable de todo el feature.
- [ ] T010 [US1] Los cuatro cortes en `historial.tsx` —todos, pendientes,
  aceptados, entregados—, **excluyentes**, con `bg-accent` **solo en el que esta
  puesto** y contorno en los demas (FR-001, FR-015). Alto minimo de toque 48 dp.
- [ ] T011 [US1] Filtrar **antes** de recortar a `VISIBLES_AL_PRINCIPIO`, y con
  un filtro puesto mostrar **todas** las coincidencias sin pedir "Ver todos"
  (US1 escenario 1). Invertir ese orden hace que filtrar por pendientes sobre los
  5 mas recientes diga "no hay" teniendo tres.
- [ ] T012 [US1] Mostrar el **conteo** de lo que se esta viendo cuando hay filtro
  (FR-007).
- [ ] T013 [US1] Separar **los dos vacios** (FR-006): el de "todavia no hiciste
  ningun envio" queda solo para la lista realmente vacia; el de cero coincidencias
  dice eso y ofrece volver a la lista completa.
- [ ] T014 [US1] No dibujar ningun control mientras la lista no llego —sin sesion,
  cargando, o con el servicio caido— para no tapar el aviso de error ni su
  reintento (FR-011).
- [ ] T015 [US1] Correr los pasos **0, 1, 2, 3, 5 y 6** del
  [quickstart](quickstart.md). El 2 y el 6 son los que buscan defectos reales: que
  alternar de vista no se coma el filtro, y que dar de baja un pedido no lo
  resetee. El 0 comprueba FR-012 y SC-005 —que sin tocar nada la pantalla sigue
  siendo la de antes—, y el 6 termina tocando **las cuatro** acciones de la
  tarjeta, no dos (FR-013).

## Fase 4: US2 — Buscar el pedido que tengo en la cabeza (P2)

**Meta**: encontrar un pedido viejo por destinatario o por codigo.

**Prueba independiente**: escribir parte de un nombre y que queden solo los suyos.

- [ ] T016 [P] [US2] Pruebas de la busqueda en
  `web/lib/filtrar-pedidos.test.ts`: parte del nombre encuentra; **con y sin
  tilde encuentran lo mismo** (FR-004); el codigo se encuentra como `142`,
  `fu-0142` y `FU-0142` (FR-003); **una calle de la entrega NO encuentra nada**
  (FR-002, decision del 2026-09-06); y ningun campo de plata participa (FR-014).
  Los dos ultimos son guardas negativas: escribirlas junto a un caso positivo que
  demuestre que la prueba sabria detectar lo contrario.
- [ ] T017 [US2] Implementar la busqueda en `web/lib/filtrar-pedidos.ts`
  **reusando `normalizar()` de `web/lib/direcciones.ts`** (research D4). No
  escribir una segunda normalizacion. El codigo se compara por sus **digitos**.
- [ ] T018 [US2] El campo de texto en `historial.tsx`, **en estado de React y
  nada mas**: no va a la URL ni al almacenamiento (FR-010, FR-017), porque puede
  contener el nombre de un tercero.
- [ ] T019 [US2] Combinar los dos criterios: el corte por estado y el texto se
  aplican juntos, y el conteo y los vacios de US1 valen igual.
- [ ] T020 [US2] Correr el paso **4** del [quickstart](quickstart.md), incluido
  que recargar con texto escrito lo pierda y que no aparezca en la URL.

## Fase 5: Cierre

- [ ] T021 Correr el `verify:` completo del plan y dejarlo verde.
- [ ] T022 Correr los pasos **7, 8 y 9** del [quickstart](quickstart.md): en un
  telefono de verdad, con el servicio caido, y **con el cronometro**. Los dos que
  pueden matar el feature con todo lo demas en verde son el 7 y el 9: cuatro
  cortes que no entran en el ancho de un telefono —o un teclado que tapa la lista
  entera— lo vuelven inutil, y el 9 es SC-001, el unico criterio del spec que se
  mide con un reloj.
- [ ] T023 [P] Actualizar `ARCHITECTURE.md`: que la lista del historial ahora
  filtra en pantalla, que la decision vive en `lib/filtrar-pedidos.ts`, y **por
  que el paginado sigue sin construirse** con su umbral. El sensor permite los
  documentos de la raiz sin que esten en `covers:`.
- [ ] T024 Commitear **con el plan todavia en `active`**, o el sensor rebota el
  commit. Incluir `.specify/feature.json`, que ya apunta a este feature.
- [ ] T025 Poner el plan en `status: completed` y abrir el PR.

---

## Dependencias

- **T001 bloquea todo.** Trabajar sobre `master` sin `022` es escribir sobre
  archivos que estan por cambiar.
- **Fase 2 bloquea las dos historias.**
- **US1 no depende de US2.** US2 tampoco depende de US1 para su logica, pero si
  para la pantalla: los controles y los vacios los construye US1.
- Dentro de US1: T007-T009 (la URL) pueden ir en paralelo con T010-T013 (lo que
  se ve), porque tocan partes distintas del mismo archivo con proposito distinto.

## En paralelo

- T005 y T016 son el mismo archivo de pruebas pero secciones distintas: se pueden
  escribir a la vez si no se pisan.
- T023 no depende de nada del codigo y puede hacerse mientras se prueba.

## MVP

**US1 entera** (T001-T015). Deja el problema resuelto para el caso que Mateo
planteo, y se puede mergear sin US2.
