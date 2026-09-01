package uy.flashurbano.repartidor.datos

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import uy.flashurbano.repartidor.BuildConfig

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

    /**
     * **La version viaja en las CUATRO llamadas**, no solo en las
     * autenticadas.
     *
     * Mandarla en unas si y en otras no es la clase de asimetria que despues
     * nadie recuerda por que existe, y que alguien "arregla" en la direccion
     * equivocada.
     */
    @Test
    fun `la version va en todas las llamadas`() = runTest {
        repeat(4) { servidor.enqueue(MockResponse().setResponseCode(200).setBody(unaLista)) }

        servicio.pedirCodigo("a@b.com")
        servicio.verificarCodigo("a@b.com", "123456")
        servicio.pedidos("cred")
        servicio.cambiarEstado("cred", "1", "entrega", Receptor("Quien Sea"))

        repeat(4) {
            val recibido = servidor.takeRequest()
            assertEquals(
                "la llamada a ${recibido.path} no declaro la version",
                BuildConfig.VERSION_NAME,
                recibido.getHeader(CABECERA_VERSION),
            )
        }
    }

    /**
     * **El control positivo de FR-011**: que del telefono no viaja nada mas.
     *
     * Sin esto, "no mandamos datos del dispositivo" seria una afirmacion que
     * nada comprobaria — una guarda negativa sin control. El dia que alguien
     * agregue de buena fe un `X-Device-Model` para depurar algo, **esta prueba
     * se pone en rojo y obliga a decidirlo a proposito** en vez de que se cuele.
     *
     * La lista blanca es corta y deliberada. `Host`, `Connection`,
     * `Accept-Encoding` y `User-Agent` los pone OkHttp solo y no dicen nada del
     * telefono; `Content-Type` y `Content-Length` los pone el cuerpo.
     */
    @Test
    fun `no viaja del telefono nada mas que la version y el token de avisos`() = runTest {
        val permitidas = setOf(
            "authorization",
            "x-app-version",
            // `018`: a donde entregarle un aviso a este telefono, y nada mas.
            // Sigue sin viajar modelo, fabricante ni identificador de aparato.
            "x-app-push-token",
            "host",
            "connection",
            "accept-encoding",
            "user-agent",
            "content-type",
            "content-length",
        )

        repeat(2) { servidor.enqueue(MockResponse().setResponseCode(200).setBody(unaLista)) }
        // **Con token declarado**, que es el caso completo: asi la lista blanca
        // se ejercita entera en vez de dar por buena una entrada que ninguna
        // peticion produce.
        val servicio = conToken("token-de-este-telefono")
        servicio.pedidos("cred")
        servicio.cambiarEstado("cred", "1", "entrega", Receptor("Quien Sea"))

        repeat(2) {
            val recibido = servidor.takeRequest()
            val inesperadas = recibido.headers.names()
                .map { it.lowercase() }
                .filterNot { it in permitidas }

            assertTrue(
                "la app mando cabeceras no previstas en ${recibido.path}: $inesperadas. " +
                    "Si es a proposito, revisa FR-011 antes de agregarla a la lista.",
                inesperadas.isEmpty(),
            )
        }
    }

    // -----------------------------------------------------------------------
    // 018 — a donde mandarle los avisos a este telefono
    // -----------------------------------------------------------------------

    /** Un Servicio que declara el token que se le diga. */
    private fun conToken(token: String) = Servicio(
        baseUrl = servidor.url("/").toString().trimEnd('/'),
        tokenDeAvisos = { token },
    )

    /**
     * **El token viaja en las CUATRO llamadas**, por el mismo embudo que la
     * version y por el mismo motivo: "en todas" no puede depender de que nadie
     * se olvide de una.
     */
    @Test
    fun `el token de avisos va en todas las llamadas`() = runTest {
        repeat(4) { servidor.enqueue(MockResponse().setResponseCode(200).setBody(unaLista)) }
        val servicio = conToken("token-de-este-telefono")

        servicio.pedirCodigo("a@b.com")
        servicio.verificarCodigo("a@b.com", "123456")
        servicio.pedidos("cred")
        servicio.cambiarEstado("cred", "1", "entrega", Receptor("Quien Sea"))

        repeat(4) {
            val recibido = servidor.takeRequest()
            assertEquals(
                "la llamada a ${recibido.path} no declaro el token de avisos",
                "token-de-este-telefono",
                recibido.getHeader(CABECERA_PUSH_TOKEN),
            )
        }
    }

    /**
     * **Sin token no se manda la cabecera, en vez de mandarla vacia.**
     *
     * Del lado del servicio los dos casos dan lo mismo —el `COALESCE` deja la
     * fila como estaba— pero en el cable una cabecera vacia se lee como un dato
     * que se perdio, y esto tiene que leerse como lo que es: **todavia no hay
     * token**. Es el estado real de la app antes de que Diego conceda el
     * permiso de avisos.
     */
    @Test
    fun `sin token la cabecera no viaja`() = runTest {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody(unaLista))

        conToken("").pedidos("cred")

        assertNull(
            "se mando la cabecera de token estando vacia",
            servidor.takeRequest().getHeader(CABECERA_PUSH_TOKEN),
        )
    }

    /**
     * **El token se lee en CADA llamada, no una vez al construir el Servicio.**
     *
     * Es el defecto mas caro de este archivo y el mas facil de introducir: el
     * proveedor renueva el token sin avisar, y un valor congelado al arrancar
     * haria que desde esa renovacion el servicio anote una direccion que ya no
     * entrega. Los avisos se apagarian **sin que nada falle** — ni un error, ni
     * un renglon en el registro, ni una prueba en rojo salvo esta.
     */
    @Test
    fun `el token se relee en cada llamada`() = runTest {
        repeat(2) { servidor.enqueue(MockResponse().setResponseCode(200).setBody(unaLista)) }

        var actual = "el-viejo"
        val servicio = Servicio(
            baseUrl = servidor.url("/").toString().trimEnd('/'),
            tokenDeAvisos = { actual },
        )

        servicio.pedidos("cred")
        assertEquals("el-viejo", servidor.takeRequest().getHeader(CABECERA_PUSH_TOKEN))

        // El proveedor lo renovo entre una llamada y la otra.
        actual = "el-nuevo"
        servicio.pedidos("cred")
        assertEquals(
            "el Servicio se quedo con el token de cuando se construyo",
            "el-nuevo",
            servidor.takeRequest().getHeader(CABECERA_PUSH_TOKEN),
        )
    }
}
