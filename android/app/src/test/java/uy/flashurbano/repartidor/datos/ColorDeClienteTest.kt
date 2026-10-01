package uy.flashurbano.repartidor.datos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * `colorDeCliente` decide si la tarjeta lleva franja (030). Lo que importa es
 * la mitad del "no": un valor raro tiene que dar `null` y nunca tirar, porque
 * esa funcion corre por cada tarjeta de la lista.
 */
class ColorDeClienteTest {

    @Test
    fun `un hex valido da el color opaco`() {
        assertEquals(0xFFC026D3, colorDeCliente("#c026d3"))
    }

    @Test
    fun `mayusculas y minusculas dan el mismo color`() {
        assertEquals(colorDeCliente("#c026d3"), colorDeCliente("#C026D3"))
    }

    @Test
    fun `lo que no es un color da null`() {
        for (malo in listOf(null, "", "c026d3", "#c026d", "#c026d3ff", "#zzzzzz", " #c026d3", "#c026d3 ")) {
            assertNull("\"$malo\" no deberia ser un color", colorDeCliente(malo))
        }
    }
}
