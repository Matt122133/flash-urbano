# Research — `013` El precio sale de la vista

Fase 0. Cada decisión con su alternativa descartada. Lo que ya decidió el
cliente no se re-discute acá: está en
[ADR price-not-shown](../../docs/decisions/price-not-shown.md) y en el
Principio V, versión 5.0.0.

## D1 — Qué se saca y qué se queda, archivo por archivo

Se inventarió el repo entero por `precio`/`Precio` antes de planificar. **Once
lugares de cara al cliente muestran o nombran el precio**, y no están donde uno
esperaría.

> **Eran trece, no once.** La guarda de FR-020, escrita antes de tocar una
> pantalla, salió en rojo listando **diez archivos** y dos no figuraban en esta
> tabla: `app/perfil/page.tsx` y `components/sesion/panel-ingreso.tsx`, los dos
> ofreciendo *"ver cuánto sale un envío sin ingresar"* — justo la promesa
> pública que este feature retira. Este inventario se hizo buscando `precio`, y
> esos dos no usan la palabra.
>
> **Es la justificación entera de D2.** El riesgo de este feature es de omisión,
> y una lectura cuidadosa del repo se comió dos de trece. Se dejan las dos
> listas: la tabla como se escribió, y esta corrección.

| Dónde | Qué hace hoy | Qué pasa a hacer |
|---|---|---|
| `app/perfil/page.tsx` | *"Podés ver cuánto sale un envío sin ingresar"* | *"Podés empezar a cargar un pedido sin ingresar"* (FR-008) |
| `components/sesion/panel-ingreso.tsx` | el mismo pie, en el panel de ingreso | lo mismo (FR-008) |

Y la tabla original:

| Dónde | Qué hace hoy | Qué pasa a hacer |
|---|---|---|
| `components/pedido-form.tsx` (bloque de precio) | `Precio del envío` + `$ {zona.precio}` | Confirma la cobertura nombrando la zona, sin cifra (FR-003, FR-003a) |
| `components/pedido-form.tsx` (resumen) | fila `Zona y precio` → `Zona 3 · $ 250` | fila `Zona`, solo el nombre (FR-004) |
| `components/pedido-form.tsx` (cambio de zona) | aviso `de $ X a $ Y` al mover el pin | desaparece (FR-005) |
| `components/pedido-form.tsx` (copy, 4 lugares) | textos que justifican por precio | justifican por cobertura (FR-002) |
| `components/mapa-zonas.tsx` | globo `Zona 3 — $ 250` | globo `Zona 3` (FR-011) |
| `components/mapa-zonas-seccion.tsx` | leyenda con montos, y 3 textos de precio | leyenda con color y nombre (FR-010, FR-012) |
| `components/pedido/tarjeta-pedido.tsx` | `$ {pedido.precio}` en la tarjeta | desaparece (FR-006) |
| `components/pedido/crear-pedido.tsx` | 2 avisos de reajuste + copy de "ver el precio" | desaparecen (FR-007, FR-008) |
| `components/bloque-direccion.tsx` | error que dice "ni calcular el precio" | mismo bloqueo, otro motivo (FR-002) |
| `app/page.tsx` | CTA `Ver zonas y precios` | `Ver zonas` (FR-008) |
| `app/pedido/page.tsx` | copy que promete precio al instante | reescrito (FR-008) |

**Decisión**: se tocan los once. **Alternativa descartada**: hacer solo el
formulario y el mapa, que es donde el monto se ve más grande. Deja el sitio
diciendo *"mostramos el precio al instante"* en `/pedido` y ofreciendo *"ver
zonas y precios"* en la portada — o sea, prometiendo algo que ya no existe. Un
cambio a medias acá no es un cambio parcial, es una mentira nueva.

**Lo que NO se toca y hay que decirlo**: `lib/pedido.ts` sigue calculando el
precio y emitiéndolo en `cobro`; `lib/zonas.ts` sigue teniendo el campo
`precio`; `lib/zona-lookup.ts` no cambia una línea. El dato se conserva
(FR-015).

## D2 — Dónde vive la guarda de FR-020, y por qué no puede ser una prueba de UI

