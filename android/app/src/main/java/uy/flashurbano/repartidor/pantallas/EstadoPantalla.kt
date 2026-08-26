package uy.flashurbano.repartidor.pantallas

import uy.flashurbano.repartidor.datos.Motivo
import uy.flashurbano.repartidor.datos.Pedido
import uy.flashurbano.repartidor.datos.Resultado
import uy.flashurbano.repartidor.datos.Seccion
import uy.flashurbano.repartidor.datos.seccionDe

/**
 * En que puede estar la pantalla principal.
 *
 * **Los estados que no son una lista son la mitad del trabajo** (contrato
 * seccion 5), no un detalle: una pantalla que muestra una lista vacia cuando en
 * realidad no pudo traer nada le dice a Diego que no tiene trabajo, y eso es
 * peor que un error visible.
 */
sealed interface EstadoPantalla {

    /** Todavia no se sabe. */
    data object Cargando : EstadoPantalla

    /** El servicio contesto y hay pedidos. */
    data class Hay(
        val pendientes: List<Pedido>,
        val tomados: List<Pedido>,
        val entregados: List<Pedido>,
    ) : EstadoPantalla

    /**
     * El servicio contesto y **de verdad no hay nada**.
     *
     * Distinto de NoSePudo a proposito, y tiene que leerse distinto: uno dice
     * "no hay trabajo" y el otro "no se pudo averiguar si hay trabajo".
     */
    data object Vacia : EstadoPantalla

    /** No se pudo traer la lista. Se ofrece reintentar. */
    data class NoSePudo(val motivo: Motivo, val detalle: String) : EstadoPantalla

    /** La credencial dejo de valer: vuelta al ingreso, con el motivo dicho. */
    data object HayQueIngresar : EstadoPantalla
}

/**
 * Traduce lo que devolvio el servicio en lo que la pantalla dibuja.
 *
 * Es una funcion pura y vive aparte de la interfaz **para que se pueda probar
 * sin dispositivo**, que es la unica forma de probar algo de la app en el
 * `verify:`.
 */
fun estadoDesde(resultado: Resultado<List<Pedido>>): EstadoPantalla = when (resultado) {
    is Resultado.Fallo -> when (resultado.motivo) {
        Motivo.SESION_VENCIDA -> EstadoPantalla.HayQueIngresar
        else -> EstadoPantalla.NoSePudo(resultado.motivo, resultado.detalle)
    }

    is Resultado.Ok -> agrupar(resultado.valor)
}

/**
 * Parte la lista en las secciones del contrato (seccion 4.2).
 *
 * El orden dentro de cada seccion es el que mando el servicio. **La app no
 * decide un orden de visita ni sugiere una ruta** — eso lo prohibe el contrato
 * seccion 6, y es el feature que todavia no existe.
 */
fun agrupar(pedidos: List<Pedido>): EstadoPantalla {
    if (pedidos.isEmpty()) return EstadoPantalla.Vacia

    val por = pedidos.groupBy { seccionDe(it.estado) }
    return EstadoPantalla.Hay(
        pendientes = por[Seccion.PENDIENTES].orEmpty(),
        tomados = por[Seccion.TOMADOS].orEmpty(),
        entregados = por[Seccion.ENTREGADOS].orEmpty(),
    )
}

/**
 * Un fallo, dicho como se lo dice a una persona parada en la calle.
 *
 * **El detalle crudo del error NO se muestra cuando es de red.** OkHttp devuelve
 * cosas como "Failed to connect to /10.0.2.2:8080": ingles, una IP, y ninguna
 * accion posible. A Diego no le sirve y lo asusta. Lo que sirve es que mire la
 * senal y vuelva a tocar.
 *
 * Cuando el fallo lo manda el SERVICIO si se muestra: ese texto lo escribio el
 * backend para ser leido —"esta direccion no tiene permiso para ver los
 * pedidos"— y esconderlo dejaria a alguien sin saber que arreglar.
 */
fun mensajeDe(motivo: Motivo, detalle: String): String = when (motivo) {
    Motivo.SIN_RED -> "Fijate la señal y volvé a probar."
    Motivo.SESION_VENCIDA -> "La sesión venció. Ingresá de nuevo."
    Motivo.DEL_SERVICIO -> detalle.ifBlank { "El servicio no pudo responder." }
}
