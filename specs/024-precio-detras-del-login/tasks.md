# Tasks: El precio vuelve, del lado de adentro del login

**Feature**: `024-precio-detras-del-login` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Organización**: por historia. US1 y US2 son **las dos mitades de un mismo
cambio** y las dos son P1 — el cliente no pidió "mostrar el precio", pidió "que
no se vea sin estar logueado". US1 sola, entregada sin US2, es exactamente el
feature que él no quiere.

**Sobre las pruebas**: `web/vitest.config.ts` corre en `environment: "node"` con
`include: ["lib/**/*.test.ts"]`. **Nada en este repo renderiza React.** O sea que
la única parte de este feature con prueba automática posible es la función pura
de `lib/` (research D3). Todo lo demás sale del quickstart o no sale.

**El riesgo que ordena todo lo de abajo**: el modo por defecto de este feature es
el correcto. Si `conSesion` queda siempre `false`, el sitio se ve igual que hoy,
`verify:` pasa verde y el feature no existe. **Un verde acá no prueba nada**; por
eso la Fase 6 es tarea y no nota al pie.

---

## Fase 1: Preparación

- [ ] T001 Correr `cd web && npm run lint && npm test && npm run build` sobre la
  rama limpia y anotar el resultado. Es la línea de base: si algo ya está en
  rojo, se sabe antes de escribir nada. Esperado: verde, con
  `sin-precio-a-la-vista.test.ts` y `cotizar-abierto.test.ts` pasando.

## Fase 2: La decisión, pura (bloquea a todas las historias)

**Va primero y no es orden arbitrario**: es lo único que puede probarse solo, y
si la regla queda adentro de un componente el feature se queda sin guarda
automática para siempre.

- [ ] T002 Crear `web/lib/precio-visible.ts` con la firma
  `precioVisible({ zona, conSesion }): number | null`, **devolviendo `null`
  siempre**. Primero la forma y el contrato; la regla en T004.
- [ ] T003 Crear `web/lib/precio-visible.test.ts` con las cuatro filas de la
  tabla de [data-model.md](data-model.md): zona+sesión → el monto; zona sin
  sesión → `null`; sin zona con sesión → `null`; sin zona sin sesión → `null`.
  **La primera fila es el control positivo y no es opcional**: sin ella, una
  implementación que devuelva `null` siempre —o sea el feature sin construir—
  pasa las otras tres en verde. Con T002 puesto, esta prueba **tiene que estar en
  rojo en esa fila**; comprobarlo antes de seguir.
- [ ] T004 Implementar la regla en `web/lib/precio-visible.ts`: hay monto si y
  solo si hay zona **y** hay sesión. El estado de sesión sin resolver entra como
  `conSesion: false` (FR-005a) — eso lo decide quien llama, no esta función.
  `npm test` en verde.

## Fase 3: US1 — El cliente identificado ve cuánto sale (P1)

**Meta**: con sesión y el punto de entrega dentro de una zona, el monto aparece
pegado al nombre de la zona.

**Prueba independiente**: entrar con sesión, marcar una entrega válida, ver el
monto junto a la zona y ningún otro monto en toda la pantalla.

- [ ] T005 [US1] Crear `web/components/pedido/precio-de-zona.tsx`: recibe
  `monto: number | null`, **no renderiza nada con `null`**, y con un número lo
  formatea como pesos uruguayos sin decimales y con separador de miles
  (`$ 1.200`, research D4). No decide nada — la decisión ya vino de `lib/`. El
  texto tiene que dejar claro que el monto es **por envío y no por paquete**, sin
  convertirse en un total (FR-007a). Es el **único** archivo de `app/` o
  `components/` que puede nombrar un precio.
- [ ] T006 [US1] En `web/components/pedido-form.tsx`, `ResultadoZona` recibe
  `conSesion: boolean` y, **solo en su rama de zona resuelta**, renderiza
  `<PrecioDeZona monto={precioVisible({ zona, conSesion })} />`. Las otras tres
  ramas —mapa caído, sin punto, fuera de zona— no se tocan
  ([contracts/bloque-de-zona.md](contracts/bloque-de-zona.md)).
- [ ] T007 [US1] En el mismo archivo, `PedidoForm` acepta `conSesion` como prop y
  se lo pasa a `ResultadoZona`. **`pedido-form.tsx` no puede nombrar `precio` en
  ninguna línea** ni importar nada de sesión: la guarda de `013` y
  `cotizar-abierto.test.ts` lo prohíben, y las dos tienen que seguir verdes.
