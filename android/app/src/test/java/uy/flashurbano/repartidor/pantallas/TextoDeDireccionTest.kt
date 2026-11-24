package uy.flashurbano.repartidor.pantallas

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import uy.flashurbano.repartidor.datos.Direccion

/**
 * El orden de la direccion en la app (`032`, FR-006).
 *
 * **Las esperadas son cadenas literales**, copiadas de lo que muestra la web
 * para la misma direccion: una prueba que comparara contra otra llamada a la
 * funcion no detectaria nada.
 */
class TextoDeDireccionTest {

    private val completa = Direccion(
        calle = "Rivera", numero = "1234", apto = "3",
        esquina = "Soca", cooperativa = true,
    )

    @Test
    fun `completa se lee igual que en la web`() {
        assertEquals("Rivera 1234, apto 3, esq. Soca, cooperativa", textoDeDireccion(completa))
    }

    @Test
    fun `la linea breve de la hoja no lleva apto ni cooperativa`() {
        assertEquals("Rivera 1234, esq. Soca", textoDeDireccion(completa, breve = true))
    }

    /** Lo que Diego pidio: el numero no puede quedar pegado a la esquina. */
    @Test
    fun `el numero va antes que la esquina`() {
        for (breve in listOf(false, true)) {
            val texto = textoDeDireccion(completa, breve)
            assertTrue("dio $texto", texto.indexOf("1234") < texto.indexOf("esq."))
            assertTrue("dio $texto", texto.startsWith("Rivera 1234"))
        }
    }

    @Test
    fun `sin numero no queda un espacio colgando`() {
        val d = Direccion(calle = "Rivera", esquina = "Soca")
        assertEquals("Rivera, esq. Soca", textoDeDireccion(d))
        assertEquals("Rivera, esq. Soca", textoDeDireccion(d, breve = true))
    }

    @Test
    fun `sin esquina no queda un esq vacio`() {
        assertEquals("Rivera 1234", textoDeDireccion(Direccion(calle = "Rivera", numero = "1234")))
    }

    @Test
    fun `solo calle`() {
        assertEquals("Rivera", textoDeDireccion(Direccion(calle = "Rivera")))
    }

    @Test
    fun `campos en blanco se omiten sin dejar comas sueltas`() {
        val d = Direccion(calle = "Rivera", numero = "  ", apto = " ", esquina = "  ")
        assertEquals("Rivera", textoDeDireccion(d))
    }

    @Test
    fun `apto sin numero ni esquina`() {
        val d = Direccion(calle = "Rivera", apto = "3")
        assertEquals("Rivera, apto 3", textoDeDireccion(d))
    }
}
