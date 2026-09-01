package uy.flashurbano.repartidor

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import uy.flashurbano.repartidor.pantallas.Destino
import uy.flashurbano.repartidor.pantallas.HojaEntrega
import uy.flashurbano.repartidor.pantallas.PantallaIngreso
import uy.flashurbano.repartidor.pantallas.PantallaPedidos
import uy.flashurbano.repartidor.pantallas.RepartidorViewModel
import uy.flashurbano.repartidor.datos.CLAVE_PEDIDO
import uy.flashurbano.repartidor.datos.crearCanalDeAvisos
import uy.flashurbano.repartidor.ui.tema.TemaFlashUrbano

class MainActivity : ComponentActivity() {

    /**
     * El pedido que venia adentro del aviso que Diego toco, si vino por ahi.
     *
     * **Es estado de Compose y no un valor leido una vez** porque el aviso
     * puede llegar con la app ya abierta: ahi Android no crea la actividad de
     * nuevo, llama a [onNewIntent], y un valor leido en `onCreate` se quedaria
     * con el de la primera vez.
     */
    private var pedidoDelAviso by mutableStateOf("")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // **Antes de cualquier aviso.** Un mensaje que llega nombrando un canal
        // que no existe se entrega con la importancia por defecto: no suena, no
        // aparece encima, y no falla nada.
        crearCanalDeAvisos(this)
        pedidoDelAviso = intent?.getStringExtra(CLAVE_PEDIDO).orEmpty()

        setContent {
            TemaFlashUrbano {
                // `safeDrawingPadding` en la raiz y no en cada pantalla: sin
                // esto el titulo queda pegado a la barra de estado, y en un
                // telefono con muesca —que es cualquiera hoy— se le mete
                // debajo. Se vio en el emulador; compilando no se ve.
                Surface(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
                    AppRepartidor(pedidoDelAviso = pedidoDelAviso)
                }
            }
        }
    }

    /**
     * Llego un aviso y Diego lo toco con la app ya abierta.
     *
     * Sin esto, tocar el aviso traeria la app al frente **en la pantalla donde
     * estaba**, sin llevarlo al pedido — que es la mitad de FR-004 que se
     * pierde en silencio, porque desde afuera se ve igual: la app se abre.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        pedidoDelAviso = intent.getStringExtra(CLAVE_PEDIDO).orEmpty()
    }
}

/**
 * El arbol entero de la app.
 *
 * **Sin biblioteca de navegacion**, igual que en `012` y por el mismo motivo,
 * aunque el modelo cambio: ahora son tres listas HERMANAS elegidas con una
 * barra abajo, no dos pantallas apiladas. Comparten el mismo `ViewModel` y los
 * mismos datos ya cargados, asi que un grafo de navegacion aportaria rutas,
 * argumentos y un back stack para decidir cual de tres se dibuja (research D1).
 *
 * ## "Atras" cambia de significado, y es deliberado
 *
 * Hasta `014` habia un `BackHandler` que volvia de Entregados a la pantalla de
 * trabajo. Se fue con la pantalla: **con pestanas hermanas, atras sale de la
 * app desde cualquiera de las tres**, que es lo que hace toda barra de
 * navegacion en Android. Diego no vuelve "de" Entregados: cambia de pestana.
 */
