package uy.flashurbano.repartidor.pantallas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import uy.flashurbano.repartidor.datos.Pedido

/**
 * Los entregados, **fuera de la pantalla principal** (FR-013, contrato 4.3).
 *
 * Es la unica lista que crece sin limite y sirve para consultar, no para
 * trabajar. Meterla en la principal la haria mas larga todos los dias sin que
 * nada de eso sea trabajo pendiente.
 *
 * Que exista esta pantalla no es opcional: **sin ella los pedidos entregados
 * desaparecen sin donde verse**, y Diego pierde la forma de contestar "si, ese
 * lo dejé el martes".
 */
@Composable
fun PantallaEntregados(pedidos: List<Pedido>, alVolver: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Entregados", style = MaterialTheme.typography.headlineMedium)
            TextButton(onClick = alVolver) { Text("Volver") }
        }

        if (pedidos.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("Todavia no entregaste ninguno", style = MaterialTheme.typography.titleLarge)
            }
            return@Column
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
        ) {
            items(pedidos, key = { it.id }) { TarjetaPedido(it) }
        }
    }
}
