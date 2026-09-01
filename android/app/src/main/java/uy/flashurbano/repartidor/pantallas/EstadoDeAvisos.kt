package uy.flashurbano.repartidor.pantallas

/**
 * Si los avisos van a llegar, y si no, por que no.
 *
 * ## Por que existe este tipo en vez de un booleano
 *
 * Porque **las dos formas de estar mudo se arreglan distinto**, y decirle a
 * Diego la equivocada es peor que no decirle nada: mandarlo a los ajustes de la
 * app cuando lo que falta es conceder el permiso lo deja dando vueltas por una
 * pantalla donde no esta lo que busca.
 *
 * Es un `enum` y no un booleano tambien por lo que viene: el dia que haya un
 * tercer motivo —el fabricante durmio la app— entra aca y el compilador obliga
 * a que la pantalla lo contemple.
 */
enum class LleganLosAvisos {
    /** Todo bien: no hay nada que mostrar. */
    SI,

    /** Diego dijo que no al cartel del permiso. Se arregla concediendolo. */
    PERMISO_NEGADO,

    /**
     * El permiso esta, pero las notificaciones de la app estan apagadas desde
     * los ajustes del sistema. Se arregla ahi y no en la app.
     */
    APAGADAS_EN_EL_SISTEMA,
}

/**
 * Decide si hay algo que decir, y que.
 *
 * **El orden de las dos preguntas importa.** Desde Android 13 negar el permiso
 * tambien deja `habilitadasEnElSistema` en falso, asi que preguntar primero por
 * el sistema haria que un permiso negado se reportara como "andá a los ajustes
 * a prenderlas" — que es el consejo equivocado para ese caso.
 *
 * Es una funcion pura y vive aparte del dibujo **para que se pueda probar sin
 * dispositivo**, que es la unica forma de probar algo de la app en el `verify:`.
 *
 * @param permisoConcedido en Android anterior a 13 esto es **siempre true**: no
 *   existe el permiso en tiempo de ejecucion, y tratarlo como negado le
 *   mostraria a Diego un cartel que no puede resolver.
 * @param habilitadasEnElSistema lo que dice `areNotificationsEnabled()`.
 */
fun lleganLosAvisos(
    permisoConcedido: Boolean,
    habilitadasEnElSistema: Boolean,
): LleganLosAvisos = when {
    !permisoConcedido -> LleganLosAvisos.PERMISO_NEGADO
    !habilitadasEnElSistema -> LleganLosAvisos.APAGADAS_EN_EL_SISTEMA
    else -> LleganLosAvisos.SI
}

/**
 * Lo que el renglon le dice a Diego, en su idioma y con una accion.
 *
 * **Vacio cuando todo esta bien**, que es lo que hace que el renglon no ocupe
 * pantalla en el caso normal — lo mismo que `015` estuvo sacando.
 */
fun textoDeAvisosMudos(estado: LleganLosAvisos): String = when (estado) {
    LleganLosAvisos.SI -> ""
    LleganLosAvisos.PERMISO_NEGADO ->
        "No vas a recibir avisos de pedidos nuevos. Falta darle permiso a la app."
    LleganLosAvisos.APAGADAS_EN_EL_SISTEMA ->
        "No vas a recibir avisos de pedidos nuevos. Están apagados en los ajustes del teléfono."
}
