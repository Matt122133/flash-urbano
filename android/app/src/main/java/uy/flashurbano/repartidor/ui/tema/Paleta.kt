package uy.flashurbano.repartidor.ui.tema

/**
 * Los colores de Flash Urbano, en crudo.
 *
 * **Son los mismos del sitio**, no una paleta paralela: `web/app/globals.css`
 * declara `--brand: #1d4ed8`, `--brand-dark: #1e3a8a` y `--accent: #f97316`.
 * Es la misma empresa; que la app se viera de otro color fue el defecto que
 * `015` vino a arreglar, no una libertad de diseno.
 *
 * **Se declaran como `Long` y no como `Color` a proposito.** La prueba de
 * contraste corre en la JVM y trabaja sobre estos numeros: sin Compose de por
 * medio no hay nada que pueda fallar por falta de Android. El tema los envuelve
 * en `Color(...)` una sola vez, en `Tema.kt`.
 */
object Paleta {
    /** Azul de marca. Barra superior, destino seleccionado, accion primaria. */
    const val AZUL = 0xFF1D4ED8

    /** Azul oscuro. Texto sobre pastillas claras. */
    const val AZUL_OSCURO = 0xFF1E3A8A

    /** Pastilla azul clara: el fondo del destino seleccionado y de la cantidad. */
    const val AZUL_PASTILLA = 0xFFE6EDFF

    /** Naranja de marca. El badge, y la flecha de "retira". */
    const val NARANJA = 0xFFF97316

    /** Verde de "entregado". No es de marca: es el verde de cerrado. */
    const val VERDE = 0xFF15803D

    /** El fondo de la app. Gris muy claro, no blanco: separa las tarjetas. */
    const val FONDO = 0xFFF4F5F7

    /** Las tarjetas y la barra inferior. */
    const val SUPERFICIE = 0xFFFFFFFF

    /** Texto principal. Azul muy oscuro, no negro puro. */
    const val TEXTO = 0xFF0F172A

    /**
     * Texto secundario.
     *
     * **Es `#4B5563` y no el `#64748B` que tenia la maqueta**, y el cambio lo
     * forzo la prueba de contraste: `#64748B` sobre el fondo `#F4F5F7` da
     * **4.42:1**, apenas por debajo del minimo de 4.5. Sobre blanco pasaba
     * (4.76) y sobre el fondo no — el tipo de diferencia que nadie ve mirando.
     */
    const val TEXTO_SUAVE = 0xFF4B5563

    /** El borde de las tarjetas y de los botones de telefono. */
    const val BORDE = 0xFFE2E5EA

    const val BLANCO = 0xFFFFFFFF

    /** El fondo oscuro de los avisos que se superponen. */
    const val OSCURO = 0xFF0F172A

    /** El texto y la accion sobre ese fondo oscuro. */
    const val SOBRE_OSCURO = 0xFFF1F5F9

    /**
     * La accion del aviso oscuro: naranja claro.
     *
     * Tiene que destacarse sobre `OSCURO` y ser tocable de un vistazo. El
     * naranja de marca no sirve ahi —queda apagado contra el azul oscuro— asi
     * que se usa su version clara, que es la misma familia.
     */
    const val ACENTO_CLARO = 0xFFFDBA74

    /** Lo que salio mal. */
    const val ERROR = 0xFFB91C1C
}

/**
 * Un par texto/fondo que la app dibuja de verdad, con su minimo exigido.
 *
 * @param textoGrande 3:1 en vez de 4.5:1. Solo para 18sp normal o 14sp en
 *   negrita para arriba, que es lo que dice la norma — no para lo que parezca
 *   grande.
 */
data class ParDeColor(
    val nombre: String,
    val texto: Long,
    val fondo: Long,
    val textoGrande: Boolean = false,
)

/**
 * Los pares que hay que poder leer, y **son un contrato, no una lista de
 * ejemplos**: si una pantalla dibuja una combinacion que no esta aca, nadie la
 * mide.
 *
 * El limite de esa afirmacion esta escrito en `ContrasteTest`: esto prueba la
 * paleta, no que la pantalla use estos colores.
 */
val PARES_DE_TEXTO = listOf(
    ParDeColor("texto sobre tarjeta", Paleta.TEXTO, Paleta.SUPERFICIE),
    ParDeColor("texto sobre el fondo", Paleta.TEXTO, Paleta.FONDO),
    ParDeColor("texto suave sobre tarjeta", Paleta.TEXTO_SUAVE, Paleta.SUPERFICIE),
    ParDeColor("texto suave sobre el fondo", Paleta.TEXTO_SUAVE, Paleta.FONDO),
    ParDeColor("blanco sobre azul de marca", Paleta.BLANCO, Paleta.AZUL),
    ParDeColor("blanco sobre azul oscuro", Paleta.BLANCO, Paleta.AZUL_OSCURO),
    ParDeColor("blanco sobre el verde de entregado", Paleta.BLANCO, Paleta.VERDE),
    ParDeColor("azul oscuro sobre la pastilla", Paleta.AZUL_OSCURO, Paleta.AZUL_PASTILLA),
    // **El badge lleva texto OSCURO sobre el naranja, y no blanco.**
    //
    // La maqueta tenia blanco, que es lo que se dibuja por reflejo sobre un
    // color fuerte. Da **2.80:1** — no llega ni al minimo de texto grande, y el
    // numero del badge es chico. Oscuro sobre el mismo naranja da 6.36:1.
    //
    // Se eligio eso antes que oscurecer el naranja: Diego pidio la app "mas
    // colorida", y bajar el naranja a #C2410C para poder poner blanco encima
    // habria pagado el contraste con lo que el fue a buscar.
    ParDeColor("texto sobre el badge naranja", Paleta.TEXTO, Paleta.NARANJA),
    ParDeColor("texto del aviso oscuro", Paleta.SOBRE_OSCURO, Paleta.OSCURO),
    ParDeColor("la accion del aviso oscuro", Paleta.ACENTO_CLARO, Paleta.OSCURO),
    ParDeColor("un error sobre la tarjeta", Paleta.ERROR, Paleta.SUPERFICIE),
)