- [ ] T008 [US1] En `web/components/pedido/crear-pedido.tsx`, pasar
  `conSesion={Boolean(usuario)}` al `<PedidoForm>`. `usuario` y `cargando` ya
  salen de `useSesion()` en ese archivo (`:360`); **no hace falta importar
  nada nuevo**. Con `cargando` no hace falta hacer nada explícito: `PedidoForm`
  no se monta hasta que la precarga se resolvió (`:277`), y la precarga espera a
  `cargando === false` (research D1).

## Fase 4: US2 — El visitante sin cuenta sigue sin llevarse el número (P1)

**Meta**: que el monto no se pueda escapar de ese bloque, ni a un anónimo ni a
otra pantalla, y que romperlo ponga algo en rojo.

**Prueba independiente**: en ventana privada, recorrer el formulario entero con
una dirección válida y no ver ningún monto ni ninguna mención de que existe uno.

- [ ] T009 [US2] Redefinir `web/lib/sin-precio-a-la-vista.test.ts` (**redefinir,
  no borrar** — FR-017): exceptuar del escaneo la ruta exacta
  `components/pedido/precio-de-zona.tsx`, y **solo** esa. Todo el resto de `app/`
  y `components/` sigue sin poder nombrar `precio`, `$ 250`, `costo` ni
  `cuánto sale`. Actualizar el comentario de cabecera: hoy explica una promesa
  que dejó de ser cierta, y ese comentario es la mitad del valor de la guarda.
- [ ] T010 [US2] Sumarle a esa misma prueba el control C2 del contrato:
  `precio-de-zona.tsx` tiene que ser importado por **exactamente un** archivo.
  Sin esto la excepción autoriza un archivo que después se cuelga de cualquier
  pantalla, y FR-007a se pierde sin que nada se ponga en rojo.
- [ ] T011 [US2] Comprobar que **no se agregó ningún mensaje sustituto** para el
  visitante sin sesión (FR-013): ni "entrá para ver cuánto sale", ni monto
  tapado, ni mención de que hay un precio. Nota útil: un texto de ese tipo dentro
  de `ResultadoZona` **ya cae** por los patrones `costo` y `cuánto sale` que la
  guarda trae desde `013`; lo que no cubre es una redacción que los esquive, y
  eso lo mira el paso 1 del quickstart.

## Fase 5: US3 — El precio no se escapa del formulario (P2)

**Meta**: las otras diez superficies que `013` limpió siguen limpias.

**Prueba independiente**: con sesión, recorrer inicio, sobre nosotros, Mis
pedidos y la etiqueta impresa sin encontrar un monto.

- [ ] T012 [US3] Correr `npm test` y confirmar que
  `web/lib/cotizar-abierto.test.ts` sigue **verde sin haber sido tocado**
  (FR-016). Si está en rojo, algo del camino del formulario empezó a importar
  `lib/api.ts` o `lib/sesion.ts` y el arreglo es el diseño, no la prueba.
- [ ] T013 [US3] Confirmar con `git diff --stat` que no se tocó ningún archivo
  fuera del `covers:` del plan — en particular `historial.tsx`, `etiqueta.ts`,
  `etiqueta-pdf.ts`, `boton-imprimir.tsx`, `app/sobre-nosotros/` y **todo
  `android/`**. FR-011, FR-012 y FR-019 se cumplen **no tocando nada**, y esta
  tarea es la que lo demuestra.

## Fase 6: Verificación manual — lo único que ve el feature

Los diez pasos de [quickstart.md](quickstart.md), uno por tarea. **Ninguno se
tilda sin haberlo hecho**; lo que no se corra va al tracker en T025.

- [ ] T014 Paso 1 — **Sin sesión, el sitio entero**: `/pedido` con una entrega
  válida marcada, más inicio, sobre nosotros y contacto. Ningún monto en ningún
  estado, y ninguna mención de que exista un precio (FR-001, FR-013, SC-002).
  **Es el paso que el cliente pidió**: si acá aparece un número, parar.
- [ ] T015 Paso 2 — Con sesión, el monto aparece junto a la zona, y **no hay
  ningún otro monto** en el resto del formulario (FR-001, FR-007a).
- [ ] T016 Paso 2b — **El monto que se ve es el que se guarda.** Confirmar el
  pedido del paso anterior, anotando el monto en pantalla, y comprobar contra
  `precio` y `zona_id` en la base (FR-014, SC-004, US1 escenario 5). Es el único
  paso que mira el dato, y el que demuestra que mostrar el precio no cambió lo
  que se guarda.
