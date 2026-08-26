package uy.flashurbano.repartidor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Research D5: la URL sale del tipo de compilacion, no de una constante suelta.
 *
 * Las pruebas de JVM corren contra `debug`, asi que esto fija la mitad que se
 * puede fijar desde aca: que `debug` apunte al backend local via el alias del
 * emulador. La otra mitad —que `release` apunte a produccion y NO lleve la
 * excepcion de texto plano— se comprueba sobre el APK compilado en T036, porque
 * es donde de verdad se colaria.
 */
class BaseUrlTest {
    @Test
    fun `debug apunta al backend local por el alias del emulador`() {
        assertEquals("http://10.0.2.2:8080", BuildConfig.BASE_URL)
    }

    @Test
    fun `debug es el tipo de compilacion bajo prueba`() {
        assertTrue(BuildConfig.DEBUG)
    }
}
