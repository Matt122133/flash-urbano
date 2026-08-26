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

/**
 * Habla con el servicio. **Dos llamadas y el ingreso**, que es por lo que aca no
 * hay Retrofit (research D4).
 */
class Servicio(
    private val baseUrl: String = BuildConfig.BASE_URL,
    private val cliente: OkHttpClient = clientePorDefecto(),
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
            cliente.newCall(peticion.build()).execute().use { respuesta ->
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
