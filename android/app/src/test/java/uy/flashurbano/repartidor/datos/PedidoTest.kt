package uy.flashurbano.repartidor.datos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * **Es lo unico que se puede probar sin dispositivo, y es justo donde estuvo el
 * defecto en `011` las dos veces.**
 *
 * Los JSON de abajo NO estan escritos a mano contra los tags de Go: salieron de
 * marshalear un `pedidos.Pedido` de verdad el 2026-08-26 y copiar la salida. Es
 * la diferencia entre probar el mapeo y probar lo que uno cree que manda el
 * servicio.
 */
class PedidoTest {

    /** Un pedido completo, con los dos puntos. */
    private val completo = """
        {
          "id": "11111111-1111-1111-1111-111111111111",
          "usuarioId": "u1",
          "codigo": "FU-0001",
          "estado": "creacion",
          "remitenteNombre": "Ana Perez",
          "remitenteTelefono": "099111222",
          "retiro": {
            "calle": "18 de Julio", "esquina": "Ejido",
            "numero": "1234", "apto": "301", "cooperativa": false,
            "punto": { "lat": -34.9, "lng": -56.19 }
          },
          "entrega": {
            "calle": "Rivera", "esquina": "Bulevar Artigas",
            "numero": null, "apto": null, "cooperativa": false,
            "punto": { "lat": -34.9, "lng": -56.16 }
          },
          "paqueteTamano": "chico", "cantidad": 1,
          "retiroFecha": "2026-08-27", "retiroHora": "10:00",
          "destinatarioNombre": "Beto", "destinatarioTelefono": "099222333",
          "precio": 300, "zonaId": 2,
          "creadoEn": "2026-08-26T20:34:33.31Z",
          "actualizadoEn": "2026-08-26T20:34:33.31Z"
        }
    """.trimIndent()

    /**
     * El mismo pedido **sin ninguno de los dos puntos**.
     *
     * Ojo con la forma: la clave `punto` **no aparece**, no viene en `null`. El
     * servicio la marca `omitempty`. Un modelo que esperara `null` explicito
     * fallaria igual, y por eso el caso se prueba tal cual llega.
     */
    private val sinPuntos = """
        {
          "id": "22222222-2222-2222-2222-222222222222",
          "usuarioId": "u1",
          "codigo": "FU-0002",
          "estado": "creacion",
          "remitenteNombre": "Ana Perez",
          "remitenteTelefono": "099111222",
          "retiro": {
            "calle": "Calle Que No Resolvio", "esquina": "Otra",
            "numero": null, "apto": null, "cooperativa": false
          },
          "entrega": {
            "calle": "Rivera", "esquina": "Propios",
            "numero": null, "apto": null, "cooperativa": false
          },
          "paqueteTamano": "mediano", "cantidad": 2,
          "retiroFecha": "2026-08-27", "retiroHora": "11:00",
          "destinatarioNombre": "Ceci", "destinatarioTelefono": "099333444",
          "precio": 400, "zonaId": 3,
          "creadoEn": "2026-08-26T20:34:33.31Z",
          "actualizadoEn": "2026-08-26T20:34:33.31Z"
        }
    """.trimIndent()

    @Test
    fun `un pedido completo se lee entero`() {
        val p = json.decodeFromString<Pedido>(completo)

        assertEquals("FU-0001", p.codigo)
        assertEquals("creacion", p.estado)
        assertEquals("18 de Julio", p.retiro.calle)
        assertEquals("1234", p.retiro.numero)
        assertEquals("301", p.retiro.apto)
        assertNotNull(p.retiro.punto)
        assertEquals(-56.19, p.retiro.punto!!.lng, 0.0001)
        assertNotNull(p.entrega.punto)
        // Los dos telefonos, que son FR-015: quien envia y quien recibe.
        assertEquals("099111222", p.remitenteTelefono)
        assertEquals("099222333", p.destinatarioTelefono)
    }

    @Test
    fun `un pedido sin punto de retiro se lee igual`() {
        val p = json.decodeFromString<Pedido>(sinPuntos)

        assertNull(p.retiro.punto)
        // Y la direccion ESCRITA sigue estando, que es lo que Diego lee.
        assertEquals("Calle Que No Resolvio", p.retiro.calle)
        assertEquals("Otra", p.retiro.esquina)
    }

    @Test
    fun `un pedido sin punto de entrega se lee igual`() {
        val p = json.decodeFromString<Pedido>(sinPuntos)

        assertNull(p.entrega.punto)
        assertEquals("Rivera", p.entrega.calle)
    }

