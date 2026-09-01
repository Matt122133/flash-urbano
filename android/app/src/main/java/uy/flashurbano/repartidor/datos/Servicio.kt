package uy.flashurbano.repartidor.datos

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import uy.flashurbano.repartidor.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Lo que puede salir de una llamada al servicio.
 *
 * **La app no lanza excepciones hacia la pantalla.** Un telefono en la calle se
 * queda sin senal como caso normal, no como error: si un fallo de red tirara la
 * app, Diego perderia la lista en el peor momento. Todo fallo se convierte en
 * algo que la pantalla pueda dibujar.
 */
sealed interface Resultado<out T> {
    data class Ok<T>(val valor: T) : Resultado<T>
    data class Fallo(val motivo: Motivo, val detalle: String = "") : Resultado<Nothing>
}

/**
 * Por que fallo, con la granularidad que la pantalla necesita para decir algo
 * distinto en cada caso (contrato seccion 5).
 */
enum class Motivo {
    /** No se llego al servicio. Se reintenta y puede andar. */
    SIN_RED,

    /** La credencial dejo de valer. Hay que volver al ingreso. */
    SESION_VENCIDA,

    /** El servicio contesto, y contesto que no. Reintentar no arregla nada. */
    DEL_SERVICIO,
}

@Serializable
private data class PeticionCodigo(val email: String)

@Serializable
private data class PeticionVerificar(val email: String, val codigo: String)

@Serializable
private data class RespuestaSesion(val credencial: String)

@Serializable
private data class PeticionEstado(val estado: String, val receptor: Receptor? = null)

/**
 * Quien recibio el paquete, tal como lo manda la app.
 *
 * **El documento va vacio si no se dio**, no ausente: el servicio lo trata igual
 * —lo guarda nulo— y mandar siempre la misma forma evita que la app tenga que
 * decidir entre dos cuerpos distintos parada en una puerta.
 */
@Serializable
data class Receptor(val nombre: String, val documento: String = "")

@Serializable
private data class RespuestaPedido(val pedido: Pedido)

/**
 * La cabecera con la que la app dice que version es.
 *
 * Es lo unico que la app declara de si misma, y es a proposito: ni modelo, ni
 * fabricante, ni version de Android, ni identificador de dispositivo (FR-011).
 * Para contestar "que version corre el telefono de Diego" el resto sobra, y un
 * dato que no hace falta no se guarda.
 *
 * El contrato completo —que hace el servicio con cada forma que puede llegar—
 * esta en `specs/017-version-de-la-app/contracts/cabecera-version.md`.
 */
const val CABECERA_VERSION = "X-App-Version"

/**
 * La cabecera con la que la app dice a donde mandarle los avisos.
 *
 * Va al lado de [CABECERA_VERSION] y por el mismo camino, pero **el dato es
 * distinto en naturaleza**: la version describe al software, el token
 * direcciona a un telefono. Sigue sin viajar nada mas del aparato — ni modelo,
 * ni fabricante, ni identificador de dispositivo (FR-012).
 *
 * **Vacia o ausente es valido y significa "no tengo nada nuevo que declarar"**:
 * el servicio deja la fila como estaba. Ese es el caso de una app a la que le
 * negaron el permiso de avisos, y tambien el del sitio web, que no manda esta
 * cabecera nunca.
 *
 * El contrato completo esta en
 * `specs/018-aviso-de-pedido-nuevo/contracts/cabecera-push-token.md`.
 */
const val CABECERA_PUSH_TOKEN = "X-App-Push-Token"

/**
 * Habla con el servicio. **Dos llamadas y el ingreso**, que es por lo que aca no
 * hay Retrofit (research D4).
 */
