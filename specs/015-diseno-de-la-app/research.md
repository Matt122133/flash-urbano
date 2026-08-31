# Research — `015` La app para la calle

Fase 0. Siete decisiones con su alternativa descartada.

## D1 — Las pestañas sin traer una biblioteca de navegación

`012` decidió no usar ninguna: *"Sin biblioteca de navegacion: son tres pantallas
y una de ellas se ve una vez"*, y resolvió con un `var viendoEntregados by
remember` más un `BackHandler`. Ese modelo es justo el que este feature retira.

**Decisión**: se reemplaza por una sección seleccionada en el estado —las tres
que `Seccion` ya declara— y una `NavigationBar` de Material 3. **No entra
`androidx.navigation`.**

**Por qué**: las tres listas son hermanas, comparten el mismo `ViewModel` y los
mismos datos ya cargados. Un grafo de navegación aportaría rutas, argumentos y
un back stack para algo que es elegir cuál de tres listas se dibuja. Es
Principio III, literal.

**Y hay una consecuencia de comportamiento que hay que decidir, no heredar**: con
`BackHandler`, "atrás" volvía de Entregados a la principal. Con pestañas
hermanas, **atrás sale de la app** desde cualquiera de las tres, que es lo que
hace una barra de navegación en Android. Es el comportamiento estándar y se
adopta a propósito.

**Alternativa descartada**: `androidx.navigation.compose`. Una dependencia y un
grafo para tres hermanas que ya comparten estado.

## D2 — El tema: de dónde sale el color, y qué NO se hace

Hoy no existe ningún archivo de tema en `android/`: la app toma el morado por
defecto de Material 3. La paleta de marca vive en `web/app/globals.css` — azul
`#1d4ed8`, oscuro `#1e3a8a`, naranja `#f97316`.

**Decisión**: un esquema de color de marca, **solo claro**, escrito a mano desde
esos tres valores.

**Por qué solo claro**: esta app se usa afuera, de día. Un esquema oscuro es el
doble de superficie para equivocarse en contraste, y ninguna de las dos personas
que la van a mirar la usa de noche. Si algún día hace falta, se agrega.

**Alternativa descartada, y es la que más tienta**: color dinámico (Material
You), que es el camino por defecto de Material 3 en Android 12+. Toma los colores
**del fondo de pantalla del teléfono**. O sea que la app de Diego se vería del
color de su wallpaper y **la marca desaparecería otra vez**, que es exactamente
el defecto que este feature viene a arreglar. Se desactiva explícitamente.

## D3 — La tarjeta: de dónde salen los 130 px

Hoy son ~380 px. Cada dato es una pila de dos líneas —rótulo arriba, valor
abajo— y hay siete pilas.

**Decisión**, y el desglose es el argumento:

| Qué | Hoy | Después |
|---|---|---|
| `tamaño x cantidad` | una línea | solo la cantidad, en la fila del código |
| `Retira en` + valor | dos líneas | una fila con flecha naranja |
| `Lleva a` + valor | dos líneas | una fila con flecha azul |
| `Envía` + nombre + teléfono | tres líneas | medio botón de 48 dp |
| `Recibe` + nombre + teléfono | tres líneas | el otro medio botón |
| `Retiro <fecha> <hora>` | una línea | la fecha, en la fila del código |
| `Estado: <crudo>` | una línea siempre | solo si no coincide (FR-011) |

**Nada se esconde detrás de un toque** — el contrato 4.2 de `012` sigue en pie.
Lo que cambia es la densidad, no lo que se ve.

**Alternativa descartada**: tarjeta plegable con lo secundario adentro. Habría
dado más de 130 px y es la solución obvia. Se descarta porque contradice una
decisión escrita y bien argumentada: Diego no puede tener que tocar para leer una
dirección parado en una puerta.

## D4 — El contraste se mide, no se opina

SC-005 dice que todo texto pasa el mínimo de accesibilidad. Es el tipo de
criterio que se tilda mirando y se rompe seis meses después.

**Decisión**: **una prueba de JVM que calcula el contraste** de cada par
color-de-texto/fondo del tema y falla por debajo de 4.5:1 (3:1 para texto
grande). Son valores fijos y conocidos: es aritmética sobre hex, no necesita
emulador ni DOM.

**Con su control positivo**, como manda la casa: un par que se sabe malo —gris
claro sobre blanco— tiene que hacer saltar al detector. Sin eso, la prueba pasa
igual el día que devuelva siempre cero.

**Lo que esta prueba NO cubre, y hay que decirlo**: que esos colores sean los que
la pantalla realmente usa. Prueba la paleta, no el dibujo. Que el texto sobre el
botón azul sea blanco y no gris lo comprueba el emulador.

## D5 — Los 48 dp: lo que se puede automatizar y lo que no

**Decisión**: los tamaños de toque salen de constantes con nombre, y una prueba
de JVM afirma que ninguna baja de 48 dp.

**Y el límite, dicho de frente**: esa prueba comprueba **las constantes, no su
uso**. Nadie impide escribir un `Modifier.size(32.dp)` a mano al lado. Medir de
verdad necesita pruebas de interfaz sobre un emulador —instrumentadas— y este
plan no las trae: sería infraestructura nueva para un feature de una pantalla.
Queda como comprobación del quickstart.

**Alternativa descartada**: traer `androidx.compose.ui.test` con pruebas
instrumentadas. Es lo correcto a largo plazo y es desproporcionado hoy; si la app
crece, entra por su propio feature. Va al tracker.

## D6 — Deshacer, ahora que el pedido cambia de pestaña

`012` ya tiene deshacer. Lo que cambia es que ahora mover un pedido **lo saca de
la lista que estás mirando**: tocás "Lo tengo" en Pendientes y desaparece de ahí.

**Decisión**: el aviso con Deshacer aparece **sobre la pestaña donde estás**, no
sigue al pedido. Diego se queda en Pendientes trabajando; si se equivocó,
deshace desde donde está.

**Por qué importa**: la alternativa —saltar a En curso al mover— parece útil y es
peor. Diego está parado en una puerta procesando pendientes; moverle la pantalla
debajo del dedo es la forma más rápida de que toque lo que no quería.

## D7 — `verify:` corre la pata de Android, y sola

Este feature toca **una** superficie: `android/`. No hay migración, no cambia el
contrato HTTP, no se toca `web/` ni `backend/`.

**Decisión**:
`verify: cd android && .\gradlew.bat assembleDebug testDebugUnitTest`

**La barra invertida no es un detalle de estilo.** `AGENTS.md` lo tiene escrito:
`verify:` corre en `cmd.exe`, donde `./` es inválido; y un `cmd` lanzado desde
una shell tipo MSYS hereda `NoDefaultCurrentDirectoryInExePath`, así que el
nombre pelado tampoco resuelve. `.\` funciona en los dos.

**Y lo que ese verde NO dice, que en este feature es casi todo.** `012` compiló
en las tres superficies y entregó un botón con el texto cortado, un título
pegado a la barra de estado, un error de OkHttp en inglés en la cara del usuario
y un APK sin firmar. **Este feature es enteramente visual**: la compilación
prueba que existe, el emulador prueba que sirve, y el teléfono de Diego prueba
que acertamos. Los tres niveles están en el quickstart y ninguno se saltea.