- [ ] T017 Paso 3 — Mover el pin a otra zona cubierta cambia el monto, sin aviso
  de "cambio de precio" (FR-004).
- [ ] T018 Paso 4 — Cargar solo el retiro no produce monto (FR-002).
- [ ] T019 Paso 5 — Punto fuera de zona: sin monto, sin pedido, mensaje de
  cobertura y no de costo (FR-002, FR-009).
- [ ] T020 [P] Paso 6 — Con red desacelerada, recargar con sesión: la zona
  aparece primero y el monto después; el bloque no salta de tamaño. Y en ventana
  privada, **ni un frame con monto** (FR-005a, M1, M4).
- [ ] T021 [P] Paso 7 — Completar el formulario entero sin sesión, entrar por el
  diálogo, y comprobar que aparece el monto **sin perder lo tipeado ni el punto**
  (FR-006, M3). Este camino ya rompió el formulario el 2026-08-14 (T039).
- [ ] T022 [P] Paso 8 — Cerrar sesión con el monto a la vista: desaparece sin
  recargar (FR-005, M2).
- [ ] T023 [P] Paso 9 — Con sesión: inicio, sobre nosotros, Mis pedidos y la
  etiqueta impresa, todos sin montos (FR-008, FR-011, FR-012). **Incluir un
  pedido anterior al 2026-08-22 si la cuenta de prueba tiene uno** (SC-008): es
  el caso cuyo monto guardado se calculó desde la zona de RETIRO y nunca fue el
  precio de ese envío. Si no hay ninguno tan viejo, decirlo y anotarlo en T026 en
  vez de tildar el paso.
- [ ] T024 [P] Paso 10 — Con el backend abajo y credencial guardada, el
  formulario carga y el monto se ve; solo confirmar falla (FR-016).
- [ ] T025 Las cuatro roturas deliberadas del quickstart, cada una vista **en
  rojo** y revertida: ignorar `conSesion` en `precio-visible.ts`; escribir
  `precio` en `pedido-form.tsx`; importar `PrecioDeZona` desde un segundo
  archivo; importar `@/lib/sesion` en `pedido-form.tsx`. **Las cuatro roturas van
  en archivos del `covers:`** — romper `historial.tsx`, que estaba fuera, habría
  violado la regla del harness aunque se revirtiera. Una guarda que nunca se vio
  fallar no es una guarda.

## Fase 7: Cierre

- [ ] T026 Anotar en [`docs/tech-debt-tracker.md`](../../docs/tech-debt-tracker.md)
  cualquier paso de la Fase 6 que no se haya corrido: qué es, qué cuesta que no
  se haya corrido y cuál es el disparador. **No** tildarlo como hecho.
- [ ] T027 `cd web && npm run lint && npm test && npm run build` en verde
  (`verify:` del plan).
- [ ] T028 Commitear con el plan todavía en `status: active`, y **recién en un
  commit aparte** pasarlo a `completed`. El sensor de cobertura rebota el commit
  si el plan ya está cerrado.

---

## Dependencias

```text
T001
 └─> Fase 2 (T002 → T003 → T004)   [bloquea todo lo demás]
      ├─> Fase 3 US1 (T005 → T006 → T007 → T008)
      │    └─> Fase 4 US2 (T009 → T010, T011)
      │         └─> Fase 5 US3 (T012, T013)
      │              └─> Fase 6 (T014..T025)
      │                   └─> Fase 7 (T026 → T027 → T028)
```

- **US2 depende de US1** en el código, no en el valor: la excepción de la guarda
  (T009) no se puede escribir hasta que exista el archivo que exceptúa (T005).
- **US3 no depende de nada**: se cumple no tocando archivos, y sus dos tareas son
  verificaciones.

## Paralelismo

Poco, y es honesto decirlo: el feature toca cuatro archivos y tres de ellos se
tocan en cadena. Lo que sí corre en paralelo son **T020 a T024**, cinco pasos
manuales independientes entre sí — se pueden repartir entre dos personas o hacer
en cualquier orden.

## MVP

**US1 + US2 juntas, y no US1 sola.** Es la única excepción a "el MVP es la P1":
las dos son P1 porque el pedido del cliente tiene dos mitades y entregar solo la
primera —el monto visible para cualquiera— es entregar lo contrario de lo que
pidió. US3 puede llegar después sin riesgo, porque se cumple no tocando nada.