class Servicio(
    private val baseUrl: String = BuildConfig.BASE_URL,
    private val cliente: OkHttpClient = clientePorDefecto(),
    /**
     * De donde sale el token de avisos, leido **en cada llamada**.
     *
     * Es una funcion y no un valor porque el token cambia solo: el proveedor lo
     * renueva sin avisar, y la app lo guarda cuando eso pasa. Un valor pasado
     * al construir el `Servicio` seria el que habia al arrancar la app, y a
     * partir de la primera renovacion el servicio estaria anotando una
     * direccion que ya no entrega.
     *
     * Por defecto vacio: las pruebas y cualquier uso sin avisos no tienen que
     * saber que esto existe.
     */
    private val tokenDeAvisos: suspend () -> String = { "" },
) {
    /** Pide que le manden un codigo al mail. */
    suspend fun pedirCodigo(email: String): Resultado<Unit> =
        llamar(
            Request.Builder()
                .url("$baseUrl/auth/codigo")
                .post(json.encodeToString(PeticionCodigo(email)).comoJson()),
        ) { Unit }

    /** Canjea el codigo por una credencial. */
    suspend fun verificarCodigo(email: String, codigo: String): Resultado<String> =
        llamar(
            Request.Builder()
                .url("$baseUrl/auth/codigo/verificar")
                .post(json.encodeToString(PeticionVerificar(email, codigo)).comoJson()),
        ) { cuerpo -> json.decodeFromString<RespuestaSesion>(cuerpo).credencial }

    /** Trae todos los pedidos. Es la lista que Diego trabaja. */
    suspend fun pedidos(credencial: String): Resultado<List<Pedido>> =
        llamar(
            Request.Builder()
                .url("$baseUrl/admin/pedidos")
                .header("Authorization", "Bearer $credencial")
                .get(),
        ) { cuerpo -> json.decodeFromString<RespuestaPedidos>(cuerpo).pedidos }

    /**
     * Mueve un pedido a un estado.
     *
     * **Manda el estado DESTINO, no una transicion** (contrato seccion 1). Es lo
     * que hace que tocar dos veces sea inofensivo: repetir "entrega" deja el
     * pedido igual y no agrega una fila al historial. Mandar una transicion
     * obligaria a la app a llevar la cuenta de donde venia, y esa cuenta se
     * desincroniza en cuanto haya dos pantallas abiertas.
     *
     * Devuelve **el pedido como quedo en el servicio**, no como la app cree que
     * quedo. Es lo que permite cumplir FR-008 sin adivinar.
     */
    /**
     * @param receptor quien recibio el paquete. **Obligatorio al entregar**
     *   desde `016`: el servicio devuelve 400 sin el. Se ignora en los otros
     *   estados, asi que el llamador no tiene que saber en que transicion esta.
     */
    suspend fun cambiarEstado(
        credencial: String,
        id: String,
        estado: String,
        receptor: Receptor? = null,
    ): Resultado<Pedido> =
        llamar(
            Request.Builder()
                .url("$baseUrl/admin/pedidos/$id/estado")
                .header("Authorization", "Bearer $credencial")
                .patch(json.encodeToString(PeticionEstado(estado, receptor)).comoJson()),
        ) { cuerpo -> json.decodeFromString<RespuestaPedido>(cuerpo).pedido }

    /**
     * Ejecuta la llamada y traduce todo lo que puede salir mal.
     *
     * Corre en `Dispatchers.IO`: OkHttp es sincronico y llamarlo desde el hilo
     * principal tira `NetworkOnMainThreadException`, que en una app de calle es
     * un cierre en seco.
     */
    private suspend fun <T> llamar(
        peticion: Request.Builder,
        leer: (String) -> T,
    ): Resultado<T> = withContext(Dispatchers.IO) {
        try {
            // **La version va aca y no en cada llamada**, que es lo que hace
            // cierto "en todos los pedidos" sin depender de que nadie se
            // olvide: las cuatro pasan por este embudo. Va tambien en las de
            // ingreso, donde hoy no sirve de nada — mandarla en unas si y en
            // otras no es la clase de asimetria que despues nadie recuerda por
            // que existe.
            // **El token va aca por lo mismo que la version**: las cuatro
            // llamadas pasan por este embudo, asi que "en todas" no depende de
            // que nadie se olvide.
            //
            // Si esta vacio **no se manda la cabecera**, en vez de mandarla en
            // blanco. Del lado del servicio dan lo mismo —los dos casos dejan
            // la fila como estaba—, pero una cabecera vacia en el cable se lee
            // como un dato que se perdio, y esto tiene que leerse como lo que
            // es: todavia no hay token.
            val token = tokenDeAvisos()
            val pedido = peticion
                .header(CABECERA_VERSION, BuildConfig.VERSION_NAME)
                .apply { if (token.isNotBlank()) header(CABECERA_PUSH_TOKEN, token) }
                .build()

            cliente.newCall(pedido).execute().use { respuesta ->
                val cuerpo = respuesta.body?.string().orEmpty()
                when {
                    respuesta.isSuccessful -> Resultado.Ok(leer(cuerpo))

                    // 401 es "esta credencial ya no vale" y 403 es "esta
                    // direccion no es administradora". Los dos terminan en la
                    // pantalla de ingreso, pero el segundo NO se arregla
                    // reingresando: es que falta el mail en ADMIN_EMAILS.
                    respuesta.code == 401 -> Resultado.Fallo(Motivo.SESION_VENCIDA)
                    respuesta.code == 403 -> Resultado.Fallo(
                        Motivo.DEL_SERVICIO,
                        "esta direccion no tiene permiso para ver los pedidos",
                    )

                    else -> Resultado.Fallo(Motivo.DEL_SERVICIO, mensajeDe(cuerpo, respuesta.code))
                }
            }
        } catch (e: IOException) {
            // Sin senal, servicio caido, DNS que no resuelve, tiempo agotado.
            // Todo lo mismo para quien mira la pantalla: no se pudo, reintenta.
            Resultado.Fallo(Motivo.SIN_RED, e.message.orEmpty())
        } catch (e: SerializationException) {
            // El servicio contesto 200 con algo que no se puede leer. Es un
            // defecto, no una falla de red, y decir "sin senal" mandaria a
            // buscar el problema al lugar equivocado.
            Resultado.Fallo(Motivo.DEL_SERVICIO, "respuesta ilegible: ${e.message}")
        }
    }
}

@Serializable
private data class RespuestaError(val error: String = "")

/** Saca el mensaje que manda el servicio, o arma uno con el codigo. */
private fun mensajeDe(cuerpo: String, codigo: Int): String =
    try {
        json.decodeFromString<RespuestaError>(cuerpo).error.ifBlank { "el servicio respondio $codigo" }
    } catch (_: SerializationException) {
        "el servicio respondio $codigo"
    }

private fun String.comoJson() = toRequestBody("application/json".toMediaType())

private fun clientePorDefecto(): OkHttpClient = OkHttpClient.Builder()
    // Tiempos cortos a proposito. En la calle, una llamada que tarda treinta
    // segundos en fallar es peor que una que falla en diez: Diego se queda
    // mirando el telefono sin saber si toco bien.
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(15, TimeUnit.SECONDS)
    .build()
