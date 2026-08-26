package uy.flashurbano.repartidor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * El esqueleto. Todavia no hace nada: existe para que `android/` compile y el
 * `verify:` de las tres superficies se pueda correr desde la primera fase.
 *
 * Las pantallas llegan en US1 (ver los pedidos) y US2 (moverlos).
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Esqueleto()
                }
            }
        }
    }
}

@Composable
private fun Esqueleto() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "Flash Urbano", style = MaterialTheme.typography.headlineMedium)
        Text(text = BuildConfig.BASE_URL, style = MaterialTheme.typography.bodySmall)
    }
}
