package uy.flashurbano.repartidor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import uy.flashurbano.repartidor.pantallas.Destino
import uy.flashurbano.repartidor.pantallas.EstadoPantalla
import uy.flashurbano.repartidor.pantallas.PantallaEntregados
import uy.flashurbano.repartidor.pantallas.PantallaIngreso
import uy.flashurbano.repartidor.pantallas.PantallaPedidos
import uy.flashurbano.repartidor.pantallas.RepartidorViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
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
 * **Sin biblioteca de navegacion**: son tres pantallas y una de ellas se ve una
 * vez en la vida. Traer `navigation-compose` para esto seria la misma decision
 * que Retrofit para dos llamadas (research D4).
 */
@Composable
fun AppRepartidor(vm: RepartidorViewModel = viewModel()) {
    val destino by vm.destino.collectAsState()
    val pantalla by vm.pantalla.collectAsState()
    val ingreso by vm.ingreso.collectAsState()

    var viendoEntregados by remember { mutableStateOf(false) }

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
            val entregados = (pantalla as? EstadoPantalla.Hay)?.entregados.orEmpty()
            if (viendoEntregados) {
                // El boton fisico de atras vuelve al trabajo, que es lo que
                // espera cualquiera. Sin esto, "atras" cierra la app desde una
                // pantalla de consulta.
                BackHandler { viendoEntregados = false }
                PantallaEntregados(entregados) { viendoEntregados = false }
            } else {
                PantallaPedidos(
                    estado = pantalla,
                    alReintentar = vm::cargar,
                    alVerEntregados = { viendoEntregados = true },
                )
            }
        }
    }
}
