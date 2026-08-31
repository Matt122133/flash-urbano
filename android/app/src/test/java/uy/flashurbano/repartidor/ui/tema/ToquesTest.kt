package uy.flashurbano.repartidor.ui.tema

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * FR-007 y SC-004: **nada de lo que se toca baja de 48 dp**.
 *
 * ## Lo que esta prueba NO hace, y hay que leerlo antes de confiar en ella
 *
 * Comprueba **las constantes, no su uso**. Nada impide escribir
 * `Modifier.size(32.dp)` a mano en una pantalla, al lado de estas: esta prueba
 * quedaria verde igual.
 *
 * Medir de verdad necesita pruebas instrumentadas sobre un emulador, y este
 * plan decidio no traerlas (research D5): seria infraestructura nueva para una
 * app de cuatro pantallas. Queda anotado en el tracker con su disparador.
 *
 * **Entonces, ¿para que sirve?** Para que el piso sea un valor con nombre y no
 * un numero suelto, y para que bajarlo tenga que ser una decision explicita que
 * pone una prueba en rojo — en vez de un `40.dp` que entra en un diff sin que
 * nadie lo discuta. Lo otro —que las pantallas las usen— lo comprueba el pulgar
 * de una persona en el emulador, quickstart Q5.
 */
class ToquesTest {

    private val todos = listOf(
        "MINIMO" to Toques.MINIMO,
        "DESTINO" to Toques.DESTINO,
        "ACCION" to Toques.ACCION,
        "TELEFONO" to Toques.TELEFONO,
        "ACTUALIZAR" to Toques.ACTUALIZAR,
    )

    @Test
    fun `ninguna medida de toque baja de 48 dp`() {
        val chicas = todos.filter { (_, medida) -> medida < 48.dp }
            .map { (nombre, medida) -> "$nombre = $medida" }

        assertTrue(
            "Estas medidas quedaron por debajo del piso:\n" +
                chicas.joinToString("\n") +
                "\n\n48 dp no es una recomendacion aca: la app se usa con una " +
                "mano, con la otra ocupada, y a veces con guantes.",
            chicas.isEmpty(),
        )
    }

    @Test
    fun `el piso declarado es 48 dp y no otra cosa`() {
        // Sin esto, alguien podria bajar `MINIMO` a 32.dp y el caso de arriba
        // seguiria verde: se compara contra el literal, no contra la constante.
        assertTrue("Toques.MINIMO dejo de ser 48 dp", Toques.MINIMO == 48.dp)
    }

    @Test
    fun `el detector encuentra una medida chica cuando la hay`() {
        // El control positivo: se le da una lista con una medida mala y se
        // comprueba que el mismo criterio la marca. Sin esto, el caso principal
        // pasa igual el dia que `todos` quede vacia o la comparacion se invierta.
        val conUnaMala = listOf("INVENTADA" to 32.dp)
        val chicas = conUnaMala.filter { (_, medida) -> medida < 48.dp }
        assertTrue("el criterio no marco una medida de 32 dp", chicas.size == 1)
    }

    @Test
    fun `hay medidas que mirar`() {
        assertTrue("la lista de medidas quedo vacia", todos.size >= 5)
    }
}
