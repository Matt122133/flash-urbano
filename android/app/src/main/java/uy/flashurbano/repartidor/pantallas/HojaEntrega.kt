package uy.flashurbano.repartidor.pantallas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import uy.flashurbano.repartidor.datos.Pedido
import uy.flashurbano.repartidor.ui.tema.Toques

/**
 * Quien recibio el paquete.
 *
 * Diego entrega, y **a veces no recibe la persona que figura en el pedido**: lo
 * atiende la madre, un vecino, el encargado. Hasta `016` eso no quedaba en
 * ningun lado, y es justo el caso en el que alguien reclama despues.
 *
 * ## El caso comun es UN TOQUE, y es la decision que ordena la pantalla
 *
 * La mayoria de las veces recibe quien figura. Si eso costara escribir un
 * nombre, este feature **empeoraria la app**: Diego esta parado en una puerta
 * con un paquete en una mano y el telefono en la otra.
 *
 * Por eso la propuesta es un boton grande arriba, y el camino de escribir otro
 * nombre queda abajo, separado por una linea. No son dos opciones equivalentes:
 * una es el camino y la otra la excepcion, y la pantalla lo dice con el tamaño.
 *
 * ## La cedula es opcional, y se ve que lo es
 *
 * Si quien recibe no la da, la entrega se registra igual (FR-006). Exigirla
 * trabaria una entrega **que ya ocurrio**, con la persona en la puerta. El
 * rotulo lo dice —"si te la dan"— en vez de dejarlo a que alguien lo descubra
 * probando.
 */
// `ModalBottomSheet` sigue marcada como experimental en Material 3. Se acepta a
// ojos abiertos: es el componente estandar para esto y la alternativa seria
// dibujar una hoja a mano, con su animacion, su arrastre y su manejo de foco.
// Si cambia de API, cambia en un solo archivo.
private fun direccionCorta(pedido: Pedido): String {
    val d = pedido.entrega
    val esquina = if (d.esquina.isBlank()) "" else " esq. " + d.esquina
    val numero = d.numero?.takeIf { it.isNotBlank() }?.let { " " + it } ?: ""
    return d.calle + esquina + numero
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaEntrega(
    pedido: Pedido,
    alCancelar: () -> Unit,
    alConfirmar: (nombre: String, documento: String) -> Unit,
) {
    var nombre by remember { mutableStateOf("") }
    var documento by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = alCancelar) {
        Column(
            modifier = Modifier.padding(start = 18.dp, end = 18.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Column {
                Text(
                    "¿Quién lo recibió?",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    pedido.codigo + " · " + direccionCorta(pedido),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // EL CAMINO CORTO. Un toque, y es lo que pasa casi siempre.
            //
            // Manda **el nombre del destinatario copiado**, no una marca de "el
            // mismo" (research D4): dentro de seis meses el historial tiene que
            // contestar quien recibio sin ir a buscar como se llamaba el
            // destinatario del pedido entonces — que ademas pudo cambiar.
            Surface(
                onClick = { alConfirmar(pedido.destinatarioNombre, "") },
                enabled = pedido.destinatarioNombre.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 64.dp),
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        modifier = Modifier.size(40.dp),
                        shape = RoundedCornerShape(20.dp),
                        color = MaterialTheme.colorScheme.primary,
                    ) {
                        Icon(
                            IconoTilde,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.padding(9.dp),
                        )
                    }
                    Column(modifier = Modifier.padding(start = 12.dp)) {
                        Text(
                            "Lo recibió " + pedido.destinatarioNombre.ifBlank { "quien figura" },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "La persona que figura en el pedido",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                HorizontalDivider(modifier = Modifier.weight(1f))
                Text(
                    "o lo recibió otra persona",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 10.dp),
                )
                HorizontalDivider(modifier = Modifier.weight(1f))
            }

            OutlinedTextField(
                value = nombre,
                onValueChange = { nombre = it },
                label = { Text("Nombre de quien recibió") },
                placeholder = { Text("Ej. Susana, la madre") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = documento,
                onValueChange = { documento = it },
                label = { Text("Cédula") },
                // **El rotulo dice que es opcional.** Un campo sin marcar se lee
                // como obligatorio, y eso llevaria a Diego a insistirle a alguien
                // que no la quiere dar.
                supportingText = { Text("Si te la dan") },
                placeholder = { Text("1.234.567-8") },
                singleLine = true,
                // Teclado numerico, no de texto: la cedula son digitos, puntos y
                // un guion. Y se escribe con una mano.
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )

            Button(
                onClick = { alConfirmar(nombre, documento) },
                // Sin nombre no se puede confirmar por este camino (FR-007). El
                // servicio tambien lo rechaza; que el boton este apagado evita
                // que Diego se entere por un error despues de haber entregado.
                enabled = nombre.isBlank().not(),
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = Toques.ACCION),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.tertiary,
                    contentColor = MaterialTheme.colorScheme.onTertiary,
                ),
            ) {
                Text(
                    "Confirmar entrega",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
            }

            Text(
                "Queda guardado con el pedido.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
