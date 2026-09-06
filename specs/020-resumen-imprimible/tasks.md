# Tasks: La etiqueta que se pega al paquete

**Feature**: `020-resumen-imprimible` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Fecha**: 2026-09-05

El orden importa en un solo lugar y vale la pena decirlo arriba: **la estructura
de la etiqueta (Fase 3) se construye y se prueba antes de dibujar nada**. Es lo
que hace que FR-007 —que no haya ningun importe— se verifique sobre texto
inspeccionable en vez de raspando bytes de un PDF.

Tests: se generan. El area no tiene ninguno hoy y el requisito central de este
feature es una **prohibicion**, que sin prueba no se sostiene sola.

## Phase 1: Setup

- [x] T001 Correr `cd web && npm test` antes de tocar nada y anotar el resultado,
      para que un rojo posterior sea atribuible a este feature.
- [x] T002 Instalar `jspdf` como dependencia y `fast-png` como dependencia **de
      desarrollo** en `web/package.json`. La segunda corre en Node al generar el
      asset y **no debe viajar al navegador**; si termina en el bundle, esta mal
      declarada.
- [x] T003 Leer la guia de Next que corresponda en `node_modules/next/dist/docs/`
      antes de escribir componentes, como exige `web/AGENTS.md`. Interesa lo de
      importaciones dinamicas en el App Router.

## Phase 2: Foundational — la silueta

- [x] T004 Escribir `web/design-source/build-silueta.js`: lee
      `public/logo-flash-urbano.png`, umbrala por **canal alfa** (no por color,
      research D3), recorta el camion y escribe `public/silueta-camion.png` en
      negro sobre transparente. El recorte acota en `x` **y en `y`**; las
      constantes llevan el motivo escrito al lado, como en `build-favicon.js`.
- [x] T005 Correr el generador y **mirar el PNG**: camion macizo con lineas de
      velocidad, **sin la cola de *TRANSPORTE*** y sin el resto de la linea
      naranja. Paso 1 del [quickstart](quickstart.md). El archivo ronda los 3,5 KB.
- [x] T006 [P] Documentar el generador en `web/design-source/README.md`, con el
      porque del umbral por alfa: el logo es para fondo azul y la mitad de sus
      elementos son blancos, asi que sobre papel no se puede usar entero.

## Phase 3: User Story 1 — la etiqueta al confirmar (P1)

**Goal**: Que quien acaba de confirmar descargue un PDF A4 listo para pegar.

**Independent test**: confirmar un pedido, tocar el boton, abrir el archivo.

- [x] T007 [US1] Crear `web/lib/etiqueta.ts` con el tipo neutro `Etiqueta`
      (data-model) y el adaptador **desde la confirmacion**: `FormState` + codigo.
      Las direcciones salen de `componerDireccion` de `lib/direccion.ts` —**no se
      escribe otro compositor** (FR-010)—; la zona sale de `resolverZona` sobre el
      punto de entrega, y **se omite el campo** cuando no hay punto.
- [x] T008 [US1] Escribir `web/lib/etiqueta.test.ts` con las guardas que son el
      nucleo del feature: **ningun importe en la estructura** (FR-007), **ni
      tamaño ni hora de retiro** (FR-008), la zona ausente sin punto (FR-018), y
      las direcciones compuestas igual que en pantalla (FR-010).
- [x] T009 [US1] **Control negativo de FR-007, obligatorio**: agregar
      temporalmente un monto a la estructura, correr `npm test`, comprobar que
      **esa prueba se pone en rojo**, y sacarlo. Una guarda que afirma que algo no
      pasa no vale nada sin un caso que demuestre que sabria detectarlo. Paso 2
      del quickstart.
- [x] T009b [US1] Agregar en `web/lib/etiqueta.test.ts` la guarda del grafo de
      imports (FR-013 y FR-017): **`lib/etiqueta.ts` nunca alcanza `lib/api.ts`**
      —componer la etiqueta no puede depender del servicio— **y en ningun archivo
      del feature aparece `window.print`** —el producto entrega un archivo y no
      intenta imprimir—. Se copia la forma de `lib/cotizar-abierto.test.ts`, que
      ya hace exactamente esto para el formulario, **control positivo incluido**:
      una afirmacion de que la guarda SI encuentra el import cuando existe. Sin
      ese control, borrar medio archivo la dejaria verde.
- [x] T010 [US1] Crear `web/lib/etiqueta-pdf.ts`: dibuja la hoja A4 con jsPDF a
      partir de una `Etiqueta` — codigo dominante, bloques de entrega y retiro,
      fecha, cantidad, zona, silueta arriba y el nombre **como texto** (FR-019).
      El corte de lineas largas usa el medidor de ancho de la libreria, **no
      cuenta caracteres** (FR-012). Devuelve el documento y **no dispara la
      descarga**, para poder probarlo sin navegador.
- [x] T011 [US1] Agregar el boton *Imprimir resumen* al componente `Confirmation`
      de `web/components/pedido-form.tsx`. Importa `etiqueta-pdf` de forma
      **dinamica al tocarse** (FR-014), muestra que esta trabajando, y nombra el
      archivo con el codigo (FR-016).
- [x] T012 [US1] Manejar la falla en ese boton (FR-015): si la libreria no carga
      o la descarga se bloquea, **decirlo en pantalla**. Nunca quedarse sin hacer
      nada — ese sintoma ya se produjo en este mismo formulario el 2026-08-14 y es
      indistinguible de un boton roto.

## Phase 4: User Story 2 — reimprimir desde Mis pedidos (P1)

**Goal**: Que la misma etiqueta se pueda volver a sacar sin crear otro pedido.

