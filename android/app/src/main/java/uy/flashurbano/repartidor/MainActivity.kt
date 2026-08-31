package uy.flashurbano.repartidor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import uy.flashurbano.repartidor.pantallas.Destino
import uy.flashurbano.repartidor.pantallas.HojaEntrega
import uy.flashurbano.repartidor.pantallas.PantallaIngreso
import uy.flashurbano.repartidor.pantallas.PantallaPedidos
import uy.flashurbano.repartidor.pantallas.RepartidorViewModel
import uy.flashurbano.repartidor.ui.tema.TemaFlashUrbano

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TemaFlashUrbano {
                // `safeDrawingPadding` en la raiz y no en cada pantalla: sin
                // esto el titulo queda pegado a la barra de estado, y en un
                // telefono con muesca —que es cualquiera hoy— se le mete
                // debajo. Se vio en el emulador; compilando no se ve.
                Surface(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
                    AppRepartidor()
                }
            }
        }
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
fun AppRepartidor(vm: RepartidorViewModel = viewModel()) {
    val destino by vm.destino.collectAsState()
    val pantalla by vm.pantalla.collectAsState()
    val ingreso by vm.ingreso.collectAsState()
    val moviendo by vm.moviendo.collectAsState()
    val aviso by vm.aviso.collectAsState()
    val seccion by vm.seccion.collectAsState()
    val deshacer by vm.deshacer.collectAsState()
    val sinRed by vm.sinRed.collectAsState()
    val entregando by vm.entregando.collectAsState()

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
                alElegirSeccion = vm::elegirSeccion,
                alReintentar = vm::cargar,
                alMover = { pedido, destino -> vm.mover(pedido, destino) },
                alDescartarAviso = vm::descartarAviso,
                alRevertir = vm::revertir,
                alDescartarDeshacer = vm::descartarDeshacer,
                alEntregar = vm::pedirEntrega,
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
