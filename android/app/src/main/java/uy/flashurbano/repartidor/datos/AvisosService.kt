package uy.flashurbano.repartidor.datos

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.runBlocking

/**
 * Lo que el proveedor de avisos llama en este telefono.
 *
 * **Sin la declaracion en `AndroidManifest.xml` esta clase no existe para el
 * sistema y no llega nada**, sin ningun error: es el modo de falla mas facil de
 * este archivo y no se descubre compilando.
 *
 * ## Cuando corre `onMessageReceived`, y cuando no
 *
 * Esto es la parte que mas confunde, y de lo que depende el diseno entero:
 *
 * - **App cerrada o en segundo plano**: como el mensaje trae bloque
 *   `notification`, **lo dibuja el sistema y esto NO se llama**. Tocar el aviso
 *   abre la actividad principal con el bloque `data` adentro del intent.
 * - **App en primer plano**: el sistema **no** dibuja nada y llama aca. Por eso
 *   el unico trabajo de este metodo es anotar que llego algo — la pantalla ya
 *   esta a la vista, y taparla con un cartel del sistema seria decirle a Diego
 *   algo que puede leer mirando.
 *
 * Las dos mitades de FR-004 y FR-016 salen de esa division, y ninguna de las
 * dos se escribio: viene dada por mandar `notification` y `data` juntos (D5).
 */
class AvisosService : FirebaseMessagingService() {

    /**
     * El canal se crea tambien aca, y no solo en la pantalla.
     *
     * Es barato —crearlo dos veces no es un error— y cubre el caso en que este
     * servicio arranque el proceso antes de que alguien haya abierto la app.
     */
    override fun onCreate() {
        super.onCreate()
        crearCanalDeAvisos(this)
    }

    /**
     * El proveedor renovo el token de este telefono.
     *
     * Se guarda y nada mas: **declararlo es trabajo de la proxima llamada al
     * servicio**, que lo lleva en una cabecera (research D1). Mandarlo aca
     * pediria un endpoint propio, y ademas fallaria justo cuando esto suele
     * pasar: en una reinstalacion, antes de que haya credencial.
     *
     * `runBlocking` es correcto aca y no un atajo: Android llama esto en un hilo
     * de fondo suyo, y el metodo tiene que terminar habiendo guardado. Volver
     * antes con una corrutina suelta es como se pierde un token en un proceso
     * que el sistema mata a los dos segundos.
     *
     * **Sobre la deprecacion**: el reemplazo de `onNewToken` es `onRegistered`,
     * y esta apagado por defecto — hay que optar por el con
     * `firebase_messaging_installation_id_enabled=true` en el manifiesto. El
     * argumento completo esta en `pedirTokenDeAvisos`, y el disparador para
     * migrar, en `docs/tech-debt-tracker.md`.
     */
    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        runBlocking {
            Credencial(applicationContext).guardarPushToken(token)
        }
    }

    /**
     * Llego un aviso con la app abierta.
     *
     * **No se dibuja una notificacion y no se toca la lista.** Lo unico que pasa
     * es que un contador sube, y con el aparece un renglon que Diego toca cuando
     * quiere. Ver [AvisosEnVivo].
     */
    override fun onMessageReceived(mensaje: RemoteMessage) {
        super.onMessageReceived(mensaje)
        Log.i("avisos", "llego un aviso del pedido ${mensaje.data[CLAVE_PEDIDO]}")
        AvisosEnVivo.llego()
    }
}
