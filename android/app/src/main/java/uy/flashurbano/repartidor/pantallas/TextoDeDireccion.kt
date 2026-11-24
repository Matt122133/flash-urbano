package uy.flashurbano.repartidor.pantallas

import uy.flashurbano.repartidor.datos.Direccion

/**
 * La direccion como texto, en el orden en que se busca en la calle (`032`).
 *
 * **El numero va pegado a la calle principal, y la esquina despues.** Hasta
 * `032` la app escribia `Rivera esq. Soca 1234`, que se lee "Soca 1234": otra
 * puerta. La esquina es una referencia; el numero es de la calle.
 *
 * El texto es **el mismo que arma la web** (`componerDireccion` en
 * `web/lib/direccion.ts`): `Rivera 1234, apto 3, esq. Soca, cooperativa`. Dos
 * formatos para el mismo dato fue justamente como la app termino distinta.
 *
 * `breve` es la linea corta de la hoja de entrega: sin apto ni cooperativa,
 * igual que el `breve` de la tarjeta de la web.
 *
 * No usa el punto: lo que hace falta para llegar es el texto, y un pedido sin
 * punto se lee igual.
 */
fun textoDeDireccion(d: Direccion, breve: Boolean = false): String {
    val calleYNumero = listOfNotNull(
        d.calle.trim().takeIf { it.isNotEmpty() },
        d.numero?.trim()?.takeIf { it.isNotEmpty() },
    ).joinToString(" ")

    return listOf(
        calleYNumero,
        if (breve) "" else d.apto?.trim()?.takeIf { it.isNotEmpty() }?.let { "apto $it" } ?: "",
        d.esquina.trim().takeIf { it.isNotEmpty() }?.let { "esq. $it" } ?: "",
        if (!breve && d.cooperativa) "cooperativa" else "",
    ).filter { it.isNotEmpty() }.joinToString(", ")
}