**Independent test**: imprimir el mismo pedido desde las dos pantallas y comparar.

- [x] T013 [US2] Agregar a `web/lib/etiqueta.ts` el segundo adaptador, **desde un
      `PedidoGuardado`**. Es el unico que puede venir sin punto de entrega —un
      pedido anterior a `011`— y ahi la zona queda ausente.
- [x] T014 [US2] **La prueba que justifica todo el tipo neutro** (FR-003): un
      mismo pedido, expresado en las dos formas, MUST producir estructuras
      identicas. En `web/lib/etiqueta.test.ts`.
- [x] T015 [US2] Agregar el boton a `web/components/pedido/tarjeta-pedido.tsx`,
      con el mismo comportamiento de carga y de error que T011 y T012.

## Phase 5: User Story 3 — que se lea pegada a una caja (P2)

**Goal**: Que la hoja sirva parado frente a una caja, no sentado.

**Independent test**: imprimirla en papel y leerla a un brazo.

- [x] T016 [US3] Ajustar el layout con **datos al maximo**: nombre largo y
      direccion con calle compuesta, numero, apto, esquina y cooperativa, en
      retiro y en entrega. Ningun bloque se pisa, nada se sale de la hoja.
- [x] T017 [US3] Comprobar en un PDF real que **las tildes y la ñ se dibujan**.
      research D2 comprobo la codificacion —que los bytes correctos llegan al
      archivo—; que el visor los dibuje es otra cosa y no la prueba nadie mas.
- [ ] T018 [US3] **DIFERIDO el 2026-09-05.** Mateo genero la etiqueta y la
      miro en pantalla —dice que quedo bien y que sale al toque— pero **no la
      imprimio**. Lo que queda sin comprobar es especifico del papel: si la
      silueta sale como camion o como mancha en una impresora mono con poco
      toner, y si el codigo se lee parado frente a una caja. Ver la fila del
      2026-09-05 en `docs/tech-debt-tracker.md`.
      Imprimir la hoja en papel, en blanco y negro, pegarla en una
      caja y leerla parado. Es la unica forma de ver si la silueta queda como una
      mancha o como un camion, y si el codigo se lee de lejos (FR-004, SC-005).

## Phase 6: Polish & Cross-Cutting

- [x] T019 Comprobar SC-006 con la pestaña de red: navegar el sitio **sin tocar
      el boton** no descarga nada de jsPDF; recien al tocarlo aparece la request.
      Paso 5 del quickstart.
- [x] T020 Comprobar FR-015 de verdad: con la red cortada, tocar el boton y ver
      el mensaje. Si no pasa nada, esta mal.
- [x] T021 [P] Actualizar `ARCHITECTURE.md`: `lib/etiqueta.ts` como el modulo que
      compone la hoja desde dos formas del pedido, y por que el corte con
      `etiqueta-pdf.ts` es lo que hace verificable la prohibicion de importes.
- [x] T022 Correr `verify:`: `cd web && npm run lint && npm test && npm run build`.

## Phase 7: Cierre

- [ ] T023 **DIFERIDO el 2026-09-05.** Probado solo en la maquina de
      desarrollo. Es la verificacion mas propensa a sorprender —la descarga se
      comporta distinto en cada navegador de telefono— y el sitio es
      mayoritariamente movil (Principio IV).
      Comprobar en un telefono de verdad que **el archivo llega y se abre**
      (paso 6 del quickstart). Donde aterrice da igual (FR-017); el unico
      resultado incorrecto es que no pase nada. **No se puede hacer desde la
      sesion**: necesita el sitio servido por LAN y un telefono en la mano.
- [x] T024 Commitear con el plan todavia en `active`, o el sensor de cobertura
      rebota el commit. Convencion: `feat: mensaje corto 020-resumen-imprimible`,
      sin tildes.

## Dependencies

```text
T001, T002, T003
   └─> T004 ─> T005 ─> T006 [P]        (la silueta, mirada antes de seguir)
         └─> T007 ─> T008 ─> T009      (US1: estructura, guardas, control negativo)
               └─> T009b ─> T010 ─> T011 ─> T012
                     ├─> T013 ─> T014 ─> T015   (US2)
                     └─> T016, T017, T018       (US3: layout y papel)
                           └─> T019, T020, T021 [P] ─> T022 ─> T023 ─> T024
```

- **T009 depende de T008** y no se saltea: es lo que hace que FR-007 sea una
  guarda y no una declaracion.
- **T014 depende de T013**: no se puede comparar las dos formas hasta tener las
  dos.
- **T010 despues de T008**: se dibuja una estructura que ya esta probada.
- **T009b tiene su propio control positivo**, por el mismo motivo que T009:
  una guarda que afirma que un import NO existe queda verde si deja de mirar
  donde cree que mira.

## Parallel opportunities

- **T006** (documentar el generador) en paralelo con la Fase 3.
- **T021** (ARCHITECTURE) en paralelo con la Fase 6.

El resto es una cadena: casi todo pasa por `lib/etiqueta.ts`.

## Implementation strategy

**MVP = Fases 2 y 3** (T004-T012). Con eso el boton de la confirmacion ya
descarga la etiqueta, que es el pedido textual del cliente. La Fase 4 lo hace
util cuando la impresion no sale a la primera, que es el caso mas comun.

**La Fase 5 no la cierra ningun comando y es la que decide si la etiqueta se
usa.** Una hoja que compila y no se lee no sirve para nada, y este repo ya tuvo
dos defectos asi en `012` —texto recortado y un error crudo en pantalla— que
compilaban perfecto.
