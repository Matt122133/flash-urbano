package uy.flashurbano.repartidor.datos

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * El canal por el que entran los pedidos nuevos.
 *
 * **Tiene que ser el mismo string que manda el servicio** en
 * `android.notification.channel_id`, y ese es todo el riesgo de este valor: si
 * no coinciden, Android entrega el aviso **con la importancia por defecto** —no
 * suena, no aparece encima— y **nada falla**. El feature entero se pierde en
 * silencio.
 *
 * Del otro lado vive en `backend/internal/avisos/fcm.go`, y el contrato que los
 * ata es `specs/018-aviso-de-pedido-nuevo/contracts/mensaje-de-aviso.md`.
 */
const val CANAL_PEDIDOS_NUEVOS = "pedidos-nuevos"

/** La clave del bloque `data` que dice de que pedido se trata. */
const val CLAVE_PEDIDO = "pedido"

/**
 * Crea el canal de avisos si no existe.
 *
 * **Importancia alta**: suena y aparece encima de lo que Diego este mirando, que
 * es lo unico que sirve para un aviso que existe para interrumpir.
 *
 * **Y con eso queda cumplido FR-006 sin escribir ninguna franja horaria.** Un
 * canal del sistema respeta el *No molestar* del telefono, asi que el horario en
 * el que Diego acepta ser interrumpido lo maneja el desde los ajustes, que ya
 * saben hacerlo. Escribirlo en el producto seria reimplementar peor algo que el
 * sistema hace bien, y ademas dejarlo donde el no lo puede cambiar.
 *
 * Crear un canal dos veces **no es un error**: Android ignora la segunda. Por
 * eso esto se llama desde los dos lados —la pantalla y el servicio de avisos—
 * sin coordinar cual gano.
 *
 * **La importancia solo se puede fijar al crearlo.** Si el canal ya existe con
 * otra importancia porque una version anterior lo creo distinto, esto no la
 * cambia: la decide el usuario desde ese momento. No hay forma de forzarla, y
 * esta bien que no la haya.
 */
fun crearCanalDeAvisos(contexto: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val canal = NotificationChannel(
        CANAL_PEDIDOS_NUEVOS,
        "Pedidos nuevos",
        NotificationManager.IMPORTANCE_HIGH,
    ).apply {
        description = "Avisa cuando entra un pedido."
    }

    contexto.getSystemService(NotificationManager::class.java)
        ?.createNotificationChannel(canal)
}

/**
 * Le pide al proveedor el token de este telefono.
 *
 * **Es una tarea con callback y no una suspend function**, a proposito: hacerla
 * suspend pediria `kotlinx-coroutines-play-services`, un modulo mas para
 * ahorrarse tres lineas. El repo prefiere el modulo de menos.
 *
 * **Que falle no rompe nada.** Sin Google Play Services, sin red al arrancar, o
 * con el proyecto mal configurado, esto no devuelve token y la app funciona
 * igual: lo que se pierde son los avisos, no la app. Queda en el registro,
 * porque un telefono sin token es exactamente el sintoma de "no me llega nada".
 *
 * ## Por que se usa una API marcada como obsoleta, a proposito
 *
 * `getToken()` esta deprecada en `firebase-messaging` 25.1.2 —el compilador lo
 * avisa— y su reemplazo es `register()`, que entrega el token por
 * `FirebaseMessagingService.onRegistered` en vez de devolverlo.
 *
 * **`register()` no se puede usar todavia**, y no es una opinion: mirando el
 * bytecode del artefacto, lo primero que hace es
 *
 *     if (!isV1RegistrationEnabled()) return Tasks.forException(IllegalStateException(...))
 *
 * con el mensaje *"API disabled. Please enable it by adding
 * `firebase_messaging_installation_id_enabled=true` to your app's manifest"*.
 * O sea que el reemplazo esta **apagado por defecto** y hay que optar por el
 * con una bandera en el manifiesto, cambiando de paso el modelo de registro
 * entero.
 *
 * Migrar a eso es una decision con su propia comprobacion en un telefono de
 * verdad, no un warning que se silencia de paso mientras se construye otra
 * cosa. Queda anotado en `docs/tech-debt-tracker.md` con su disparador.
 */
@Suppress("DEPRECATION")
fun pedirTokenDeAvisos(alTenerlo: (String) -> Unit) {
    FirebaseMessaging.getInstance().token
        .addOnSuccessListener { token ->
            if (!token.isNullOrBlank()) alTenerlo(token)
        }
        .addOnFailureListener { e ->
            Log.w("avisos", "no se pudo obtener el token de avisos", e)
        }
}

/**
 * Los pedidos que llegaron **mientras la app estaba abierta**.
 *
 * ## Por que un objeto de proceso y no algo del ViewModel
 *
 * El aviso lo recibe un `Service` del sistema, que Android instancia el solo y
 * al que no se le puede pasar nada. No tiene forma de alcanzar al ViewModel, y
 * no hay un lugar mejor donde dejar el dato: es un contador por proceso, del
 * tamano exacto del problema. Un bus de eventos o una inyeccion de dependencias
 * para esto seria infraestructura para pasar un entero.
 *
 * ## Por que un contador y no la lista
 *
 * **Porque la lista NO se toca sola** (FR-016). Un pedido que aparece justo
 * cuando Diego esta por tocar *tomar* mueve la fila debajo del dedo, y el toque
 * cae en el pedido equivocado. Lo unico que pasa solo es que aparece un renglon
 * que dice cuantos hay; la lista cambia cuando el lo toca, y no antes.
 */
object AvisosEnVivo {
    private val _nuevos = MutableStateFlow(0)

    /** Cuantos pedidos entraron desde la ultima vez que se miro la lista. */
    val nuevos: StateFlow<Int> = _nuevos.asStateFlow()

    /** Llego un aviso con la app abierta. */
    fun llego() {
        _nuevos.value += 1
    }

    /** Diego actualizo: lo que habia ya lo esta viendo. */
    fun vistos() {
        _nuevos.value = 0
    }
}

/**
 * Como se anuncia que hay pedidos nuevos sin haberlos traido todavia.
 *
 * Devuelve vacio cuando no hay ninguno, que es lo que hace que el renglon **no
 * ocupe pantalla** en el caso normal — lo mismo que `015` estuvo sacando.
 */
fun textoDePedidosNuevos(cuantos: Int): String = when {
    cuantos <= 0 -> ""
    cuantos == 1 -> "1 pedido nuevo — tocá para actualizar"
    else -> "$cuantos pedidos nuevos — tocá para actualizar"
}