    @Test
    fun `los campos que la app no usa no la rompen`() {
        // `usuarioId`, `creadoEn` y `actualizadoEn` ya vienen y no estan
        // modelados. Y este trae ademas uno que todavia no existe: es el caso
        // del dia que el servicio agregue un campo.
        val conCampoNuevo = completo.replaceFirst(
            "\"codigo\": \"FU-0001\"",
            "\"codigo\": \"FU-0001\", \"algoQueTodaviaNoExiste\": {\"a\": [1, 2]}",
        )
        val p = json.decodeFromString<Pedido>(conCampoNuevo)
        assertEquals("FU-0001", p.codigo)
    }

    @Test
    fun `una lista vacia se lee como lista vacia`() {
        val r = json.decodeFromString<RespuestaPedidos>("""{"pedidos":[]}""")
        assertTrue(r.pedidos.isEmpty())
    }

    @Test
    fun `la respuesta con pedidos se lee entera`() {
        val r = json.decodeFromString<RespuestaPedidos>(
            """{"pedidos":[$completo,$sinPuntos]}"""
        )
        assertEquals(2, r.pedidos.size)
        assertEquals("FU-0001", r.pedidos[0].codigo)
        assertEquals("FU-0002", r.pedidos[1].codigo)
    }

    @Test
    fun `cada estado cae en su seccion`() {
        assertEquals(Seccion.PENDIENTES, seccionDe(Estados.CREACION))
        assertEquals(Seccion.TOMADOS, seccionDe(Estados.ACEPTACION))
        assertEquals(Seccion.ENTREGADOS, seccionDe(Estados.ENTREGA))
    }

    @Test
    fun `un estado desconocido se lee y cae en pendientes`() {
        // El servicio guarda el estado como texto para que la lista pueda
        // crecer. Un estado nuevo tiene que MOSTRARSE, no tirar la pantalla.
        val p = json.decodeFromString<Pedido>(
            completo.replaceFirst("\"estado\": \"creacion\"", "\"estado\": \"en_camino\"")
        )
        assertEquals("en_camino", p.estado)
        // Pendientes y no Entregados: lo unico que se sabe es que no esta
        // entregado, o sea que puede ser trabajo sin hacer. Esconderlo seria
        // perderle un paquete a Diego.
        assertEquals(Seccion.PENDIENTES, seccionDe("en_camino"))
    }

    // El comentario del pedido (026).

    /** Un pedido con comentario, de tres renglones. */
    private val conComentario = completo.replace(
        """"precio": 300""",
        """"comentario": "Tocar timbre del 2\nEl porton no abre\nPreguntar por la encargada",
          "precio": 300""",
    )

    /**
     * FR-006: el comentario llega y se lee entero, con sus renglones.
     *
     * Los saltos son lo que se rompe sin que nadie lo note: el tipo es `String`
     * con renglones o sin ellos.
     */
    @Test
    fun `el comentario llega con sus renglones`() {
        val p = json.decodeFromString<Pedido>(conComentario)
        assertNotNull(p.comentario)
        assertEquals(3, p.comentario!!.split("\n").size)
        assertTrue(p.comentario!!.startsWith("Tocar timbre del 2"))
    }

    /**
     * FR-010: un pedido **sin** comentario se lee igual que siempre.
     *
     * El servicio OMITE la clave cuando no hay comentario, asi que este es el
     * caso de todos los pedidos que existen hoy. Si `comentario` fuera `String`
     * no nulable, esto tiraria la lista entera.
     */
    @Test
    fun `un pedido sin comentario se lee y queda en nulo`() {
        val p = json.decodeFromString<Pedido>(completo)
        assertNull(p.comentario)
    }

    /**
     * **FR-011, y es el que habilita el orden de despliegue.**
     *
     * Un campo que la app NO conoce no la puede romper: por eso el lector tiene
     * `ignoreUnknownKeys`, y este es el control positivo de que sigue puesto.
     *
     * Mientras esto pase, **el servicio se puede desplegar antes que el APK**, y
     * el telefono de Diego sigue funcionando con la version que ya tiene
     * instalada — que importa porque la app se instala a mano y no hay tienda.
     */
    @Test
    fun `un campo que la app no conoce no rompe la lectura`() {
        val conCampoFuturo = completo.replace(
            """"precio": 300""",
            """"algoQueTodaviaNoExiste": { "vaya": "uno" },
          "precio": 300""",
        )
        val p = json.decodeFromString<Pedido>(conCampoFuturo)
        assertEquals("FU-0001", p.codigo)
        assertNull(p.comentario)
    }
}
