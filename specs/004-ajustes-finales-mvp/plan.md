---
ticket: none
status: completed
covers:
  - web/components/
  - web/lib/
  - web/app/contacto/
  - web/app/layout.tsx
  # La sección "Scope boundaries" de la constitución lista `payment method,
  # pickup/delivery windows, retriever info` como parte del alcance de la web.
  # Este feature saca los tres, así que esa línea queda mintiendo. Enmienda
  # acordada con el dueño del repo el 2026-08-06. Ver "La enmienda" más abajo.
  - .specify/memory/constitution.md
  # spec-kit escribe acá cuál es el feature activo; el sensor de cobertura lo ve
  # como edición igual que cualquier otra. Mismo caso que en 002 y 003.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build
analyzed: 2026-08-06
---

# Implementation Plan: Ajustes finales del MVP

**Feature dir**: `specs/004-ajustes-finales-mvp` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-ajustes-finales-mvp/spec.md`

> **Rama git**: `ajustes-finales-mvp`, creada desde `master`. El `BRANCH` que
> reporta spec-kit sale de `.specify/feature.json` y dice
> `004-ajustes-finales-mvp`, así que los dos nombres no coinciden — es lo mismo
> que pasó en `002` y `003`.

## Summary

Este feature es casi todo **resta**. El cliente revisó el MVP y marcó qué sobra:
el tipo de cliente, la forma de pago, la fecha y la hora de entrega, y el nombre
y la cédula de quien recibe. En su lugar entran dos cosas: un aviso fijo de que
el paquete se entrega dentro de las 24 horas del retiro, y el teléfono del
destinatario para poder coordinar.

Junto con eso entran dos datos que el mismo doc del cliente ya responde y que
estaban bloqueando trabajo registrado en el tracker: el WhatsApp real
(`092 171 791`), que a su vez destraba sacar el `noindex`; y la regla de qué
zona paga una dirección sobre un límite de zona (**la más barata**), que hoy el
código cumple por casualidad y no por regla.

El riesgo técnico está concentrado en un solo lugar: `web/lib/fechas.ts` existe
para comparar el retiro con la entrega, y la entrega desaparece. No es borrar un
campo — es que el módulo se queda sin su razón de ser y hay que decidir qué
sobrevive. Ver research R1.

## Technical Context

**Language/Version**: TypeScript 5 sobre Next.js 16.2.12 (App Router), React
19.2.4. Sin cambios.

**Primary Dependencies**: las que ya hay. **No se agrega ni se quita ninguna.**

**Storage**: ninguna. El estado del formulario vive en memoria y no se persiste,
así que quitar campos no arrastra migración de datos ni compatibilidad hacia
atrás.

**Testing**: Vitest 4 (`npm test`). Hoy hay dos módulos con pruebas —
`web/lib/zona-lookup.ts` y `web/lib/direcciones.ts`. Este feature **reescribe**
las pruebas de `fechas.ts` (la mitad de sus casos deja de existir) y **agrega**
un caso a las de `zona-lookup.ts` que hoy no se puede escribir.

**Target Platform**: navegadores de teléfono en primer lugar (Principio IV).
Sitio estático en GitHub Pages bajo el `basePath` `/flash-urbano`.

**Project Type**: aplicación web de una sola superficie (`web/`).

**Performance Goals**: ninguna nueva. El feature quita campos y una función de
comparación de fechas; nada se vuelve más lento.

**Constraints**: sitio estático sin servidor. El compromiso de 24 horas es una
promesa comercial que el sitio **comunica y no verifica** — no hay nada del lado
del sitio que pueda hacerla cumplir, y FR-009a prohíbe expresamente calcular un
momento de entrega que aparente lo contrario.

**Scale/Scope**: seis cambios sobre cuatro archivos de código, dos de pruebas y
la constitución. Un operador, decenas de pedidos por día.

## Constitution Check

*GATE: pasa antes de Phase 0. Re-evaluado después del diseño de Phase 1.*

**Principio I (visual-first)**: el feature es visible de punta a punta — el
cliente abre el formulario y ve que le pide menos. Las cinco historias son
demostrables por separado. **Pasa.**

**Principio II (autogestión es el valor)**: cuatro campos obligatorios menos en
la superficie de mayor prioridad del producto. **Pasa, y refuerza.**

**Principio III (simplicidad sobre infraestructura)**: se borra código y una
regla de validación cruzada. No entra ninguna dependencia ni abstracción. La
decisión de que el aviso de 24 horas sea texto fijo y no un momento calculado
(FR-009a) es este principio aplicado: la alternativa pedía aritmética de fechas
y sus pruebas para no ganar nada. **Pasa, y refuerza.**

**Principio IV (mobile-first, poco tipeo)**: dos campos de fecha/hora menos, un
selector menos y un campo de texto menos, contra un campo de teléfono nuevo.
**Pasa.**

**Principio V (el sitio cotiza; nunca adivinar una zona)**: el feature toca el
módulo que decide la plata, así que merece detalle.

- El precio sigue saliendo del punto de retiro y de ningún otro lado.
- Un punto fuera de las cinco zonas sigue sin producir precio ni pedido, y
  sigue sin ofrecerse la zona más cercana (FR-023).
- **Lo que cambia es el desempate, y cambia de convención interna a regla del
  negocio.** El principio dice que los límites son "vinculantes para el cobro" y
  que son un dato, no un dibujo. Hasta hoy, cuál de dos zonas cobraba un punto
  sobre un borde compartido lo decidía el orden de la lista. Desde este feature
  lo decide la respuesta del cliente: la más barata. **Pasa, y cierra la
  salvedad que `003` dejó anotada** en su propio Constitution Check.

**La enmienda.** La sección *Scope boundaries* de la constitución enumera, para
la web de clientes, `payment method, pickup/delivery windows, retriever info`.
Este feature saca la forma de pago, saca la ventana de entrega y redefine qué es
la información de quien recibe. La línea queda mintiendo.

No es una reversión de principio: los cinco principios quedan intactos, y de
hecho tres salen reforzados. Es el cliente **achicando su propio brief**, que es
justo la fuente de la que esa lista se derivó. Por eso corresponde **bump MINOR
(2.0.0 → 2.1.0) y no MAJOR, y no hace falta ADR** — la gobernanza pide ADR
"cuando el cambio reversa una decisión previa", y acá no se reversa nada: se
corrige una lista contra su propia fuente. Acordado con el dueño del repo el
2026-08-06. `.specify/memory/constitution.md` está en `covers:`.

**Plan-bounded change (harness)**: `covers:` nombra los prefijos que este
feature toca. **Pasa.**

**Verified before done (harness)**: `verify:` es
`cd web && npm run lint && npm test && npm run build`, el mismo de `002` y
`003`. **Pasa.**

Sin violaciones que justificar; Complexity Tracking queda vacío.

### Re-evaluación después del diseño (Phase 1)

El diseño no introdujo violaciones nuevas.

- La decisión de research R1 —**achicar `fechas.ts` en vez de borrarlo**— no
  contradice el Principio III. Lo que queda (`hoy()` y una comprobación de que
  el retiro no está en el pasado) sigue siendo la lógica que se quiere probar
  sin mirar la pantalla, que es la razón por la que el módulo existía.
- La decisión de R2 —resolver la zona **por precio y no por posición en la
  lista**— hace que el Principio V deje de depender de una coincidencia. Es
  menos código frágil, no más.
- No se agrega ningún contrato ni interfaz especulativa. Los dos documentos de
  `contracts/` describen comportamiento que ya existe o que este feature cambia,
  no puntos de extensión futuros.

## Project Structure

### Documentation (this feature)

```text
specs/004-ajustes-finales-mvp/
├── plan.md                    # Este archivo
├── spec.md                    # Qué y por qué
├── research.md                # Phase 0: las cinco decisiones
├── data-model.md              # Phase 1: el Pedido después de la resta
├── quickstart.md              # Phase 1: cómo se valida que anda
├── contracts/
│   ├── formulario-pedido.md   # Phase 1: campos y validación resultantes
│   └── zona-lookup.md         # Phase 1: la garantía de resolverZona
├── checklists/
│   └── requirements.md
└── tasks.md                   # Lo emite /speckit-tasks, no este comando
```

### Source Code (repository root)

```text
web/
├── lib/
│   ├── fechas.ts              # Se achica: queda hoy() y "retiro no en el pasado"
│   ├── fechas.test.ts         # Se reescribe: la mitad de los casos desaparece
│   ├── zona-lookup.ts         # Cambia el desempate: por precio, no por orden
│   ├── zona-lookup.test.ts    # Suma el caso que hoy no se puede escribir
│   └── zonas.ts               # Generado. NO se toca
├── components/
│   └── pedido-form.tsx        # El grueso: campos, validación, resumen
└── app/
    ├── contacto/page.tsx      # WhatsApp real, un solo número
    └── layout.tsx             # Se va el noindex

