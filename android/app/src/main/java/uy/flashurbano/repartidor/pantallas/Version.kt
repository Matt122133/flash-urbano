package uy.flashurbano.repartidor.pantallas

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import uy.flashurbano.repartidor.BuildConfig

/**
 * El renglon que dice que version es esta.
 *
 * **Existe para una conversacion**, no para una pantalla: cuando Diego avisa
 * que algo no anda, lo primero que hay que saber es si esta pasando sobre la
 * version que uno cree o sobre una de hace tres semanas. Hasta `017` no habia
 * forma de averiguarlo — el numero estaba clavado en `0.1.0` desde `012`.
 *
 * **Va donde no cuesta pantalla.** `015` existio para recuperar milimetros y
 * alcance del pulgar en una app que se usa con una mano y un paquete en la
 * otra; un renglon fijo arriba desharia parte de eso por un dato que se mira
 * dos veces por año. Por eso aparece **al final de lo que se desplaza** y al
 * pie del ingreso, nunca en una barra.
 *
 * **Lee `BuildConfig.VERSION_NAME`, que es la misma fuente** que `Servicio`
 * declara en la cabecera `X-App-Version`. Que sean el mismo valor es lo que
 * hace cierto FR-012 sin esfuerzo: no hay dos constantes que puedan discrepar.
 * Escribir el numero a mano en cualquiera de los dos lados romperia eso en
 * silencio.
 *
 * De donde sale ese valor —y por que un binario de trabajo dice algo distinto
 * de uno publicado— esta en `android/app/build.gradle.kts`.
 */
@Composable
fun PieDeVersion(modifier: Modifier = Modifier) {
    Text(
        "Versión ${BuildConfig.VERSION_NAME}",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = modifier.fillMaxWidth().padding(top = 24.dp, bottom = 8.dp),
    )
}
