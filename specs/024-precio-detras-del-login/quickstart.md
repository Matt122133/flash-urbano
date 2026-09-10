# Quickstart: El precio vuelve, del lado de adentro del login

**Feature**: `024-precio-detras-del-login` | **Fecha**: 2026-09-10

## Por qué este archivo importa más que de costumbre

`verify:` corre lint, pruebas y build de `web/`. **Ninguna de esas tres puede
ver el feature funcionando**: este repo no renderiza React (`vitest.config.ts`,
`environment: "node"`), así que todo lo que dependa de la sesión en el navegador
—que es el feature entero— sale de acá o no sale de ningún lado.

Y hay un detalle que lo vuelve filoso: **el modo por defecto es el correcto**.
Si el paso de la sesión se implementa mal y `conSesion` queda siempre `false`,
el sitio se ve exactamente como hoy, las pruebas pasan, el build pasa, y el
feature simplemente no existe. Un `verify:` verde acá no dice nada.

`022` cerró con la mitad del quickstart sin correr. Este tiene once pasos, y
**ninguno necesita un teléfono**: se hace entero desde el navegador de la
máquina, con una consulta a la base en el paso 2b.

## Prerequisitos

- `web/` con dependencias instaladas.
- Backend local arriba, **o** el APK/servicio de producción. Se necesita poder
  iniciar sesión de verdad.
  - Si es local: revisar que no haya un `go run` viejo tomando el 8080 y que el
    `.env` esté completo.
  - Ojo con el 3000: un `next dev` huérfano sirve código viejo sin fallar.
    Mirar **quién** tiene el puerto antes de levantar.
- Una cuenta de prueba y una dirección de entrega que caiga dentro de una zona.
- Para el paso 2b, acceso a la base: `TEST_DATABASE_URL` apuntando a la base de
  desarrollo en Docker. **No al postgres nativo del 5432**, que contesta igual y
  destruiría la base de desarrollo.

```bash
cd web && npm run dev
```

## Los pasos

### 1. Sin sesión, el sitio entero (FR-001, FR-013, SC-002) — el paso que el cliente pidió

Todo en una **ventana privada**.

Primero `/pedido`: completar retiro y entrega, y marcar la esquina de entrega
dentro de una zona.

- ✅ El bloque verde confirma la cobertura y nombra la zona.
- ✅ **No hay ningún monto.**
- ✅ No hay ningún texto que anuncie que existe un precio ni que invite a entrar
  para verlo. Ni "entrá para ver cuánto sale", ni un número tapado.

Después, sin cerrar la ventana privada, recorrer el resto:

- ✅ `/` — sin montos, y ningún llamado a la acción que ofrezca conocer precios.
- ✅ `/sobre-nosotros` — el mapa, su leyenda y los globos de los polígonos, todos
  sin montos.
- ✅ `/contacto` — sin montos.

> Si en cualquiera de estos aparece un número, el feature está entregando lo
> contrario de lo que se pidió. Parar y arreglar antes de seguir.

### 2. Con sesión, el monto aparece junto a la zona (FR-001, FR-007a)

Iniciar sesión y repetir. Con el punto de entrega dentro de una zona:

- ✅ Aparece el monto de esa zona, **dentro del mismo bloque que la nombra**.
- ✅ El texto deja claro que es por **envío**, no por paquete (M5).
- ✅ Recorrer el resto del formulario hasta el botón de confirmar: **no hay
  ningún otro monto**. Sin total, sin resumen, sin línea de precio suelta.

### 2b. El monto que se ve es el que se guarda (FR-014, SC-004)

Es el único paso que mira el dato, y demuestra que volver a mostrar el precio no
cambió lo que se guarda.

Anotar el monto y la zona que muestra la pantalla, y confirmar el pedido. Después,
contra la base:

```bash
psql "$TEST_DATABASE_URL" -c \
  "select codigo, zona_id, precio from pedidos order by creado_en desc limit 1;"
```

- ✅ `precio` es exactamente el monto que decía la pantalla.
- ✅ `zona_id` es la zona que nombraba el bloque.

> Contra producción no corre esta consulta. Si el paso se hace contra el sitio
> desplegado, se verifica en su lugar que el pedido aparece en la app de Diego
> con la zona correcta —**y sin monto**, que es FR-019— y se anota que el
> contraste contra `precio` quedó sin hacer.

### 3. Mover el pin cambia el monto (FR-004)

Con sesión, mover el punto de entrega a otra zona cubierta con otro precio.

- ✅ El monto pasa a ser el de la zona nueva.
- ✅ No aparece ningún aviso de "cambio de precio" (eso se fue en `013` y no
  vuelve).

### 4. El retiro no cotiza (FR-002)

Con sesión, formulario vacío. Escribir **solo** la dirección de retiro.

- ✅ No aparece ningún monto hasta resolver el punto de **entrega**.

