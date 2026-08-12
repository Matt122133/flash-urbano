# Tasks: La marca en la pestaña

**Input**: documentos de diseño en `specs/008-marca-en-la-pestana/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [quickstart.md](quickstart.md)

**Tests**: no hay pruebas automáticas propias, y es correcto — lo que este
feature entrega es una imagen, y no hay forma razonable de afirmar en código que
*se distingue un camión*. El `verify:` cubre lo que sí es automatizable: que los
archivos lleguen al export. **El resto es manual y está marcado.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo
- **[MANUAL]**: requiere mirar algo con los ojos; no lo cubre `verify:`

---

## Phase 1: Setup

- [x] T001 Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md` y confirmar los nombres de archivo y el comportamiento en `output: "export"`. Lo manda [`web/AGENTS.md`](../../web/AGENTS.md): esta versión de Next tiene cambios que rompen, y la convención de iconos es justo lo que suele cambiar. **Confirmar además que `app/layout.tsx` no declara `icons:`** — el plan lo asume y por eso `layout.tsx` no está en `covers:`

---

## Phase 2: US1 — La pestaña dice de quién es

- [x] T002 [US1] Escribir `web/design-source/build-favicon.js`: recorta `x 430–599, y 5–168` de `public/logo-flash-urbano.png`, lo compone centrado sobre un cuadrado redondeado en **`#032F9A`** con un margen que deje respirar al camión, y emite los tres archivos. Sigue la forma de `make-logo-transparent.js`, que ya está en ese directorio. **`sharp` ya está** (0.35.3): ninguna dependencia nueva
- [x] T003 [US1] Emitir `web/app/apple-icon.png` a 180×180 (FR-005)
- [x] T004 [US1] Emitir `web/app/favicon.ico` con 16, 32 y 48, **reemplazando el de Vercel**. Que el archivo viejo desaparezca es parte del entregable
- [x] T005 [US1] Emitir `web/app/icon.svg`: el rectángulo azul redondeado con el recorte embebido como PNG en un `<image>`. **No vectorizar el raster** — automáticamente da curvas sucias, y a mano es dibujar un camión nuevo, que es lo que D1 descarta
- [x] T006 [US1] [MANUAL] **Mirar el `.ico` a 16×16, al tamaño real, sin ampliar.** La pregunta es "¿se distingue que es un camión?", no "¿se ve algo?". **Si es una mancha**, volver a T002 y simplificar la silueta — engrosar el contorno, sacar detalle interno. **No** dar SC-002 por cumplido porque el archivo existe
- [x] T007 [US1] [MANUAL] Verificar **SC-001** con [V2](quickstart.md#v2--las-cuatro-combinaciones-sc-001): Chrome y Firefox, tema claro y tema oscuro, **las cuatro**, en ventana privada. El tema claro es el que decide: es donde un camión sin fondo desaparecería. **Verificado por el dueño del proyecto el 2026-08-12 contra el dev server: se ve bien en tema claro y en tema oscuro.** Precisión para que el registro no diga de más: confirmó los dos temas; **no dejó constancia de haber probado los dos navegadores por separado**. El caso que la decisión D2 existía para cubrir —el tema claro— sí está confirmado
- [ ] T008 [US1] [MANUAL] **DIFERIDA al 2026-08-12, no hecha.** Verificar **SC-003** con [V3](quickstart.md#v3--el-telefono-sc-003): agregar el sitio a la pantalla de inicio de un teléfono y ver la marca. Se difiere porque no decide nada que no esté ya decidido: el `apple-icon.png` se genera del mismo compuesto que el resto y se verificó renderizado. Si iOS lo mostrara mal, sería por algo del lado de iOS y no del archivo. **SC-003 queda sin verificar**, dicho así y no tildado

---

## Phase 3: Cierre

- [x] T009 Documentar en `web/design-source/README.md` cómo se corre el generador y qué produce, junto a los otros scripts del directorio
- [x] T010 [MANUAL] Verificar SC-004: borrar los tres archivos generados, correr `node design-source/build-favicon.js`, y comprobar que reaparecen. Un binario que el repo no sabe rehacer es lo que FR-007 prohíbe
- [x] T011 [MANUAL] Verificar SC-006 con `git diff --stat`: ningún archivo de `web/app/` fuera de los tres iconos, y nada de `web/components/`. El logo de la navegación queda igual
- [x] T012 Correr el `verify:` del plan y dejarlo verde. Eso **es** la verificación de **SC-005**: el `GITHUB_PAGES=true npm run build` seguido del `ls out` comprueba que los iconos llegan al export, que es lo que se publica. `npm run build` a secas no lo prueba
- [x] T013 Agregar la entrada del feature a `docs/README.md`
- [x] T014 Poner `specs/008-marca-en-la-pestana/plan.md` en `status: completed`. **Commitear antes**: el sensor rebota el commit si el plan ya está en `completed`
- [x] T015 [MANUAL] **Verificado en produccion por el dueno del proyecto el 2026-08-12, despues de mergear.** POSTERIOR AL MERGE por construcción. Verificar [V5](quickstart.md#v5--en-producción) en el sitio publicado y pidiendo el icono directo por su URL, en ventana privada. Esta tarea **no puede** condicionar el cierre del plan: verifica el sitio desplegado, y el despliegue ocurre al mergear. Exigirla antes de `completed` haría que el plan no se cerrara nunca. Queda como chequeo post-despliegue con dueño

---

## Resultado de T006, el punto de decisión

**Se ejecutó la bifurcación.** El primer render con la región completa se miró a
16×16 al tamaño real y **no pasaba**: las líneas naranjas de velocidad ocupaban
el tercio izquierdo en puro ruido y le dejaban al camión unos 13 px de ancho,
tocando los bordes.

Se simplificó como el plan preveía (D1), y de la forma más barata posible: **una
segunda región de recorte para los tamaños ≤ 24 px**, desde `x=449`, que deja las
líneas afuera. El corte no es a ojo — es donde la racha vertical de píxeles
blancos salta de ~20 a 45, o sea donde arranca la masa sólida del vehículo. De
32 px para arriba las líneas entran, porque ahí ya se leen como movimiento.

También se subieron los márgenes (4 % → 6 % a 16 px) para que la esquina
redondeada se vea y el camión no toque el borde.

**Dos cosas que salieron de mirar y no estaban en el plan:**

- El `icon.svg` pesaba **204 kB**, que lo descarga todo el que entra al sitio. Se
  limitó el raster embebido a 200 px y se pasó a paleta de 64 colores: **5,8 kB**,
  y renderizado lado a lado contra el `apple-icon.png` no se distingue.
- La generación resultó **byte a byte determinista** (T010 compara `sha256`), lo
  que hace de SC-004 una comprobación real y no un "parece igual".

## Dependencias

```
T001 ──► T002 ──► T003, T004, T005  [P entre sí]
                       │
                       └──► T006  ◄── si falla, vuelve a T002
                              │
                              └──► T007, T008  [P]
                                       │
                                       └──► Cierre (T009–T015)
```

**T006 es el punto de decisión del feature.** Todo lo anterior es mecánico;
ahí se sabe si el recorte alcanza o hay que simplificar.

## Estrategia

Una sola historia, un solo tramo. **MVP = el feature entero**: no tiene sentido
entregar dos de los tres formatos.
