package uy.flashurbano.repartidor.ui.tema

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * El tema de la app.
 *
 * **Hasta `015` este archivo no existia**, y por eso la app salia morada: sin un
 * esquema propio, `MaterialTheme {}` usa el violeta de referencia de Material 3.
 * El cliente la describio como "medio fea" el mismo dia que la instalo.
 *
 * ## Solo claro, y a proposito
 *
 * No hay esquema oscuro. Esta app se usa **afuera, de dia**: un esquema oscuro
 * seria el doble de superficie donde equivocarse en contraste, para un caso que
 * hoy no existe. Si aparece, se agrega.
 *
 * ## Sin color dinamico, y es la decision que mas importa de este archivo
 *
 * Material 3 en Android 12+ ofrece `dynamicLightColorScheme()`, que arma la
 * paleta **a partir del fondo de pantalla del telefono**. Es el camino por
 * defecto de casi todos los ejemplos, y aca esta descartado explicitamente: con
 * eso, la app de Diego se veria del color de su wallpaper y **la marca
 * desapareceria otra vez**, que es exactamente el defecto que este feature vino
 * a arreglar. Ver research D2.
 */
private val ESQUEMA_CLARO = lightColorScheme(
    primary = Color(Paleta.AZUL),
    onPrimary = Color(Paleta.BLANCO),
    primaryContainer = Color(Paleta.AZUL_PASTILLA),
    onPrimaryContainer = Color(Paleta.AZUL_OSCURO),

    // El naranja es el acento de marca: el badge y la flecha de "retira".
    // `onSecondary` es OSCURO y no blanco — ver el comentario del badge en
    // Paleta.kt, que lo decidio la prueba de contraste y no el gusto.
    secondary = Color(Paleta.NARANJA),
    onSecondary = Color(Paleta.TEXTO),

    // El verde de "entregado". No es de marca y no pretende serlo.
    tertiary = Color(Paleta.VERDE),
    onTertiary = Color(Paleta.BLANCO),

    background = Color(Paleta.FONDO),
    onBackground = Color(Paleta.TEXTO),
    surface = Color(Paleta.SUPERFICIE),
    onSurface = Color(Paleta.TEXTO),
    surfaceVariant = Color(Paleta.FONDO),
    onSurfaceVariant = Color(Paleta.TEXTO_SUAVE),
    outline = Color(Paleta.BORDE),
    outlineVariant = Color(Paleta.BORDE),

    // **La familia `surfaceContainer*` completa, y no por prolijidad.**
    //
    // `NavigationBar` no pinta con `surface`: pinta con `surfaceContainer`. Como
    // la primera version de este archivo no lo declaraba, se quedo con el valor
    // de referencia de Material 3 — **lila** — y la barra de destinos, que es la
    // pieza nueva de `015`, salio del color que este feature vino a sacar.
    //
    // Lo encontro el emulador, no `ContrasteTest`: esa prueba mide la paleta, no
    // que la pantalla la use. Esta escrito como limite en la propia prueba, y
    // aca esta el caso real.
    //
    // Se declaran los seis para que no quede ningun rol esperando a que un
    // componente futuro lo use y traiga el lila de vuelta.
    surfaceContainerLowest = Color(Paleta.SUPERFICIE),
    surfaceContainerLow = Color(Paleta.SUPERFICIE),
    surfaceContainer = Color(Paleta.SUPERFICIE),
    surfaceContainerHigh = Color(Paleta.FONDO),
    surfaceContainerHighest = Color(Paleta.FONDO),
    surfaceBright = Color(Paleta.SUPERFICIE),
    surfaceDim = Color(Paleta.FONDO),

    // **Los roles invertidos, que son los del Snackbar.**
    //
    // Segunda vez que aparece lo mismo: el aviso de "Deshacer" salio LILA
    // porque `Snackbar` pinta su accion con `inversePrimary`, otro rol que este
    // archivo no declaraba. Despues de `surfaceContainer`, el patron quedo
    // claro: **cualquier rol de Material 3 que quede sin declarar trae el
    // morado de referencia de vuelta**, y aparece recien cuando alguien abre esa
    // pantalla.
    //
    // Por eso de aca en adelante se declara el esquema COMPLETO, aunque hoy
    // ningun componente use la mitad. Un rol sin declarar no es un valor que
    // falta: es una bomba con el color equivocado esperando a que alguien use
    // el componente que lo lee.
    inverseSurface = Color(Paleta.OSCURO),
    inverseOnSurface = Color(Paleta.SOBRE_OSCURO),
    inversePrimary = Color(Paleta.ACENTO_CLARO),

    secondaryContainer = Color(Paleta.AZUL_PASTILLA),
    onSecondaryContainer = Color(Paleta.AZUL_OSCURO),
    tertiaryContainer = Color(Paleta.AZUL_PASTILLA),
    onTertiaryContainer = Color(Paleta.AZUL_OSCURO),

    error = Color(Paleta.ERROR),
    onError = Color(Paleta.BLANCO),
    errorContainer = Color(Paleta.ERROR),
    onErrorContainer = Color(Paleta.BLANCO),

    scrim = Color(Paleta.OSCURO),
    surfaceTint = Color(Paleta.AZUL),
)

@Composable
fun TemaFlashUrbano(contenido: @Composable () -> Unit) {
    MaterialTheme(colorScheme = ESQUEMA_CLARO, content = contenido)
}