@Composable
fun AppRepartidor(
    vm: RepartidorViewModel = viewModel(),
    pedidoDelAviso: String = "",
) {
    val destino by vm.destino.collectAsState()
    val pantalla by vm.pantalla.collectAsState()
    val ingreso by vm.ingreso.collectAsState()
    val moviendo by vm.moviendo.collectAsState()
    val aviso by vm.aviso.collectAsState()
    val seccion by vm.seccion.collectAsState()
    val deshacer by vm.deshacer.collectAsState()
    val sinRed by vm.sinRed.collectAsState()
    val entregando by vm.entregando.collectAsState()
    val pedidosNuevos by vm.pedidosNuevos.collectAsState()
    val avisos by vm.avisos.collectAsState()
    val destacado by vm.destacado.collectAsState()

    val contexto = LocalContext.current

    /**
     * Le pregunta al sistema si los avisos van a llegar.
     *
     * En Android anterior a 13 el permiso no existe y siempre esta concedido:
     * tratarlo como negado le mostraria a Diego un cartel que no puede
     * resolver.
     */
    fun mirarLosAvisos() {
        val permiso = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(contexto, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        vm.mirarSiLleganLosAvisos(
            permisoConcedido = permiso,
            habilitadasEnElSistema = NotificationManagerCompat.from(contexto).areNotificationsEnabled(),
        )
    }

    val pedirPermiso = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { mirarLosAvisos() }

    // **Se pregunta una sola vez por instalacion**, que es todo lo que Android
    // permite: a la segunda negativa el sistema ni siquiera muestra el cartel.
    // De ahi en mas la unica salida es el renglon que lleva a los ajustes, y por
    // eso ese renglon no es un adorno.
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pedirPermiso.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            mirarLosAvisos()
        }
    }

    // **Al volver a la app se vuelve a preguntar.** Es lo que hace que el
    // renglon desaparezca solo cuando Diego concede el permiso desde los
    // ajustes: si no, tendria que cerrar y abrir para dejar de ver un cartel
    // sobre algo que ya arreglo.
    val duenoDelCiclo = LocalLifecycleOwner.current
    DisposableEffect(duenoDelCiclo) {
        val observador = LifecycleEventObserver { _, evento ->
            if (evento == Lifecycle.Event.ON_RESUME) mirarLosAvisos()
        }
        duenoDelCiclo.lifecycle.addObserver(observador)
        onDispose { duenoDelCiclo.lifecycle.removeObserver(observador) }
    }

    // Diego toco un aviso. Se recarga y se deja ese pedido a la vista (FR-004).
    LaunchedEffect(pedidoDelAviso) {
        if (pedidoDelAviso.isNotEmpty()) vm.abrirDesdeUnAviso(pedidoDelAviso)
    }

    when (val d = destino) {
        is Destino.Arrancando -> Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) { CircularProgressIndicator() }

        is Destino.Ingreso -> PantallaIngreso(
            estado = ingreso,
            motivo = d.motivo,
            alEscribirMail = vm::escribioMail,
            alEscribirCodigo = vm::escribioCodigo,
            alPedirCodigo = vm::pedirCodigo,
            alVerificar = vm::verificarCodigo,
        )

        is Destino.Pedidos -> {
            PantallaPedidos(
                estado = pantalla,
                seccion = seccion,
                moviendo = moviendo,
                aviso = aviso,
                deshacer = deshacer,
                sinRed = sinRed,
                pedidosNuevos = pedidosNuevos,
                avisos = avisos,
                destacado = destacado,
                alElegirSeccion = vm::elegirSeccion,
                alReintentar = vm::cargar,
                alMover = { pedido, destino -> vm.mover(pedido, destino) },
                alDescartarAviso = vm::descartarAviso,
                alRevertir = vm::revertir,
                alDescartarDeshacer = vm::descartarDeshacer,
                alEntregar = vm::pedirEntrega,
                alTraerLosNuevos = { vm.abrirDesdeUnAviso() },
                alIrALosAjustes = { contexto.startActivity(ajustesDeLaApp(contexto.packageName)) },
            )

            // La hoja va **encima** de la pantalla, no en lugar de ella: al
            // cerrarla Diego vuelve a la lista donde estaba, con el pedido
            // todavia en En curso si no confirmo.
            entregando?.let { pedido ->
                HojaEntrega(
                    pedido = pedido,
                    alCancelar = vm::cancelarEntrega,
                    alConfirmar = { nombre, documento ->
                        vm.confirmarEntrega(pedido, nombre, documento)
                    },
                )
            }
        }
    }
}

/**
 * El intent que abre los ajustes de notificaciones de ESTA app.
 *
 * **A la pantalla de la app y no a la lista general del telefono**: desde `015`
 * la regla es que un cartel que dice que algo esta mal tiene que llevar a donde
 * se arregla, y "Ajustes > Aplicaciones > buscá Flash Urbano" no es llevar a
 * ningun lado parado en una puerta.
 */
private fun ajustesDeLaApp(paquete: String): Intent =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, paquete)
    } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(Uri.fromParts("package", paquete, null))
    }