.specify/memory/constitution.md  # Scope boundaries + versión 2.1.0
```

**Structure Decision**: sin cambios estructurales. Se mantiene la separación de
`ARCHITECTURE.md` entre dato generado (`zonas.ts`) y lógica escrita a mano
(`zona-lookup.ts`), y este feature es un buen ejemplo de por qué existe: cambia
la regla que consulta el dato sin tocar un solo polígono.

`ARCHITECTURE.md` describe a `pedido-form.tsx` como el archivo que se toca
cuando cambia el brief del cliente. Es exactamente lo que pasa acá, así que no
hay nada que corregir en esa descripción.

## Enfoque de ejecución

El orden importa poco entre bloques —son independientes— salvo que conviene
dejar el formulario para el final, porque es donde se acumula el riesgo de
romper algo que ya andaba.

**Primero, la zona.** `zona-lookup.ts` deja de devolver la primera zona de la
lista que contenga el punto y pasa a devolver **la de menor precio entre todas
las que lo contienen**, con el id más bajo como desempate estable cuando dos
comparten precio (research R2). El comentario del módulo tiene que decir que
esto es la respuesta del cliente y no una convención, porque hoy dice lo
contrario. La prueba nueva es la que importa: **un punto contenido por dos zonas
donde la más barata NO es la primera de la lista**. Hoy ese caso no se puede
escribir sin fixture propio, porque las cinco zonas reales están ordenadas por
precio creciente — que es justamente el accidente que este cambio elimina.

**Segundo, las fechas.** `fechas.ts` pierde `MARGEN_MINIMO_MINUTOS`,
`enMinutos()`, y dos de los tres `ProblemaDeFechas`. Queda `hoy()` y la
comprobación de que el retiro no cayó en un día que ya terminó. La comparación
sigue siendo **por día y no por instante**, que es una decisión deliberada ya
documentada en el módulo y que este feature no revisa. Las pruebas se reescriben
en consecuencia: los casos de margen y de orden entre retiro y entrega dejan de
tener sentido, no "quedan pendientes".

**Tercero, el contacto.** Un solo número, `092 171 791`, en formato
internacional `59892171791` para el enlace `wa.me` (research R3). El número
además se muestra como texto legible, cosa que hoy no pasa: la tarjeta dice
"WhatsApp" y nada más. Se va el `TODO` del encabezado del archivo.

**Cuarto, el `noindex`.** Sale de `layout.tsx`, junto con el comentario que
explica por qué estaba. Los dos motivos que el comentario declara —teléfono
ficticio y precios de zona sin validar— dejan de aplicar: el teléfono pasa a ser
real acá, y los precios los definió el cliente (el doc dice "ZONA 2 $ 200", que
es lo que tiene `zonas.ts`).

**Quinto, el formulario.** Es el bloque más grande y el único donde hay que
tener cuidado con lo que se arrastra. Se sacan `clientType`, `paymentMethod`,
`deliveryDate`, `deliveryTime`, `recieverName` y `recieverCI` del `FormState`,
del `INITIAL_STATE`, de `validate()`, del render y del resumen. Entra
`receiverPhone`, validado con el mismo criterio que el teléfono de quien envía
(≥8 dígitos), y **con la clave del error escrita igual en `validate()` y en el
render** — ver research R5, que es el detalle por el que el error del campo
anterior nunca se mostraba. El encabezado "Fechas y forma de pago" pasa a hablar
solo del retiro, y ahí abajo va el aviso fijo de las 24 horas.

**Sexto, la constitución.** Se corrige la línea de *Scope boundaries*, se sube a
2.1.0 y se agrega la entrada al historial de enmiendas.

**Séptimo, el tracker.** Dos filas pasan a `Resolved`: la `High` del límite de
zona (la respondió el cliente y ahora está codificada) y la `Medium` del error
que nunca se mostraba (el campo desapareció). Se agrega una fila nueva por el
copy obsoleto de `/pedido` — ver Riesgos.

## Riesgos

**El copy obsoleto de `/pedido` queda sin arreglar.**
`web/app/pedido/page.tsx:16` dice "marcá en el mapa desde dónde retiramos el
paquete". Eso dejó de ser cierto en `003`: el punto sale del cruce de calles y
solo se puede arrastrar dentro de la cuadra. Es texto equivocado sobre cómo se
usa la superficie más importante del sitio, y encima está a punto de volverse
visible para buscadores. **No entra en este feature**: consultado el dueño del
repo el 2026-08-06, decidió dejarlo afuera y anotarlo. `web/app/pedido/` queda
deliberadamente fuera de `covers:`, y la corrección va al tracker. El costo
asumido está dicho: el sitio se publica explicándole mal a la gente cómo se usa
la pantalla más importante.

**El aviso de 24 horas es una promesa que el sitio no puede cumplir.** Está
dicho en el spec y vale repetirlo acá: no hay backend, el pedido no le llega a
nadie, y el sitio termina en una pantalla de resumen. Este feature hace que el
sitio prometa un plazo. Quien lo cumple es Diego, a mano, con la información que
todavía no le llega por ningún canal automático. No es un defecto de este plan
—es el mismo agujero que `003` dejó anotado— pero pasar de "elegí cuándo querés
la entrega" a "la entregamos en 24 horas" sube la apuesta.

**Sacar el `noindex` es de una sola dirección en la práctica.** Una vez que el
sitio se indexa, volver a ponerlo no lo saca de los buscadores de inmediato.
Conviene que sea el último paso que se toca antes de mergear, y con el número
real ya puesto en el mismo commit.

**Las pruebas de fechas se reescriben, no se recortan.** El riesgo real es
borrar casos y quedarse sin ninguno. Lo que queda —el retiro en el pasado, el
cambio de mes, el mismo día— sigue mereciendo prueba, y `verify:` no distingue
entre "las pruebas pasan" y "quedan pocas pruebas".

## Complexity Tracking

Sin violaciones al Constitution Check. Nada que justificar.