### 5. Fuera de zona (FR-002, FR-009)

Con sesión, marcar un punto fuera de las cinco zonas.

- ✅ No hay monto.
- ✅ No se puede confirmar y se encamina al contacto.
- ✅ El mensaje habla de **cobertura**, no de costo.

### 6. La ventana en que la sesión no se resolvió (FR-005a, M1) — el paso que ninguna prueba ve

Con sesión iniciada y el formulario cargado, **recargar la página** (F5) mirando
el bloque de la zona. Conviene hacerlo con la red desacelerada (DevTools →
Network → Slow 3G) para que la ventana sea visible.

- ✅ Aparece primero la confirmación de cobertura con el nombre de la zona.
- ✅ El monto aparece **después**, cuando la sesión se confirma.
- ✅ El bloque **no salta de tamaño** al aparecer el monto (M4).

Y el mismo paso en **ventana privada**, con Slow 3G:

- ✅ En ningún instante aparece un monto. Ni un frame.

### 7. Entrar a mitad de formulario (FR-006, M3) — el que más fácil se rompe

En ventana privada, completar el formulario **entero** (direcciones, punto de
entrega marcado, cantidad, fecha, datos de quien recibe) sin iniciar sesión.
Apretar confirmar: se abre el diálogo de ingreso. Iniciar sesión ahí.

- ✅ Aparece el monto de la zona ya marcada.
- ✅ **No se perdió nada de lo tipeado**, y el punto de entrega sigue donde
  estaba.

> Este camino ya rompió el formulario una vez, el 2026-08-14 (T039): el
> formulario se desmontaba y volvía con los datos del perfil encima de lo
> tipeado. La precarga se congela justamente para evitarlo. Si acá se pierde
> algo, la regresión es esa, no el precio.

### 8. Cerrar sesión con el monto a la vista (FR-005, M2)

Con el monto en pantalla, cerrar sesión desde otra pestaña o desde el menú.

- ✅ El monto desaparece **sin recargar**.

### 9. El monto no se escapa (FR-008, FR-011, FR-012)

Con sesión iniciada, recorrer:

- ✅ `/` — sin montos.
- ✅ `/sobre-nosotros` — el mapa y su leyenda siguen sin montos; los globos de
  los polígonos dicen el nombre de la zona y nada más.
- ✅ `/perfil` (*Mis pedidos*) — ninguna tarjeta muestra un monto, **incluidos
  los pedidos creados después de este cambio**.
- ✅ Si la cuenta de prueba tiene un pedido **anterior al 2026-08-22**, mirarlo
  con atención (SC-008): su `precio` guardado se calculó desde la zona de
  **retiro** y nunca fue el precio de ese envío bajo las reglas de hoy. Es el
  caso que justifica que la columna no se lea. Si no hay ninguno tan viejo,
  **decirlo y anotarlo**, no tildar el paso.
- ✅ Generar la etiqueta imprimible de un pedido: código, destinatario,
  remitente y zona. **Sin monto.**

### 10. El formulario sigue andando sin servicio (FR-016)

Bajar el backend. Con credencial ya guardada, abrir `/pedido`.

- ✅ El formulario carga, la dirección se resuelve y el monto se ve.
- ✅ Recién confirmar falla, y falla con un mensaje legible.

## Antes de dar la tarea de la guarda por hecha

Romper la implementación **a propósito** y ver rojo. Una guarda que nunca se vio
fallar no es una guarda:

1. En `lib/precio-visible.ts`, devolver el monto ignorando `conSesion`.
   `npm test` **tiene que fallar** en `precio-visible.test.ts`.
2. Escribir la palabra `precio` en `web/components/pedido-form.tsx`.
   `npm test` **tiene que fallar** en `sin-precio-a-la-vista.test.ts`.
3. Importar `MontoDeZona` desde un segundo archivo del `covers:`. `npm test`
   **tiene que fallar** (C2).
4. En `pedido-form.tsx`, agregar `import { credencial } from "@/lib/sesion"`.
   `npm test` **tiene que fallar** en `cotizar-abierto.test.ts`.

Revertir las cuatro.

> **Las cuatro roturas van en archivos del `covers:` del plan**, y no es un
> detalle de comodidad: `AGENTS.md` prohíbe editar fuera de `covers:` durante la
> ejecución y no hace excepción por "es temporal y lo reviento". La versión
> anterior de este archivo mandaba romper `historial.tsx`, que está fuera. Romper
> `pedido-form.tsx` prueba exactamente lo mismo —la guarda escanea `components/`
> entero— sin salirse del plan.

## Qué hacer con lo que quede sin correr

Anotarlo en [`docs/tech-debt-tracker.md`](../../docs/tech-debt-tracker.md) con
qué es, qué cuesta que no se haya corrido y cuál es el disparador. **No** darlo
por hecho en `tasks.md`.
