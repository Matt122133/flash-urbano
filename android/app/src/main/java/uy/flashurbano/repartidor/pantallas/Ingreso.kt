package uy.flashurbano.repartidor.pantallas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

/**
 * Mail, codigo, y adentro. **Se ve una vez en la vida** (contrato seccion 4.1).
 *
 * No aparece nunca mas mientras la sesion se renueve sola, que es US3.
 */
@Composable
fun PantallaIngreso(
    estado: EstadoIngreso,
    motivo: String,
    alEscribirMail: (String) -> Unit,
    alEscribirCodigo: (String) -> Unit,
    alPedirCodigo: () -> Unit,
    alVerificar: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Flash Urbano", style = MaterialTheme.typography.headlineLarge)
        Text("Pedidos del día", style = MaterialTheme.typography.titleMedium)

        // El motivo por el que se volvio al ingreso, cuando lo hay. Sin esto,
        // una sesion vencida se ve como si la app se hubiera reiniciado sola.
        if (motivo.isNotBlank()) {
            Text(
                motivo,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 16.dp),
            )
        }

        OutlinedTextField(
            value = estado.mail,
            onValueChange = alEscribirMail,
            label = { Text("Mail") },
            singleLine = true,
            enabled = !estado.codigoPedido && !estado.trabajando,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
        )

        if (estado.codigoPedido) {
            Text(
                "Te mandamos un código por mail.",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 16.dp),
            )
            OutlinedTextField(
                value = estado.codigo,
                onValueChange = alEscribirCodigo,
                label = { Text("Código") },
                singleLine = true,
                enabled = !estado.trabajando,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
        }

        if (estado.error.isNotBlank()) {
            Text(
                estado.error,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 16.dp),
            )
        }

        // Boton grande, como todo en esta app: se usa con una mano, en la calle.
        Button(
            onClick = { if (estado.codigoPedido) alVerificar() else alPedirCodigo() },
            enabled = !estado.trabajando,
            // **El padding VA PRIMERO.** Puesto despues del `height`, los 24dp se
            // descuentan de los 56 en vez de separar el boton de lo de arriba, y el
            // texto queda cortado por abajo. Se vio en el emulador, no compilando.
            modifier = Modifier.padding(top = 24.dp).fillMaxWidth().height(56.dp),
        ) {
            if (estado.trabajando) {
                CircularProgressIndicator(modifier = Modifier.height(24.dp))
            } else {
                Text(if (estado.codigoPedido) "Entrar" else "Mandame el código")
            }
        }

        // Esta pantalla **se ve una vez en la vida**, asi que por si sola no
        // alcanzaria para que Diego pueda decir que version tiene. Por eso el
        // mismo pie va tambien al final de la lista de pedidos, que es lo que
        // el si mira todos los dias.
        PieDeVersion()
    }
}
