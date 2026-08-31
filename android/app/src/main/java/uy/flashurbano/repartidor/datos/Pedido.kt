package uy.flashurbano.repartidor.datos

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Lo que devuelve `GET /admin/pedidos`.
 *
 * **Este archivo es el que mas cuidado necesita de la app**, y no por dificil:
 * porque es donde estuvo el defecto las dos veces en `011`. El servicio manda
 * formas que parecen imposibles y existen (data-model seccion 5).
 */

/**
 * Como se lee la respuesta del servicio.
 *
 * `ignoreUnknownKeys` NO es comodidad: la respuesta ya trae `usuarioId`,
 * `creadoEn` y `actualizadoEn`, que a la app no le sirven de nada. Sin esto,
 * **el dia que el servicio agregue un campo la app deja de andar entera**, y la
 * unica forma de arreglarlo es instalar un archivo nuevo a mano en el telefono
 * de otra persona.
 */
val json: Json = Json { ignoreUnknownKeys = true }

@Serializable
data class RespuestaPedidos(val pedidos: List<Pedido> = emptyList())

@Serializable
data class Punto(val lat: Double, val lng: Double)

@Serializable
data class Direccion(
    val calle: String = "",
    val esquina: String = "",
    // `numero` y `apto` llegan como `null` explicito cuando no estan.
    val numero: String? = null,
    val apto: String? = null,
    val cooperativa: Boolean = false,
    /**
     * **Opcional, y no llega como `null`: DESAPARECE.** El servicio lo marca
     * `omitempty`, asi que un pedido sin punto no trae la clave.
     *
     * Un pedido puede venir sin punto de retiro —el texto no resolvio, o la
     * calle es homonima— y sin punto de entrega —es anterior a `011`—. Las dos
     * formas existen HOY en produccion. Declararlo no-nulo rompe la app con
     * datos que ya estan ahi.
     */
    val punto: Punto? = null,
)

@Serializable
data class Pedido(
    val id: String,
    val codigo: String,
    /**
     * **Texto suelto y no un enum, a proposito.** El servicio lo guarda como
     * `text` con un CHECK justamente para que la lista pueda crecer con una
     * linea de migracion. Un enum de Kotlin haria que un estado nuevo tirara la
     * pantalla en vez de mostrarse.
     */
    val estado: String,
    val remitenteNombre: String = "",
    val remitenteTelefono: String = "",
    val retiro: Direccion = Direccion(),
    val entrega: Direccion = Direccion(),
    val paqueteTamano: String = "",
    val cantidad: Int = 0,
    val retiroFecha: String = "",
    val retiroHora: String = "",
    val destinatarioNombre: String = "",
    val destinatarioTelefono: String = "",
    val precio: Int = 0,
    val zonaId: Int = 0,
)

/** Los estados que el servicio conoce hoy. Los mismos textos que el CHECK. */
object Estados {
    const val CREACION = "creacion"
    const val ACEPTACION = "aceptacion"
    const val ENTREGA = "entrega"
}

/**
 * Las secciones en las que Diego trabaja.
 *
 * Son DOS en la pantalla principal (FR-013). `ENTREGADOS` vive fuera, porque es
 * la unica lista que crece sin limite y sirve para consultar, no para trabajar.
 */
enum class Seccion { PENDIENTES, TOMADOS, ENTREGADOS }

/**
 * En que seccion cae un pedido.
 *
 * **Un estado desconocido cae en PENDIENTES, y esa es una decision, no un
 * descarte.** Lo unico que se sabe de un estado que la app no conoce es que no
 * es `entrega`; o sea que puede ser trabajo sin hacer. Mandarlo a ENTREGADOS lo
 * escondería de la pantalla donde se trabaja, y tener una tercera seccion
 * visible contradice FR-013. La tarjeta muestra el texto crudo del estado, asi
 * que se ve que pasa algo raro en vez de disimularlo.
 */
fun seccionDe(estado: String): Seccion = when (estado) {
    Estados.ENTREGA -> Seccion.ENTREGADOS
    Estados.ACEPTACION -> Seccion.TOMADOS
    else -> Seccion.PENDIENTES
}

/**
 * Si la app conoce este estado.
 *
 * **Es lo que FR-011 necesita, y no lo que FR-011 decia.** El requisito hablaba
 * de mostrar el estado crudo "cuando no coincide con la seccion", y eso no se
 * puede dar nunca: la seccion se calcula CON `seccionDe(estado)`, asi que
 * siempre coinciden por construccion — un estado desconocido cae en PENDIENTES
 * y queda listado en PENDIENTES.
 *
 * Lo que de verdad hay que detectar es que el estado **no sea ninguno de los
 * tres que la app conoce**, que es el caso que `012` quiso cubrir eligiendo
 * texto en vez de un enum: el dia que el servicio sume un cuarto estado, ese
 * pedido tiene que verse raro en vez de disimularse.
 */
fun esEstadoConocido(estado: String): Boolean = estado == Estados.CREACION ||
    estado == Estados.ACEPTACION ||
    estado == Estados.ENTREGA
