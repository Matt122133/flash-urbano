package uy.flashurbano.repartidor.datos

import java.time.LocalDate
import java.time.format.DateTimeParseException

/**
 * La fecha de retiro como se lee de un vistazo: `mar 31/8`.
 *
 * El servicio manda `2026-08-31`, que es correcto y **no se lee**: obliga a
 * contar posiciones para saber si es hoy o el jueves. Diego mira esto parado en
 * la calle.
 *
 * **El dia de la semana va antes que el numero a proposito.** Lo que Diego
 * necesita saber primero es si el pedido es de hoy; el numero exacto es el
 * desempate.
 *
 * Los nombres estan escritos y no salen de `Locale`: el telefono puede estar en
 * ingles —el de Diego lo estuvo— y "Tue 31/8" no le sirve a nadie aca.
 *
 * Si la fecha no se puede interpretar **se devuelve tal cual vino**. Nunca una
 * cadena vacia ni un guion: un dato raro tiene que verse, no esconderse.
 */
fun fechaCorta(iso: String): String = try {
    val d = LocalDate.parse(iso.trim())
    DIAS[d.dayOfWeek.value - 1] + " " + d.dayOfMonth + "/" + d.monthValue
} catch (_: DateTimeParseException) {
    iso
} catch (_: Exception) {
    iso
}

private val DIAS = listOf("lun", "mar", "mié", "jue", "vie", "sáb", "dom")
