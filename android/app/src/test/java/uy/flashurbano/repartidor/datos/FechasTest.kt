package uy.flashurbano.repartidor.datos

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * `fechaCorta` convierte lo que manda el servicio en lo que Diego lee de reojo.
 *
 * Es una funcion chica y de las que se rompen sin ruido: un `dayOfWeek` empieza
 * en lunes con valor 1 y un indice de lista empieza en 0, asi que **un error de
 * uno corre todos los dias y nadie lo nota hasta que un martes dice "lun"**.
 */
class FechasTest {

    @Test
    fun `traduce una fecha del servicio`() {
        // 2026-08-31 fue lunes.
        assertEquals("lun 31/8", fechaCorta("2026-08-31"))
    }

    @Test
    fun `los siete dias caen donde corresponde`() {
        // La guarda contra el error de uno: se recorre una semana entera y se
        // comprueba el nombre de cada dia, no solo el de uno.
        assertEquals("lun 31/8", fechaCorta("2026-08-31"))
        assertEquals("mar 1/9", fechaCorta("2026-09-01"))
        assertEquals("mié 2/9", fechaCorta("2026-09-02"))
        assertEquals("jue 3/9", fechaCorta("2026-09-03"))
        assertEquals("vie 4/9", fechaCorta("2026-09-04"))
        assertEquals("sáb 5/9", fechaCorta("2026-09-05"))
        assertEquals("dom 6/9", fechaCorta("2026-09-06"))
    }

    @Test
    fun `sin cero a la izquierda en el dia ni en el mes`() {
        // "mar 1/9" y no "mar 01/09": se lee mas rapido y ocupa menos en una
        // fila que comparte lugar con el codigo y la cantidad.
        assertEquals("mar 1/9", fechaCorta("2026-09-01"))
    }

    @Test
    fun `una fecha que no se entiende se muestra tal cual vino`() {
        // **Nunca vacio y nunca un guion.** Un dato raro tiene que verse: si el
        // servicio empieza a mandar otra cosa, que se note en la pantalla en vez
        // de desaparecer.
        assertEquals("manana", fechaCorta("manana"))
        assertEquals("", fechaCorta(""))
        assertEquals("2026-13-45", fechaCorta("2026-13-45"))
    }

    @Test
    fun `tolera espacios alrededor`() {
        assertEquals("lun 31/8", fechaCorta("  2026-08-31 "))
    }
}
