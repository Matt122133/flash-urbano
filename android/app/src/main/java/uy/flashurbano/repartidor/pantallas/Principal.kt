package uy.flashurbano.repartidor.pantallas

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import uy.flashurbano.repartidor.datos.Direccion
import uy.flashurbano.repartidor.datos.Estados
import uy.flashurbano.repartidor.datos.Pedido
import uy.flashurbano.repartidor.datos.esEstadoConocido
import uy.flashurbano.repartidor.datos.fechaCorta
import uy.flashurbano.repartidor.datos.Seccion
import uy.flashurbano.repartidor.ui.tema.Toques

/**
 * La pantalla donde Diego trabaja: **una lista, y la barra de destinos abajo**.
 *
 * Hasta `014` esto eran dos secciones que scrolleaban juntas, con Entregados
 * detras de un boton al final de la lista. Desde `015` cada seccion es una
 * pestana y desplazar sirve solo para recorrer paquetes.
 *
 * El `Scaffold` no es decoracion: es lo que mantiene la barra **fija en el
 * borde inferior** mientras la lista se desplaza, que es FR-002. Sin el, la
 * barra se iria con el scroll y volveriamos al problema que este feature
 * arregla.
 */
@Composable
fun PantallaPedidos(
    estado: EstadoPantalla,
    seccion: Seccion,
    moviendo: Set<String>,
    aviso: String,
    deshacer: Deshacer?,
    sinRed: Boolean,
    alElegirSeccion: (Seccion) -> Unit,
    alReintentar: () -> Unit,
    alMover: (Pedido, String) -> Unit,
    alDescartarAviso: () -> Unit,
    alRevertir: (Deshacer) -> Unit,
    alDescartarDeshacer: () -> Unit,
) {
    // Los numeros de los badges salen de la MISMA lista que ya se cargo, no de
    // una consulta aparte: son `size` sobre lo que la pantalla ya tiene.
    val hay = estado as? EstadoPantalla.Hay
    val hostDeAvisos = remember { SnackbarHostState() }

    // **El aviso aparece sobre la pestana donde Diego ESTA**, no sobre la
    // pestana a la que se fue el pedido (research D6). La alternativa —saltar a
    // En curso al mover— parece util y es peor: Diego esta parado en una puerta
    // procesando pendientes, y moverle la pantalla debajo del dedo es la forma
    // mas rapida de que toque lo que no queria.
    LaunchedEffect(deshacer) {
        val cual = deshacer ?: return@LaunchedEffect
        val resultado = hostDeAvisos.showSnackbar(
            message = cual.codigo + " pasó a " + tituloDe(cual.adonde),
            actionLabel = "Deshacer",
            withDismissAction = false,
            duration = SnackbarDuration.Long,
        )
        if (resultado == SnackbarResult.ActionPerformed) {
            alRevertir(cual)
        } else {
            alDescartarDeshacer()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostDeAvisos) },
        bottomBar = {
            BarraDestinos(
                elegida = seccion,
                pendientes = hay?.pendientes?.size ?: 0,
                enCurso = hay?.tomados?.size ?: 0,
                alElegir = alElegirSeccion,
            )
        },
    ) { hueco ->
        Column(modifier = Modifier.fillMaxSize().padding(hueco)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // El titulo dice en que pestana estas. **Es tambien el motivo
                // por el que el estado crudo salio de la tarjeta** (FR-011):
                // repetirlo en cada pedido seria decir dos veces lo mismo.
                Text(tituloDe(seccion), style = MaterialTheme.typography.headlineMedium)
                // FR-010: la lista se actualiza sin cerrar y volver a abrir.
                TextButton(
                    onClick = alReintentar,
                    modifier = Modifier.defaultMinSize(minHeight = Toques.ACTUALIZAR),
                ) { Text("Actualizar") }
            }

            // **La franja de sin conexion: no rompe la pantalla** (FR-016).
            // Lo que ya se bajo se sigue viendo abajo; esto solo avisa que puede
            // estar viejo y que no se puede mover nada.
            if (sinRed) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.inverseSurface,
                    contentColor = MaterialTheme.colorScheme.inverseOnSurface,
                ) {
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
                        Text(
                            "Sin conexión",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "Esto es lo último que bajamos. No vas a poder mover pedidos hasta que vuelva.",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }

            // Lo que no se pudo mover se dice ACA y no con un cartel que se va
            // solo: en la calle, un aviso de dos segundos es un aviso que nadie
            // vio.
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

                // **Nunca una lista vacia cuando lo que paso es que no se
                // pudo** (contrato seccion 5). Una lista vacia dice "no tenes
                // trabajo", y eso es peor que un error visible.
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
                is EstadoPantalla.Vacia -> SeccionVacia(seccion)

                is EstadoPantalla.HayQueIngresar -> Centrado {
                    Text("La sesión venció", style = MaterialTheme.typography.titleLarge)
                }

                is EstadoPantalla.Hay -> {
                    val pedidos = when (seccion) {
                        Seccion.PENDIENTES -> estado.pendientes
                        Seccion.TOMADOS -> estado.tomados
                        Seccion.ENTREGADOS -> estado.entregados
                    }

                    if (pedidos.isEmpty()) {
                        SeccionVacia(seccion)
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(
                                start = 16.dp,
                                end = 16.dp,
                                bottom = 24.dp,
                            ),
                        ) {
                            items(pedidos, key = { it.id }) { pedido ->
                                TarjetaPedido(pedido) {
                                    AccionesDe(
                                        seccion = seccion,
                                        pedido = pedido,
                                        yendo = moviendo.contains(pedido.id),
                                        // Sin red la accion se ve apagada ANTES
                                        // de tocarla, en vez de fallar al tocar.
                                        habilitada = !sinRed,
                                        alMover = alMover,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** El titulo de la pestana. Los mismos nombres que la barra de abajo. */
private fun tituloDe(seccion: Seccion): String = when (seccion) {
    Seccion.PENDIENTES -> "Pendientes"
    Seccion.TOMADOS -> "En curso"
    Seccion.ENTREGADOS -> "Entregados"
}

/**
 * Una seccion sin nada, dicho de la forma que corresponde a ESA seccion.
 *
 * **Tres textos distintos y no uno generico** (FR-015): "no hay pedidos nuevos"
 * y "no llevas nada encima" son dos noticias distintas, y la segunda ademas es
 * buena. Un unico "No hay pedidos" para las tres le hace decir a la pantalla
 * menos de lo que sabe.
 */
@Composable
private fun SeccionVacia(seccion: Seccion) {
    val titulo: String
    val detalle: String
    when (seccion) {
        Seccion.PENDIENTES -> {
            titulo = "No hay nada pendiente"
            detalle = "Cuando alguien cargue un pedido en la web, te aparece acá."
        }
        Seccion.TOMADOS -> {
            titulo = "No llevás nada encima"
            detalle = "Cuando marques un pedido como tuyo, va a estar acá."
        }
        Seccion.ENTREGADOS -> {
            titulo = "Todavía no entregaste ninguno"
            detalle = "Los que cierres quedan acá para consultarlos."
        }
    }

    Centrado {
        Text(titulo, style = MaterialTheme.typography.titleLarge)
        Text(
            detalle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

/**
 * Que se puede hacer con un pedido, segun donde este.
 *
 * Reemplaza al llamado directo a `Acciones` que hacia cada lista en `012`,
 * pasandole los dos estados a mano. Aca la seccion ya dice todo: **desde
 * Pendientes no hay para donde volver** —es donde el pedido nace— y desde
 * Entregados no hay para donde avanzar.
 */
@Composable
private fun AccionesDe(
    seccion: Seccion,
    pedido: Pedido,
    yendo: Boolean,
    habilitada: Boolean,
    alMover: (Pedido, String) -> Unit,
) {
    when (seccion) {
        Seccion.PENDIENTES -> Acciones(
            pedido = pedido,
            yendo = yendo,
            habilitada = habilitada,
            avanzar = "Lo tengo" to Estados.ACEPTACION,
            deshacer = null,
            alMover = alMover,
        )

        Seccion.TOMADOS -> Acciones(
            pedido = pedido,
            yendo = yendo,
            habilitada = habilitada,
            avanzar = "Entregado" to Estados.ENTREGA,
            deshacer = "Deshacer" to Estados.CREACION,
            alMover = alMover,
        )

        // Un entregado no tiene para donde avanzar; lo unico que puede hacer
        // falta es corregir un toque de mas.
        Seccion.ENTREGADOS -> Acciones(
            pedido = pedido,
            yendo = yendo,
            habilitada = habilitada,
            avanzar = null,
            deshacer = "Deshacer" to Estados.ACEPTACION,
            alMover = alMover,
        )
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



/**
 * Un pedido, con todo lo que hace falta sin desplegar nada (contrato 4.2).
 *
 * **Pasa de ~380 px a ~250, y ese es el arreglo del pulgar.** Con la tarjeta
 * larga entraba una y un cachito: el boton del segundo pedido quedaba fuera de
 * pantalla, y el del primero quedaba arriba de todo despues de desplazar. Con
 * esta entran dos y media, asi que **siempre hay una accion cerca del pulgar**.
 *
 * De donde salieron los 130 px, y ninguno de esconder informacion:
 *
 *  - el tamano y la hora se fueron porque desde `014` dicen `chico` y `16:00`
 *    en todos los pedidos: ocupaban lugar sin decir nada;
 *  - los rotulos "Retira en" y "Lleva a" —dos lineas cada uno— pasaron a una
 *    flecha al costado del texto: naranja sube, azul baja;
 *  - los dos telefonos eran seis lineas apiladas y ahora son dos botones lado a
 *    lado, que ademas **se ven tocables sin probarlos**, que era FR-010.
 *
 * **Nada se plego.** El contrato 4.2 dice que la tarjeta muestra todo sin
 * desplegar y no se toca: Diego no puede tener que tocar para leer una
 * direccion parado en una puerta.
 */
@Composable
fun TarjetaPedido(pedido: Pedido, debajo: @Composable () -> Unit = {}) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(modifier = Modifier.padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 10.dp)) {

            // Codigo, cuantos bultos y para cuando. Los tres datos que ordenan
            // la jornada, en una sola linea.
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    pedido.codigo,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Pastilla(bultos(pedido.cantidad))
                    Text(
                        fechaCorta(pedido.retiroFecha),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }

            Direccion(IconoSale, "RETIRA", comoTexto(pedido.retiro), naranja = true)
            Direccion(IconoLlega, "ENTREGA", comoTexto(pedido.entrega), naranja = false)

            // Los DOS telefonos, del mismo tamano y los dos tocables (FR-015 de
            // `012`). Quien envia hace falta tanto como quien recibe: si el
            // paquete no esta donde dijeron, a quien se llama es a quien lo
            // mando.
            Row(modifier = Modifier.padding(top = 10.dp)) {
                BotonTelefono(
                    rotulo = "ENVÍA",
                    nombre = pedido.remitenteNombre,
                    numero = pedido.remitenteTelefono,
                    modifier = Modifier.weight(1f),
                )
                Spacer(modifier = Modifier.width(8.dp))
                BotonTelefono(
                    rotulo = "RECIBE",
                    nombre = pedido.destinatarioNombre,
                    numero = pedido.destinatarioTelefono,
                    modifier = Modifier.weight(1f),
                )
            }

            // **El estado crudo, solo si la app no lo conoce** (FR-011).
            //
            // `012` lo mostraba SIEMPRE, y tenia razon para su pantalla: era la
            // unica senal de que habia entrado un estado raro. Con pestanas, la
            // pestana ya dice el estado en el caso normal, asi que repetirlo en
            // cada tarjeta es decir dos veces lo mismo en el lugar donde menos
            // sobra el espacio.
            //
            // Lo que NO se perdio es el motivo: si el servicio suma un cuarto
            // estado antes que la app, ese pedido cae en Pendientes **y se ve
            // que es raro**.
            if (!esEstadoConocido(pedido.estado)) {
                Text(
                    "Estado desconocido: " + pedido.estado,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }

        debajo()
    }
}

/** "2 paquetes", en la pastilla azul al lado del codigo. */
private fun bultos(cantidad: Int): String =
    if (cantidad == 1) "1 paquete" else cantidad.toString() + " paquetes"

@Composable
private fun Pastilla(texto: String) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        shape = RoundedCornerShape(999.dp),
    ) {
        Text(
            texto,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
        )
    }
}

/**
 * Una de las dos direcciones, con su flecha.
 *
 * La flecha hace el trabajo que hacia el rotulo de dos lineas: **naranja que
 * sube es de donde sale, azul que baja es a donde va**. Se distinguen sin leer,
 * que es lo que hace falta mirando el telefono de reojo.
 */
@Composable
private fun Direccion(
    icono: androidx.compose.ui.graphics.vector.ImageVector,
    rotulo: String,
    valor: String,
    naranja: Boolean,
) {
    Row(modifier = Modifier.padding(top = 7.dp)) {
        Icon(
            icono,
            contentDescription = null,
            tint = if (naranja) {
                MaterialTheme.colorScheme.secondary
            } else {
                MaterialTheme.colorScheme.primary
            },
            modifier = Modifier.size(18.dp).padding(top = 1.dp),
        )
        Column(modifier = Modifier.padding(start = 9.dp)) {
            Text(
                rotulo,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(valor, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

/**
 * Un telefono, como boton.
 *
 * Hasta `014` esto era texto subrayado, y en una lista de texto subrayado no se
 * distingue de un enlace muerto. Ahora tiene fondo, borde e icono: **se ve
 * tocable sin probarlo** (FR-010).
 *
 * Sigue siendo `ACTION_DIAL` y no `ACTION_CALL`, decidido en `012`: abre el
 * marcador con el numero puesto y deja que la persona toque llamar. **No llama
 * solo** por un toque de mas con guantes.
 *
 * Sin numero, el boton no es tocable y se ve que no lo es.
 */
@Composable
private fun BotonTelefono(
    rotulo: String,
    nombre: String,
    numero: String,
    modifier: Modifier = Modifier,
) {
    val contexto = LocalContext.current
    val hay = numero.isNotBlank()

    Surface(
        modifier = modifier
            .defaultMinSize(minHeight = Toques.TELEFONO)
            .clickable(enabled = hay) {
                contexto.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + numero)))
            },
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                IconoTelefono,
                contentDescription = null,
                tint = if (hay) {
                    MaterialTheme.colorScheme.tertiary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
                modifier = Modifier.size(18.dp),
            )
            Column(modifier = Modifier.padding(start = 8.dp)) {
                Text(
                    rotulo,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    if (hay) nombre.ifBlank { numero } else "sin teléfono",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
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

/**
 * Lo que se puede hacer con un pedido, en el borde inferior de su tarjeta.
 *
 * **La accion es la franja entera, no un boton adentro** (FR-012). Antes era un
 * `Button` al final de una tarjeta de 380 px: cuando estaba a la vista, estaba
 * arriba en la pantalla. Ahora la tarjeta mide 250 y su borde inferior es el
 * objetivo — mas grande, mas abajo, y imposible de errar con el pulgar.
 *
 * **Deshacer sigue siendo secundario** (contrato 4.4 de `012`). Lo que avanza
 * tiene que ser lo facil de tocar; volver atras no puede tocarse sin querer
 * justo cuando se queria evitar. Por eso uno es la franja y el otro un texto
 * chico arriba, corrido a un costado.
 *
 * Sin seleccion multiple: los paquetes se levantan de a uno, y una casilla por
 * pedido invita a marcar cinco de una y equivocarse en tres.
 */
@Composable
private fun Acciones(
    pedido: Pedido,
    yendo: Boolean,
    habilitada: Boolean,
    avanzar: Pair<String, String>?,
    deshacer: Pair<String, String>?,
    alMover: (Pedido, String) -> Unit,
) {
    // **`yendo` y `habilitada` no son lo mismo, y confundirlos miente.**
    //
    // La primera version de esta pantalla uso `yendo` para las dos cosas, y sin
    // red las acciones mostraban un spinner: "espera que esta yendo", cuando no
    // estaba yendo nada y no iba a ir. Un indicador de progreso es una promesa
    // de que algo esta pasando.
    //
    // `yendo` es el pedido viajando al servicio: gira. `habilitada` es si se
    // puede tocar: apagada, se ve gris con su texto.
    val sePuedeTocar = habilitada && !yendo
    if (deshacer != null) {
        TextButton(
            onClick = { alMover(pedido, deshacer.second) },
            enabled = sePuedeTocar,
            modifier = Modifier.padding(start = 6.dp, bottom = 2.dp),
        ) { Text(deshacer.first) }
    }

    if (avanzar == null) return

    // El verde es de "cerrado", no de marca: distingue entregar de tomar sin
    // tener que leer el boton.
    val fondo = if (avanzar.second == Estados.ENTREGA) {
        MaterialTheme.colorScheme.tertiary
    } else {
        MaterialTheme.colorScheme.primary
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = Toques.ACCION)
            // **Apagado mientras viaja.** Es la mitad visible de FR-008: hasta
            // que el servicio conteste no hay nada hecho, y volver a tocar manda
            // una segunda peticion que puede llegar despues de un deshacer y
            // pisarlo.
            .clickable(enabled = sePuedeTocar) { alMover(pedido, avanzar.second) },
        color = if (sePuedeTocar) fondo else MaterialTheme.colorScheme.outline,
        contentColor = MaterialTheme.colorScheme.onPrimary,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (yendo) {
                CircularProgressIndicator(
                    modifier = Modifier.size(22.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            } else {
                Text(
                    avanzar.first,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
