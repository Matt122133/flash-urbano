package uy.flashurbano.repartidor.datos

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * El cliente contra un servidor de verdad en JVM.
 *
 * Lo que se prueba aca es **la traduccion de los fallos**, que es el trabajo
 * real de esta capa: en la calle no hay senal como caso normal, y una excepcion
 * que suba a la pantalla le saca la lista a Diego en el peor momento.
 */
class ServicioTest {

    private lateinit var servidor: MockWebServer
    private lateinit var servicio: Servicio

    @Before
    fun levantar() {
        servidor = MockWebServer()
        servidor.start()
        servicio = Servicio(baseUrl = servidor.url("/").toString().trimEnd('/'))
    }

    @After
    fun bajar() {
        servidor.shutdown()
    }

    private val unaLista = """
        {"pedidos":[{"id":"1","codigo":"FU-0001","estado":"creacion",
        "retiro":{"calle":"18 de Julio","esquina":"Ejido"},
        "entrega":{"calle":"Rivera","esquina":"Propios"}}]}
    """.trimIndent()

    @Test
    fun `una lista buena vuelve como Ok`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody(unaLista))

        val r = servicio.pedidos("cred")
        assertTrue("dio $r", r is Resultado.Ok)
        assertEquals("FU-0001", (r as Resultado.Ok).valor.single().codigo)
    }

    /**
     * **La credencial VIAJA.** El contrato prohibe leer pedidos sin credencial
     * por cualquier via (seccion 6); del lado del servicio ya hay una prueba, y
     * esta es la mitad del cliente.
     */
    @Test
    fun `la credencial va en la cabecera`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody(unaLista))

        servicio.pedidos("la-credencial")

        val recibida = servidor.takeRequest()
        assertEquals("Bearer la-credencial", recibida.getHeader("Authorization"))
        assertEquals("/admin/pedidos", recibida.path)
    }

    @Test
    fun `un 401 es sesion vencida y manda al ingreso`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"credencial invalida"}"""))

        val r = servicio.pedidos("vencida")
        assertEquals(Motivo.SESION_VENCIDA, (r as Resultado.Fallo).motivo)
    }

    /**
     * Un 403 NO es sesion vencida, y distinguirlo importa: significa que el mail
     * no esta en `ADMIN_EMAILS`, y reingresar mil veces no lo arregla. Es
     * exactamente el caso de Diego el primer dia si nadie agrego su direccion.
     */
    @Test
    fun `un 403 no manda a reingresar`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"no autorizado"}"""))

        val r = servicio.pedidos("cred") as Resultado.Fallo
        assertEquals(Motivo.DEL_SERVICIO, r.motivo)
        assertTrue("el detalle no explica nada: ${r.detalle}", r.detalle.contains("permiso"))
    }

    @Test
    fun `un 500 es del servicio y trae su mensaje`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(500).setBody("""{"error":"algo se rompio"}"""))

        val r = servicio.pedidos("cred") as Resultado.Fallo
        assertEquals(Motivo.DEL_SERVICIO, r.motivo)
        assertEquals("algo se rompio", r.detalle)
    }

    /**
     * **Sin servicio del otro lado no se lanza nada.** Es el caso de todos los
     * dias: el subsuelo de un edificio, el ascensor, la zona sin cobertura.
     */
    @Test
    fun `sin servicio del otro lado es SIN_RED y no una excepcion`() = runTest {
        servidor.shutdown()

        val r = servicio.pedidos("cred")
        assertEquals(Motivo.SIN_RED, (r as Resultado.Fallo).motivo)
    }

    /**
     * Un 200 con un cuerpo ilegible es un DEFECTO, no una falla de red. Decir
     * "sin senal" mandaria a buscar el problema al lugar equivocado.
     */
    @Test
    fun `un 200 ilegible no se confunde con falta de senal`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("esto no es json"))

        val r = servicio.pedidos("cred") as Resultado.Fallo
        assertEquals(Motivo.DEL_SERVICIO, r.motivo)
        assertTrue("el detalle no dice que paso: ${r.detalle}", r.detalle.contains("ilegible"))
    }

    @Test
    fun `el ingreso pide el codigo y despues lo canjea`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(204))
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("""{"credencial":"la-cred","expiraEn":"2026-09-23T00:00:00Z"}"""))

        assertTrue(servicio.pedirCodigo("diego@ejemplo.uy") is Resultado.Ok)
        val pedido = servidor.takeRequest()
        assertEquals("/auth/codigo", pedido.path)
        assertTrue(pedido.body.readUtf8().contains("diego@ejemplo.uy"))

        val r = servicio.verificarCodigo("diego@ejemplo.uy", "123456")
        assertEquals("la-cred", (r as Resultado.Ok).valor)
        assertEquals("/auth/codigo/verificar", servidor.takeRequest().path)
    }

    /** Un codigo equivocado es del servicio, no falta de senal. */
    @Test
    fun `un codigo equivocado no se lee como sin senal`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(400).setBody("""{"error":"codigo invalido"}"""))

        val r = servicio.verificarCodigo("diego@ejemplo.uy", "000000") as Resultado.Fallo
        assertEquals(Motivo.DEL_SERVICIO, r.motivo)
        assertEquals("codigo invalido", r.detalle)
    }
    // ----------------------------------------------------- PATCH .../estado

    private val unPedido = """
        {"pedido":{"id":"1","codigo":"FU-0001","estado":"aceptacion",
        "retiro":{"calle":"18 de Julio","esquina":"Ejido"},
        "entrega":{"calle":"Rivera","esquina":"Propios"}}}
    """.trimIndent()

    /**
     * **Manda el estado DESTINO, no una transicion** (contrato seccion 1). Es lo
     * que hace que tocar dos veces sea inofensivo sin que la app lleve la cuenta
     * de donde venia.
     */
    @Test
    fun `mover manda el estado destino con PATCH y credencial`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody(unPedido))

        val r = servicio.cambiarEstado("cred", "abc-123", "aceptacion")

        assertTrue("dio " + r, r is Resultado.Ok)
        val enviado = servidor.takeRequest()
        assertEquals("PATCH", enviado.method)
        assertEquals("/admin/pedidos/abc-123/estado", enviado.path)
        assertEquals("Bearer cred", enviado.getHeader("Authorization"))
        assertEquals("""{"estado":"aceptacion"}""", enviado.body.readUtf8())
    }

    /**
     * Devuelve **el pedido como quedo en el servicio**, no como la app pidio.
     * Es lo que permite cumplir FR-008 sin adivinar.
     */
    @Test
    fun `mover devuelve el pedido que contesto el servicio`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody(unPedido))

        val r = servicio.cambiarEstado("cred", "1", "aceptacion") as Resultado.Ok
        assertEquals("aceptacion", r.valor.estado)
        assertEquals("FU-0001", r.valor.codigo)
    }

    /**
     * Sin senal al mover, el llamador se entera **y no recibe un pedido movido**.
     * Es la mitad de FR-008 que vive en esta capa: si aca saliera un Ok, la
     * pantalla dibujaria como hecho algo que no llego a la base.
     */
    @Test
    fun `mover sin senal no devuelve un pedido movido`() = runTest {
        servidor.shutdown()

        val r = servicio.cambiarEstado("cred", "1", "entrega")
        assertEquals(Motivo.SIN_RED, (r as Resultado.Fallo).motivo)
    }

    @Test
    fun `mover un pedido que no existe es del servicio`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(404).setBody("""{"error":"no hay tal pedido"}"""))

        val r = servicio.cambiarEstado("cred", "no-existe", "entrega") as Resultado.Fallo
        assertEquals(Motivo.DEL_SERVICIO, r.motivo)
        assertEquals("no hay tal pedido", r.detalle)
    }
}
