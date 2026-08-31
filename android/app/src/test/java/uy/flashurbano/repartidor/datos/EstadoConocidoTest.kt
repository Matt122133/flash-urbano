package uy.flashurbano.repartidor.datos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * FR-011: **el estado crudo se muestra solo cuando la app no lo conoce.**
 *
 * ## Por que esta prueba existe en la JVM y no en el emulador
 *
 * El quickstart pedia fabricar el caso poniendo un estado raro en la base de
 * desarrollo. **Es imposible**: `pedidos.estado` lleva
 * `CHECK (estado IN ('creacion','aceptacion','entrega'))`, asi que la base no
 * acepta otro valor sin tirarle la restriccion — y tirarla para probar una
 * pantalla es peor que no probarla. Lo encontro el analyze del 2026-08-30,
 * cuando FR-011 ya estaba decidido y **sin ninguna verificacion ejecutable**.
 *
 * Aca corre en cada `verify:`, que ademas es mejor que una vez.
 */
class EstadoConocidoTest {

    @Test
    fun `los tres estados del servicio son conocidos`() {
        assertTrue(esEstadoConocido(Estados.CREACION))
        assertTrue(esEstadoConocido(Estados.ACEPTACION))
        assertTrue(esEstadoConocido(Estados.ENTREGA))
    }

    @Test
    fun `un cuarto estado no es conocido`() {
        // El caso real que esto cubre: el servicio suma un estado —"confirmacion"
        // estuvo en el brief del cliente y quedo afuera— y sale antes que un APK
        // nuevo en el telefono de Diego.
        assertFalse(esEstadoConocido("confirmacion"))
        assertFalse(esEstadoConocido("cancelado"))
        assertFalse(esEstadoConocido(""))
    }

    @Test
    fun `no se conoce por parecido`() {
        // Sin `startsWith` ni comparaciones flojas: "entregado" NO es "entrega".
        assertFalse(esEstadoConocido("entregado"))
        assertFalse(esEstadoConocido("Entrega"))
        assertFalse(esEstadoConocido(" entrega"))
    }

    @Test
    fun `un estado desconocido sigue cayendo en pendientes`() {
        // **La decision de `012` que este feature NO cambia.** Lo unico que se
        // sabe de un estado desconocido es que no es `entrega`, o sea que puede
        // ser trabajo sin hacer. Mandarlo a Entregados lo escondería de la
        // pantalla donde se trabaja.
        assertEquals(Seccion.PENDIENTES, seccionDe("confirmacion"))
        assertEquals(Seccion.PENDIENTES, seccionDe(Estados.CREACION))
    }

    @Test
    fun `los dos criterios juntos son lo que dibuja la tarjeta`() {
        // Un desconocido cae en Pendientes Y ademas se muestra en crudo: las dos
        // cosas a la vez son FR-011. Un conocido cae donde corresponde y no se
        // muestra.
        assertTrue(seccionDe("confirmacion") == Seccion.PENDIENTES && !esEstadoConocido("confirmacion"))
        assertTrue(seccionDe(Estados.ACEPTACION) == Seccion.TOMADOS && esEstadoConocido(Estados.ACEPTACION))
    }
}
