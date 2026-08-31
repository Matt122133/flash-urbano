package uy.flashurbano.repartidor.pantallas

import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import uy.flashurbano.repartidor.datos.Seccion
import uy.flashurbano.repartidor.ui.tema.Toques

/**
 * La barra de destinos, abajo.
 *
 * **Es el arreglo central de `015`.** Hasta `014` las secciones se pasaban
 * desplazando: Pendientes y Tomados compartian una pantalla que scrollea, y
 * Entregados vivia detras de un boton **al final de esa lista**, o sea que
 * despues de desplazar quedaba arriba de todo — el punto mas lejos del pulgar de
 * cualquier telefono. Diego usa esto con una mano, con la otra ocupada por un
 * paquete. Desplazar es para recorrer paquetes; cambiar de seccion se toca.
 *
 * **Sin `androidx.navigation`** (research D1): son tres listas hermanas del
 * mismo `ViewModel`. Un grafo de navegacion aportaria rutas, argumentos y un
 * back stack para elegir cual de tres se dibuja.
 */
@Composable
fun BarraDestinos(
    elegida: Seccion,
    pendientes: Int,
    enCurso: Int,
    alElegir: (Seccion) -> Unit,
) {
    NavigationBar {
        Destino(
            seccion = Seccion.PENDIENTES,
            elegida = elegida,
            etiqueta = "Pendientes",
            icono = IconoPendientes,
            cuantos = pendientes,
            alElegir = alElegir,
        )
        Destino(
            seccion = Seccion.TOMADOS,
            elegida = elegida,
            etiqueta = "En curso",
            icono = IconoEnCurso,
            cuantos = enCurso,
            alElegir = alElegir,
        )
        // **Entregados NO lleva numero, y es una decision, no un olvido.**
        //
        // Es la unica lista que crece sin limite: un badge ahi solo sube, nunca
        // significa "hay algo que hacer", y en una semana deja de mirarse. Peor
        // todavia, le quita fuerza a los dos que si importan. Los badges quedan
        // donde un numero es trabajo.
        Destino(
            seccion = Seccion.ENTREGADOS,
            elegida = elegida,
            etiqueta = "Entregados",
            icono = IconoEntregados,
            cuantos = null,
            alElegir = alElegir,
        )
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.Destino(
    seccion: Seccion,
    elegida: Seccion,
    etiqueta: String,
    icono: ImageVector,
    cuantos: Int?,
    alElegir: (Seccion) -> Unit,
) {
    val estaElegido = seccion == elegida

    NavigationBarItem(
        selected = estaElegido,
        onClick = { alElegir(seccion) },
        modifier = Modifier
            .defaultMinSize(minHeight = Toques.DESTINO)
            .semantics {
                // Que el lector de pantalla diga cuantos hay, no solo el nombre.
                contentDescription = when {
                    cuantos == null -> etiqueta
                    cuantos == 1 -> "$etiqueta, 1 pedido"
                    else -> "$etiqueta, $cuantos pedidos"
                }
            },
        icon = {
            if (cuantos != null && cuantos > 0) {
                BadgedBox(
                    badge = {
                        Badge(
                            // Naranja de marca con texto OSCURO encima.
                            //
                            // El blanco es lo que sale por reflejo sobre un
                            // color fuerte y da 2.80:1 — no se lee al sol. Lo
                            // caza `ContrasteTest`, que fue lo que corrigio esto
                            // antes de que llegara a la pantalla.
                            containerColor = MaterialTheme.colorScheme.secondary,
                            contentColor = MaterialTheme.colorScheme.onSecondary,
                        ) { Text(cuantos.toString()) }
                    },
                ) { Icon(icono, contentDescription = null) }
            } else {
                Icon(icono, contentDescription = null)
            }
        },
        label = { Text(etiqueta) },
        alwaysShowLabel = true,
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = MaterialTheme.colorScheme.onPrimaryContainer,
            selectedTextColor = MaterialTheme.colorScheme.onPrimaryContainer,
            indicatorColor = MaterialTheme.colorScheme.primaryContainer,
            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
        ),
    )
}
