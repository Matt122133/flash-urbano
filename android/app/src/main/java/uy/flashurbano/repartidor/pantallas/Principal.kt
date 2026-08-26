package uy.flashurbano.repartidor.pantallas

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import uy.flashurbano.repartidor.datos.Direccion
import uy.flashurbano.repartidor.datos.Estados
import uy.flashurbano.repartidor.datos.Pedido

/**
 * La pantalla donde Diego trabaja.
 *
 * **Dos secciones y en este orden: Pendientes y Tomados** (FR-013). Entregados
 * vive fuera, porque es la unica lista que crece sin limite y sirve para
 * consultar, no para trabajar.
 */
@Composable
fun PantallaPedidos(
    estado: EstadoPantalla,
    moviendo: Set<String>,
    aviso: String,
    alReintentar: () -> Unit,
    alVerEntregados: () -> Unit,
    alMover: (Pedido, String) -> Unit,
    alDescartarAviso: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Pedidos", style = MaterialTheme.typography.headlineMedium)
            // FR-010: la lista se actualiza sin cerrar y volver a abrir la app.
            TextButton(onClick = alReintentar) { Text("Actualizar") }
        }

        // Lo que no se pudo mover se dice ACA y no con un cartel que se va
        // solo: en la calle, un aviso de dos segundos es un aviso que nadie vio.
        if (aviso.isNotBlank()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    aviso,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = alDescartarAviso) { Text("Ok") }
            }
        }

        when (estado) {
            is EstadoPantalla.Cargando -> Centrado {
                CircularProgressIndicator()
            }

            // **Nunca una lista vacia cuando lo que paso es que no se pudo**
            // (contrato seccion 5). Una lista vacia dice "no tenes trabajo", y
            // eso es peor que un error visible.
            is EstadoPantalla.NoSePudo -> Centrado {
                Text(
                    "No se pudieron traer los pedidos",
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    mensajeDe(estado.motivo, estado.detalle),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Button(
                    onClick = alReintentar,
                    modifier = Modifier.padding(top = 24.dp).height(56.dp),
                ) { Text("Reintentar") }
            }

            // Y esto tiene que leerse DISTINTO de lo de arriba.
            is EstadoPantalla.Vacia -> Centrado {
                Text("No hay pedidos", style = MaterialTheme.typography.titleLarge)
                Text(
                    "Cuando entre uno nuevo aparece acá.",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            is EstadoPantalla.HayQueIngresar -> Centrado {
                Text("La sesión venció", style = MaterialTheme.typography.titleLarge)
            }

            is EstadoPantalla.Hay -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
            ) {
                item { Encabezado("Pendientes", estado.pendientes.size) }
                if (estado.pendientes.isEmpty()) {
                    item { Aviso("Nada pendiente.") }
                }
                items(estado.pendientes, key = { it.id }) { pedido ->
                    TarjetaPedido(pedido) {
                        Acciones(
                            pedido = pedido,
                            yendo = moviendo.contains(pedido.id),
                            avanzar = "Ya lo tengo" to Estados.ACEPTACION,
                            // Desde Pendientes no hay para donde volver: es el
                            // estado en el que nace el pedido.
                            deshacer = null,
                            alMover = alMover,
                        )
                    }
                }

                item { Encabezado("Tomados", estado.tomados.size) }
                if (estado.tomados.isEmpty()) {
                    item { Aviso("No tenés nada en la mano.") }
                }
                items(estado.tomados, key = { it.id }) { pedido ->
                    TarjetaPedido(pedido) {
                        Acciones(
                            pedido = pedido,
                            yendo = moviendo.contains(pedido.id),
                            avanzar = "Entregado" to Estados.ENTREGA,
                            deshacer = "Deshacer" to Estados.CREACION,
                            alMover = alMover,
                        )
                    }
                }

                item {
                    TextButton(
                        onClick = alVerEntregados,
                        modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                    ) { Text("Ver entregados (" + estado.entregados.size + ")") }
                }
            }
        }
    }
}

@Composable
private fun Centrado(contenido: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
        content = contenido,
    )
}

