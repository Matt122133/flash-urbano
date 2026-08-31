package uy.flashurbano.repartidor.ui.tema

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.pow

/**
 * FR-008 y SC-005: **todo texto se tiene que poder leer**.
 *
 * Diego usa esta app parado en la calle, de dia, a veces con el sol de frente.
 * "Se lee bien" es de esas afirmaciones que se tildan mirando la pantalla en un
 * escritorio y se rompen seis meses despues, cuando alguien aclara un gris para
 * que "quede mas prolijo".
 *
 * Aca no se mira: **se calcula**. La razon de contraste de la norma WCAG es
 * aritmetica sobre los valores del color, asi que no hace falta ni emulador ni
 * pantalla — corre en la JVM, en cada `verify:`.
 *
 * ## El limite, dicho de frente
 *
 * **Esto prueba la PALETA, no el dibujo.** Afirma que los pares declarados en
 * `PARES_DE_TEXTO` se pueden leer; no puede saber si una pantalla dibuja texto
 * suave sobre el naranja, o si alguien inventa un color a mano en un
 * `Modifier`. Esa mitad la cubre el emulador (quickstart Q6), y no hay forma
 * barata de automatizarla sin pruebas instrumentadas — anotado en el tracker.
 */
class ContrasteTest {

    // --- La norma, en tres funciones -------------------------------------

    /** Un canal de 0..255 a lineal, como pide WCAG 2.x. */
    private fun canalLineal(valor: Int): Double {
        val c = valor / 255.0
        return if (c <= 0.03928) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
    }

    /** Luminancia relativa de un color `0xAARRGGBB`. */
    private fun luminancia(color: Long): Double {
        val r = canalLineal(((color shr 16) and 0xFF).toInt())
        val g = canalLineal(((color shr 8) and 0xFF).toInt())
        val b = canalLineal((color and 0xFF).toInt())
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    /** La razon de contraste entre dos colores. Va de 1.0 a 21.0. */
    private fun contraste(uno: Long, otro: Long): Double {
        val a = luminancia(uno)
        val b = luminancia(otro)
        val claro = maxOf(a, b)
        val oscuro = minOf(a, b)
        return (claro + 0.05) / (oscuro + 0.05)
    }

    // --- Lo que se exige --------------------------------------------------

    @Test
    fun `todos los pares del tema se pueden leer`() {
        val fallados = PARES_DE_TEXTO.mapNotNull { par ->
            val minimo = if (par.textoGrande) 3.0 else 4.5
            val medido = contraste(par.texto, par.fondo)
            if (medido < minimo) {
                "%s: %.2f:1, hace falta %.1f:1".format(par.nombre, medido, minimo)
            } else {
                null
            }
        }

        assertTrue(
            "Estos pares del tema no se leen:\n" + fallados.joinToString("\n") +
                "\n\nNo es un detalle de gusto: esta app se usa al sol. " +
                "Si el color tiene que ser ese, cambia el OTRO lado del par.",
            fallados.isEmpty(),
        )
    }

    // --- Los controles positivos ------------------------------------------
    //
    // Una prueba que afirma que algo NO pasa vale lo que valga su demostracion
    // de que sabria detectarlo. Sin esto, el dia que `contraste()` devuelva
    // siempre 21.0 la suite queda verde para siempre y nadie se entera.

    @Test
    fun `el detector reprueba un par que se sabe ilegible`() {
        // Gris claro sobre blanco: el clasico "queda mas prolijo" que no se lee.
        val medido = contraste(0xFFCCCCCC, 0xFFFFFFFF)
        assertTrue("gris claro sobre blanco deberia reprobar, dio $medido", medido < 4.5)
    }

    @Test
    fun `el detector reprueba el blanco sobre el naranja de marca`() {
        // **Este caso no es hipotetico: es el que corrigio la maqueta.**
        // El primer dibujo del badge tenia el numero en blanco sobre el naranja,
        // que es lo que sale por reflejo sobre un color fuerte. Da 2.80:1 — ni
        // siquiera llega al minimo de texto grande.
        val medido = contraste(Paleta.BLANCO, Paleta.NARANJA)
        assertTrue("blanco sobre naranja deberia reprobar, dio $medido", medido < 4.5)
    }

    @Test
    fun `el detector aprueba un par que se sabe legible`() {
        // La otra mitad: que no repruebe todo. Negro sobre blanco es el maximo.
        val medido = contraste(0xFF000000, 0xFFFFFFFF)
        assertEquals(21.0, medido, 0.05)
    }

    @Test
    fun `la luminancia respeta los dos extremos conocidos`() {
        // Guarda contra que la formula devuelva cualquier cosa: el negro es 0 y
        // el blanco es 1, y eso no depende de ninguna interpretacion.
        assertEquals(0.0, luminancia(0xFF000000), 0.0001)
        assertEquals(1.0, luminancia(0xFFFFFFFF), 0.0001)
    }

    @Test
    fun `hay pares que mirar`() {
        // Si la lista se vacia, el caso principal pasa sin comprobar nada.
        assertTrue("PARES_DE_TEXTO quedo vacia", PARES_DE_TEXTO.size >= 8)
    }
}