`web/vitest.config.ts` corre con `environment: "node"` e
`include: ["lib/**/*.test.ts"]`. **No hay DOM y no hay pruebas de componentes en
este repo**: montar React para esto sería infraestructura nueva, y el propio
`002` decidió no testear UI.

**Decisión**: la guarda es una prueba en `web/lib/` que **lee el código fuente**
de `app/` y `components/` y afirma que ninguno renderiza un monto. Es
exactamente la técnica que ya usa `lib/cotizar-abierto.test.ts` para el grafo de
imports, así que no se inventa nada: se copia un patrón que este repo ya
sostiene.

Qué detecta, en dos planos porque uno solo se evade sin querer:

1. **El identificador, no solo el acceso.** Ningún archivo bajo `app/` ni
   `components/` puede contener el token `precio` **fuera de un comentario** —
   ni `.precio`, ni `precio` suelto, ni `formatearPrecio`. Después de este
   feature ningún componente tiene motivo para nombrarlo: quien lo calcula es
   `lib/pedido.ts` y quien lo guarda es el servicio.

   **Prohibir solo `.precio` no alcanza, y el análisis lo encontró antes de
   escribir una línea**: un helper `formatearPrecio()` puesto en `lib/` —que
   esta guarda no escanea, y no puede escanear porque ahí el precio tiene que
   seguir existiendo— y llamado desde un componente pasa los dos planos y
   devuelve el monto a la pantalla. La frontera de la guarda es el directorio,
   así que lo que se prohíbe es **nombrar la cosa del otro lado**.
2. **Texto de cara al cliente.** Ninguna cadena entre comillas en esos archivos
   puede contener `precio`, `costo`, `cuánto sale` ni un signo de peso seguido
   de un número.

**Los dos planos saltan los comentarios**, y es deliberado: un comentario que
explique por qué el precio no está es información útil, y prohibirlo empujaría a
borrar la explicación junto con el código. El costo es que hay que **eliminar
los comentarios en bloque antes de escanear** (`//…` y `/*…*/`), no basta un
`grep`.

**Control positivo obligatorio.** Una guarda que afirma que algo *no* pasa vale
lo que valga su demostración de que sabría detectarlo. La prueba incluye un caso
que le pasa al detector un fragmento con `$ {zona.precio}` y exige que lo
marque. Sin eso, la guarda queda verde el día que el escáner deje de resolver
rutas y nadie se entera. **Y antes de dar la tarea por hecha se rompe la
implementación a propósito** —se devuelve un monto a una pantalla— y se mira la
prueba en rojo.

**Alternativa descartada**: `grep` en un hook de pre-commit. No corre en CI, no
corre para quien clona el repo, y no deja rastro de por qué existe.

## D3 — `lib/repetir.ts`: qué queda cuando no hay precio que comparar

`repetir.ts` exporta `precioDeHoy()` y la lógica que decide si hubo reajuste
entre lo que se pagó y lo que costaría hoy. Con FR-007 esos dos avisos
desaparecen, y con ellos el único consumidor de la comparación.

**Decisión**: se borra la comparación de precios y `precioDeHoy` con ella, junto
con sus casos en `lib/repetir.test.ts`.

**Corregido durante la ejecución**: este párrafo decía que se conservaba en este
módulo la resolución de zona que detecta el punto fuera de cobertura. **No vive
acá.** Al sacar `precioDeHoy()` el módulo perdió su último uso de
`resolverZona()` y el import quedó sin consumidor. Lo que comprueba que un punto
fuera de las cinco zonas no produzca pedido es `validate()` en
`components/pedido-form.tsx`, sobre el punto marcado en ese momento (FR-014), y
ese camino no se toca. Lo que este módulo sí conserva es la revalidación de que
el punto guardado siga cayendo en su cuadra.

**Alternativa descartada**: dejar la función y no llamarla. Código muerto que la
próxima persona va a leer buscando quién lo usa, en un módulo cuyo comentario
de cabecera explica en detalle por qué el precio no se hereda. Borrar es más
barato que explicar por qué algo sigue ahí sin usarse — y el dato que
respaldaría reponerlo no se pierde: está en el pedido guardado.