@Composable
private fun Encabezado(titulo: String, cuantos: Int) {
    Column(modifier = Modifier.padding(top = 24.dp, bottom = 8.dp)) {
        Text(
            titulo + " (" + cuantos + ")",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        HorizontalDivider(modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun Aviso(texto: String) {
    Text(
        texto,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.padding(vertical = 8.dp),
    )
}

/**
 * Un pedido, con todo lo que hace falta sin desplegar nada (contrato 4.2):
 * codigo, las dos direcciones, tamano y cantidad, y **los dos telefonos**.
 *
 * `debajo` es donde la fase siguiente cuelga el boton que mueve el estado. Se
 * deja abierto para que la tarjeta sea la misma en las tres secciones.
 */
@Composable
fun TarjetaPedido(pedido: Pedido, debajo: @Composable () -> Unit = {}) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    pedido.codigo,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    pedido.paqueteTamano + " x" + pedido.cantidad,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            Linea("Retira en", comoTexto(pedido.retiro))
            Linea("Lleva a", comoTexto(pedido.entrega))

            // Los DOS telefonos, y tocables para llamar (FR-015). Quien envia
            // hace falta tanto como quien recibe: si el paquete no esta donde
            // dijeron, a quien se llama es a quien lo mando.
            Telefono("Envia", pedido.remitenteNombre, pedido.remitenteTelefono)
            Telefono("Recibe", pedido.destinatarioNombre, pedido.destinatarioTelefono)

            Text(
                "Retiro " + pedido.retiroFecha + " " + pedido.retiroHora,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 8.dp),
            )

            // El estado crudo, y se muestra siempre. Si algun dia llega uno que
            // la app no conoce, se ve que pasa algo raro en vez de disimularlo.
            Text("Estado: " + pedido.estado, style = MaterialTheme.typography.bodySmall)

            debajo()
        }
    }
}

/**
 * La direccion tal como se escribio.
 *
 * **No se usa el punto para nada aca, y por eso un pedido sin punto se lee
 * igual** (data-model seccion 5). Lo que Diego necesita para llegar es el texto.
 */
private fun comoTexto(d: Direccion): String = buildString {
    append(d.calle)
    if (d.esquina.isNotBlank()) append(" esq. ").append(d.esquina)
    d.numero?.takeIf { it.isNotBlank() }?.let { append(" ").append(it) }
    d.apto?.takeIf { it.isNotBlank() }?.let { append(" apto ").append(it) }
    if (d.cooperativa) append(" (cooperativa)")
}

@Composable
private fun Linea(rotulo: String, valor: String) {
    Column(modifier = Modifier.padding(top = 8.dp)) {
        Text(rotulo, style = MaterialTheme.typography.labelMedium)
        Text(valor, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun Telefono(rotulo: String, nombre: String, numero: String) {
    val contexto = LocalContext.current
    val titulo = if (nombre.isBlank()) rotulo else rotulo + " - " + nombre
    Column(modifier = Modifier.padding(top = 8.dp)) {
        Text(titulo, style = MaterialTheme.typography.labelMedium)
        Text(
            if (numero.isBlank()) "sin teléfono" else numero,
            style = MaterialTheme.typography.bodyLarge,
            textDecoration = if (numero.isBlank()) null else TextDecoration.Underline,
            modifier = Modifier
                .padding(vertical = 4.dp)
                .clickable(enabled = numero.isNotBlank()) {
                    // ACTION_DIAL y no ACTION_CALL: abre el marcador con el
                    // numero puesto y deja que la persona toque llamar. No
                    // necesita permiso, y sobre todo **no llama solo** por un
                    // toque de mas con guantes.
                    contexto.startActivity(
                        Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + numero))
                    )
                },
        )
    }
}

/**
 * Lo que se puede hacer con un pedido desde su tarjeta.
 *
 * **Un boton grande que avanza, y nada mas** (FR-012). Sin seleccion multiple:
 * los paquetes se levantan de a uno, y una casilla por pedido invita a marcar
 * cinco de una y equivocarse en tres.
 *
 * **Deshacer es una accion SECUNDARIA** (contrato 4.4). Lo que avanza tiene que
 * ser lo facil de tocar; volver atras no puede tocarse sin querer justo cuando
 * se queria evitar. Por eso uno es un `Button` de 56dp de alto y el otro un
 * `TextButton` chico y corrido a un costado.
 */
@Composable
private fun Acciones(
    pedido: Pedido,
    yendo: Boolean,
    avanzar: Pair<String, String>,
    deshacer: Pair<String, String>?,
    alMover: (Pedido, String) -> Unit,
) {
    Column(modifier = Modifier.padding(top = 16.dp)) {
        Button(
            onClick = { alMover(pedido, avanzar.second) },
            // **Apagado mientras viaja.** Es la mitad visible de FR-008: hasta
            // que el servicio conteste no hay nada hecho, y volver a tocar
            // manda una segunda peticion que puede llegar despues de un
            // deshacer y pisarlo.
            enabled = !yendo,
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) {
            if (yendo) {
                CircularProgressIndicator(
                    modifier = Modifier.height(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            } else {
                Text(avanzar.first, style = MaterialTheme.typography.titleMedium)
            }
        }

        if (deshacer != null) {
            TextButton(
                onClick = { alMover(pedido, deshacer.second) },
                enabled = !yendo,
                modifier = Modifier.padding(top = 4.dp),
            ) { Text(deshacer.first) }
        }
    }
}
