package uy.flashurbano.repartidor.ui.tema

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Los tamanos de lo que se toca.
 *
 * Existen como constantes con nombre por una sola razon: **asi se pueden
 * medir**. Un `48.dp` escrito suelto en una pantalla es una intencion; esto es
 * un valor que una prueba puede leer y rechazar.
 *
 * El piso son 48 dp, que es lo que recomienda Android para cualquier objetivo
 * tactil. Aca no es una recomendacion: esta app se usa **con una mano, al sol,
 * con la otra ocupada por un paquete**, y a veces con guantes.
 *
 * **Lo que estas constantes NO garantizan** esta escrito en `ToquesTest`: que
 * las pantallas efectivamente las usen. Nada impide un `Modifier.size(32.dp)`
 * al lado. Eso lo caza el emulador, quickstart Q5.
 */
object Toques {
    /** El piso de todo lo que se toca. */
    val MINIMO: Dp = 48.dp

    /** Un destino de la barra inferior: icono, etiqueta y aire. */
    val DESTINO: Dp = 56.dp

    /** La accion que mueve un pedido, en el borde inferior de la tarjeta. */
    val ACCION: Dp = 52.dp

    /** Cada uno de los dos botones de telefono. */
    val TELEFONO: Dp = 48.dp

    /** El boton de actualizar, arriba a la derecha. */
    val ACTUALIZAR: Dp = 48.dp
}