**Esto no es refactor oportunista.** Es la mitad de FR-007: el aviso y lo que lo
calcula son la misma cosa.

## D4 — El sábado

**Decisión**: la fila pasa a `Sábados — A coordinar`. Se mantiene la estructura
de dos columnas (día / horario) porque la usan las otras dos filas y porque la
tabla se lee de un vistazo.

**Alternativa descartada**: sacar el sábado de la tabla y ponerlo como nota al
pie. Esconde el día que más gente consulta.

## D5 — Regenerar `lib/zonas.ts`, y una pregunta abierta sobre el KML

El cliente reajustó el trazado sin commitear. El cambio está localizado: **es la
Zona 5, y el polígono se achicó por el este.** Los diez vértices que salieron
llegaban hasta `-55.88` de longitud; los diez que entraron no pasan de `-55.96`.

**Decisión**: se regenera con el generador, nunca a mano —
`node design-source/build-zonas.js design-source/zonas-flash-urbano.kml lib/zonas.ts` —
y se corre la prueba existente que verifica que los cinco anillos cierren.

**Se preguntó antes de promover el plan, y quedó contestada el 2026-08-30**:
`web/design-source/README.md` dice que la definición autoritativa de los límites
es la lista de calles de
[`specs/002-mapa-zonas-precio/spec.md`](../002-mapa-zonas-precio/spec.md)
§ Límites de zona, y que si un polígono se aparta de su calle, *el defecto está
en el polígono*. Acá el polígono se movió, y había dos lecturas con trabajos
distintos: que Diego hubiera cambiado el límite (decisión de negocio, y entonces
la lista de calles quedaba vieja), o que el polígono estuviera mal dibujado.

**Respuesta de Mateo: el polígono estaba mal dibujado, y esto lo corrige hacia
las calles que ya estaban escritas.** Las calles de la Zona 5 son las mismas de
siempre. O sea que el repo **no** queda con dos definiciones contradictorias:
`specs/002` sigue siendo la autoridad y el trazado nuevo se le acerca en vez de
apartarse. **No se toca `specs/002` y no hay deuda que anotar.**

Es exactamente el caso que el README previó: cuando polígono y calle
discrepaban, el defecto estaba en el polígono. Vale dejarlo escrito porque es la
primera vez que la regla se ejerce, y confirma que el archivo generado no es la
autoridad — es una consecuencia.

## D6 — `verify:` corre solo la pata web, y hay que justificarlo

`AGENTS.md` advierte que un feature que toca varias superficies necesita
**todas** las patas en verde. Este toca **una**: `web/`. No hay migración, no
cambia el contrato HTTP, no se toca un archivo de `backend/` ni de `android/`.

**Decisión**: `verify: cd web && npm run lint && npm test && npm run build`.

**Por qué no van las otras dos**: la pata de Go no puede fallar por un cambio
que no la toca, y la de Android cuesta un `assembleDebug` completo para probar
lo mismo. Meterlas sería teatro de verificación: minutos de espera que no
aumentan la confianza en nada.

**Lo que eso deja sin cubrir, dicho de frente**: que el pedido siga llegando al
servicio con su `cobro` y se siga guardando (FR-015) **no lo prueba `verify:`**.
Lo prueba el quickstart, contra el servicio local y mirando la fila en Postgres.
Es verificación manual y hay que decirlo, no dejar que el verde la insinúe.

## D7 — La guarda de cotizar sobrevive a su propio motivo

`lib/cotizar-abierto.test.ts` existe para que se pudiera **ver el precio** con
el backend caído. Ya no hay precio que ver.

**Decisión**: la prueba se queda, con su explicación reescrita. Lo que protege
sigue siendo real y sigue importando: el formulario tiene que cargar y funcionar
—resolver direcciones, marcar el punto, decidir cobertura— sin el servicio, y
recién necesitarlo al confirmar. Su caso dinámico afirma hoy que
`resolverZona()` devuelve un precio mayor que cero; eso se puede dejar tal cual,
porque **el dato sigue existiendo** y la afirmación sigue siendo verdadera.

**Alternativa descartada**: borrarla junto con el precio visible. Sería tirar la
única guarda automática de que el formulario no depende de la red, por un cambio
de copy.
