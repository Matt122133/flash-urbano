package uy.flashurbano.repartidor.pantallas

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import uy.flashurbano.repartidor.datos.AvisosEnVivo
import uy.flashurbano.repartidor.datos.textoDePedidosNuevos

/**
 * US2: que el silencio se note.
 *
 * Es la decision, separada del dibujo. Lo que **no** se puede probar aca es que
 * el renglon se vea bien; eso es el emulador, y el quickstart lo pide (Q7).
 */
class EstadoDeAvisosTest {

    @Test
    fun `con permiso y notificaciones prendidas no hay nada que decir`() {
        assertEquals(
            LleganLosAvisos.SI,
            lleganLosAvisos(permisoConcedido = true, habilitadasEnElSistema = true),
        )
        assertEquals("", textoDeAvisosMudos(LleganLosAvisos.SI))
    }

    /**
     * **El orden de las dos preguntas es el punto de esta prueba.**
     *
     * Desde Android 13 negar el permiso tambien deja las notificaciones
     * apagadas, asi que los dos booleanos vienen en falso a la vez. Si se
     * preguntara primero por el sistema, este caso se reportaria como "andá a
     * los ajustes a prenderlas" — el consejo equivocado, y el que deja a Diego
     * dando vueltas por una pantalla donde no esta lo que busca.
     */
    @Test
    fun `el permiso negado se reporta como permiso y no como ajustes`() {
        assertEquals(
            LleganLosAvisos.PERMISO_NEGADO,
            lleganLosAvisos(permisoConcedido = false, habilitadasEnElSistema = false),
        )
        assertTrue(textoDeAvisosMudos(LleganLosAvisos.PERMISO_NEGADO).contains("permiso"))
    }

    @Test
    fun `con permiso pero apagadas en el sistema se manda a los ajustes`() {
        assertEquals(
            LleganLosAvisos.APAGADAS_EN_EL_SISTEMA,
            lleganLosAvisos(permisoConcedido = true, habilitadasEnElSistema = false),
        )
        assertTrue(textoDeAvisosMudos(LleganLosAvisos.APAGADAS_EN_EL_SISTEMA).contains("ajustes"))
    }

    /**
     * Los dos mensajes tienen que ser **distintos**.
     *
     * Sin esto, alguien puede unificar el texto "para simplificar" y el enum
     * queda como una distincion que no distingue nada — que es peor que no
     * tenerla, porque parece que si.
     */
    @Test
    fun `cada motivo dice algo distinto`() {
        assertTrue(
            textoDeAvisosMudos(LleganLosAvisos.PERMISO_NEGADO) !=
                textoDeAvisosMudos(LleganLosAvisos.APAGADAS_EN_EL_SISTEMA),
        )
    }
}

/**
 * US1, la mitad que corre con la app abierta: **la lista no se mueve sola**.
 */
class AvisosEnVivoTest {

    @Test
    fun `los avisos se acumulan y se limpian al mirarlos`() {
        AvisosEnVivo.vistos()
        assertEquals(0, AvisosEnVivo.nuevos.value)

        AvisosEnVivo.llego()
        AvisosEnVivo.llego()
        assertEquals(2, AvisosEnVivo.nuevos.value)

        AvisosEnVivo.vistos()
        assertEquals(0, AvisosEnVivo.nuevos.value)
    }

    /**
     * **Sin avisos el renglon no existe**, y no es lo mismo que existir vacio:
     * un renglon en blanco ocupa alto y empuja la lista hacia abajo, que es
     * justo lo que `015` estuvo sacando de esta pantalla.
     */
    @Test
    fun `sin pedidos nuevos no hay renglon`() {
        assertEquals("", textoDePedidosNuevos(0))
        assertEquals("", textoDePedidosNuevos(-1))
    }

    /**
     * Singular y plural.
     *
     * Parece cosmetico y es lo primero que Diego va a leer a las siete de la
     * manana con el telefono en una mano.
     */
    @Test
    fun `uno y varios se dicen distinto`() {
        assertEquals("1 pedido nuevo — tocá para actualizar", textoDePedidosNuevos(1))
        assertEquals("3 pedidos nuevos — tocá para actualizar", textoDePedidosNuevos(3))
    }
}
