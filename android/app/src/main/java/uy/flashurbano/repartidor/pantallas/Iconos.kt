package uy.flashurbano.repartidor.pantallas

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * Los tres iconos de la barra de destinos, dibujados a mano.
 *
 * **Sin `material-icons-extended`**, que es la forma facil y trae un catalogo
 * entero para usar tres. Es la misma decision que research D1 tomo con la
 * navegacion: no se agrega una dependencia para algo que se resuelve con lo que
 * ya esta. `PathParser` es parte de `compose-ui-graphics`, que la app ya usa.
 *
 * El trazo va en negro a proposito: `Icon` pinta el vector entero con su
 * `tint`, asi que el color lo pone quien lo dibuja segun este seleccionado o no.
 */
private fun trazo(nombre: String, comandos: String): ImageVector =
    ImageVector.Builder(
        name = nombre,
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).addPath(
        pathData = PathParser().parsePathString(comandos).toNodes(),
        stroke = SolidColor(Color.Black),
        strokeLineWidth = 2f,
        strokeLineCap = StrokeCap.Round,
        strokeLineJoin = StrokeJoin.Round,
    ).build()

/**
 * PENDIENTES: una caja.
 *
 * **No un signo de pregunta**, que fue la primera idea: en Android el `?`
 * significa *ayuda*, y se lee asi al pasar. Una caja es lo que hay adentro de la
 * pestaña.
 */
val IconoPendientes: ImageVector = trazo(
    "pendientes",
    "M22 12h-6l-2 3h-4l-2-3H2 " +
        "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89" +
        "A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
)

/** EN CURSO: el camino, con su punto de salida y su punto de llegada. */
val IconoEnCurso: ImageVector = trazo(
    "en-curso",
    "M9 19h4a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4H9 " +
        "M6 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6z " +
        "M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
)

/** ENTREGADOS: la bandera a cuadros de meta. */
val IconoEntregados: ImageVector = trazo(
    "entregados",
    "M4 22V3 " +
        "M4 4h16v9H4z " +
        "M4 8.5h16 " +
        "M9.3 4v9 " +
        "M14.6 4v9",
)

/**
 * La flecha de RETIRA: sube, porque el paquete sale de ahi.
 *
 * Reemplaza al rotulo "Retira en" de `012`. Un rotulo son dos lineas —titulo y
 * valor— y hay que leerlo; una flecha ocupa el ancho de un icono al costado del
 * texto y se entiende sin leer. Ahi salen 36 de los 130 px que la tarjeta bajo.
 */
val IconoSale: ImageVector = trazo("sale", "M12 19V5 M5 12l7-7 7 7")

/** La flecha de ENTREGA: baja, porque el paquete llega ahi. */
val IconoLlega: ImageVector = trazo("llega", "M12 5v14 M19 12l-7 7-7-7")

/** El telefono de los dos botones de llamada. */
val IconoTelefono: ImageVector = trazo(
    "telefono",
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 " +
    "19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3" +
    "a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91" +
    "a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7" +
    "A2 2 0 0 1 22 16.92z",
)
