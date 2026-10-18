package uy.flashurbano.repartidor.pantallas

import uy.flashurbano.repartidor.datos.Roles
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import uy.flashurbano.repartidor.datos.Direccion
import uy.flashurbano.repartidor.datos.Estados
import uy.flashurbano.repartidor.datos.Motivo
import uy.flashurbano.repartidor.datos.Pedido
import uy.flashurbano.repartidor.datos.Resultado

/**
 * Los estados que NO son una lista (contrato seccion 5).
 *
 * Es lo unico de la interfaz que se puede probar sin dispositivo, y es donde
 * esta la regla que mas caro sale romper: **una falla nunca se dibuja como una
 * lista vacia**, porque eso le dice a Diego que no tiene trabajo.
 */
class EstadoPantallaTest {

    private fun pedido(codigo: String, estado: String) = Pedido(
        id = codigo, codigo = codigo, estado = estado,
        retiro = Direccion(calle = "18 de Julio", esquina = "Ejido"),
        entrega = Direccion(calle = "Rivera", esquina = "Propios"),
    )

    @Test
    fun `sin senal no se dibuja una lista vacia`() {
        val e = estadoDesde(Resultado.Fallo(Motivo.SIN_RED, "timeout"))

        assertTrue("dio $e", e is EstadoPantalla.NoSePudo)
        assertEquals(Motivo.SIN_RED, (e as EstadoPantalla.NoSePudo).motivo)
    }

    /**
     * **El control positivo del de arriba.** Sin este, una implementacion que
     * devolviera NoSePudo siempre pasaria igual: hay que demostrar que el caso
     * "de verdad no hay nada" se distingue.
     */
    @Test
    fun `sin pedidos de verdad es otra cosa distinta`() {
        val e = estadoDesde(Resultado.Ok(emptyList()))

        assertEquals(EstadoPantalla.Vacia, e)
    }

    @Test
    fun `una sesion vencida manda al ingreso y no a un cartel de error`() {
        val e = estadoDesde(Resultado.Fallo(Motivo.SESION_VENCIDA))

        assertEquals(EstadoPantalla.HayQueIngresar, e)
    }

    /**
     * Un 403 —el mail que no esta en `ADMIN_EMAILS`— NO manda al ingreso.
     * Reingresar no lo arregla, y hacerlo dar vueltas por la pantalla de
     * ingreso esconde cual es el problema real.
     */
    @Test
    fun `un fallo del servicio no manda al ingreso`() {
        val e = estadoDesde(Resultado.Fallo(Motivo.DEL_SERVICIO, "sin permiso"))

        assertTrue("dio $e", e is EstadoPantalla.NoSePudo)
    }

    @Test
    fun `los pedidos caen en las dos secciones de trabajo y los entregados aparte`() {
        val e = estadoDesde(
            Resultado.Ok(
                listOf(
                    pedido("FU-0001", Estados.CREACION),
                    pedido("FU-0002", Estados.ACEPTACION),
                    pedido("FU-0003", Estados.ENTREGA),
                    pedido("FU-0004", Estados.CREACION),
                )
            )
        ) as EstadoPantalla.Hay

        assertEquals(listOf("FU-0001", "FU-0004"), e.pendientes.map { it.codigo })
        assertEquals(listOf("FU-0002"), e.tomados.map { it.codigo })
        assertEquals(listOf("FU-0003"), e.entregados.map { it.codigo })
    }

    @Test
    fun `un estado desconocido no desaparece de la pantalla`() {
        val e = estadoDesde(Resultado.Ok(listOf(pedido("FU-0009", "en_camino")))) as EstadoPantalla.Hay

        assertEquals(listOf("FU-0009"), e.pendientes.map { it.codigo })
    }

    /**
     * El orden dentro de cada seccion es **el que mando el servicio**. La app no
     * elige un orden de visita: eso lo prohibe el contrato seccion 6 y es el
     * feature que todavia no existe.
     */
    @Test
    fun `la app no reordena los pedidos`() {
        val e = estadoDesde(
            Resultado.Ok(
                listOf(
                    pedido("FU-0300", Estados.CREACION),
                    pedido("FU-0100", Estados.CREACION),
                    pedido("FU-0200", Estados.CREACION),
                )
            )
        ) as EstadoPantalla.Hay

        assertEquals(listOf("FU-0300", "FU-0100", "FU-0200"), e.pendientes.map { it.codigo })
    }

    // ------------------------------------------------------------------ 031

    private fun de(codigo: String, responsable: String?) =
        pedido(codigo, Estados.CREACION).copy(responsable = responsable)

    /**
     * **SC-002**: para el administrador, cada pedido esta en exactamente una de
     * dos vistas, "Mios" o la de su repartidor. Ninguno se pierde y ninguno
     * aparece dos veces.
     */
    @Test
    fun `cada pedido cae en Mios o en la vista de su repartidor, y en una sola`() {
        val todos = listOf(de("A", null), de("B", "rita@example.com"), de("C", "raul@example.com"), de("D", null))

        val mios = visibles(todos, Roles.ADMIN, Filtro.MIOS).map { it.codigo }.toSet()
        val porRepartidor = todos.mapNotNull { it.responsable }.toSet().associateWith { rep ->
            visibles(todos, Roles.ADMIN, Filtro.TODOS).filter { it.responsable == rep }.map { it.codigo }.toSet()
        }

        assertEquals(setOf("A", "D"), mios)
        val vistas = listOf(mios) + porRepartidor.values
        for (p in todos) {
            assertEquals("${p.codigo} esta en mas o menos de una vista", 1, vistas.count { p.codigo in it })
        }
    }

    @Test
    fun `Todos del administrador muestra todo`() {
        val todos = listOf(de("A", null), de("B", "rita@example.com"))
        assertEquals(todos, visibles(todos, Roles.ADMIN, Filtro.TODOS))
    }

    /** Lo que un repartidor acaba de devolver se va de su pantalla en el acto. */
    @Test
    fun `al repartidor no le queda lo que devolvio`() {
        val suyos = listOf(de("B", "rita@example.com"), de("E", null))
        assertEquals(listOf("B"), visibles(suyos, Roles.REPARTIDOR, Filtro.MIOS).map { it.codigo })
        // El filtro del administrador no le cambia nada al repartidor.
        assertEquals(listOf("B"), visibles(suyos, Roles.REPARTIDOR, Filtro.TODOS).map { it.codigo })
    }
}
