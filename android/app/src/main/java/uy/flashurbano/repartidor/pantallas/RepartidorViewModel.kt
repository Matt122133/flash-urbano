package uy.flashurbano.repartidor.pantallas

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import uy.flashurbano.repartidor.datos.Credencial
import uy.flashurbano.repartidor.datos.Motivo
import uy.flashurbano.repartidor.datos.Resultado
import uy.flashurbano.repartidor.datos.Servicio

/** En que parte de la app estamos. */
sealed interface Destino {
    data object Arrancando : Destino
    data class Ingreso(val motivo: String = "") : Destino
    data object Pedidos : Destino
}

/**
 * El estado de la app y lo unico que habla con el servicio.
 *
 * La credencial se lee una vez al arrancar. Si hay, se va derecho a los pedidos;
 * la pantalla de ingreso **se ve una vez en la vida** mientras la sesion se
 * renueve sola (research D7).
 */
class RepartidorViewModel(app: Application) : AndroidViewModel(app) {

    private val servicio = Servicio()
    private val credencial = Credencial(app)

    private val _destino = MutableStateFlow<Destino>(Destino.Arrancando)
    val destino: StateFlow<Destino> = _destino.asStateFlow()

    private val _pantalla = MutableStateFlow<EstadoPantalla>(EstadoPantalla.Cargando)
    val pantalla: StateFlow<EstadoPantalla> = _pantalla.asStateFlow()

    /** Lo que esta pasando en el ingreso. */
    private val _ingreso = MutableStateFlow(EstadoIngreso())
    val ingreso: StateFlow<EstadoIngreso> = _ingreso.asStateFlow()

    init {
        viewModelScope.launch {
            if (credencial.leer() == null) {
                _destino.value = Destino.Ingreso()
            } else {
                _destino.value = Destino.Pedidos
                cargar()
            }
        }
    }

    fun cargar() {
        viewModelScope.launch {
            _pantalla.value = EstadoPantalla.Cargando
            val guardada = credencial.leer()
            if (guardada == null) {
                volverAlIngreso("hay que ingresar de nuevo")
                return@launch
            }

            val estado = estadoDesde(servicio.pedidos(guardada))
            if (estado is EstadoPantalla.HayQueIngresar) {
                // La credencial ya no vale: se borra. Conservarla solo invita a
                // reintentar con algo que ya se sabe muerto.
                credencial.olvidar()
                volverAlIngreso("la sesion vencio, hay que ingresar otra vez")
                return@launch
            }
            _pantalla.value = estado
        }
    }

    private fun volverAlIngreso(motivo: String) {
        _ingreso.value = EstadoIngreso()
        _destino.value = Destino.Ingreso(motivo)
    }

    // ---------------------------------------------------------------- ingreso

    fun escribioMail(valor: String) {
        _ingreso.value = _ingreso.value.copy(mail = valor, error = "")
    }

    fun escribioCodigo(valor: String) {
        _ingreso.value = _ingreso.value.copy(codigo = valor, error = "")
    }

    fun pedirCodigo() {
        val mail = _ingreso.value.mail.trim()
        if (mail.isBlank()) {
            _ingreso.value = _ingreso.value.copy(error = "falta el mail")
            return
        }
        viewModelScope.launch {
            _ingreso.value = _ingreso.value.copy(trabajando = true, error = "")
            _ingreso.value = when (val r = servicio.pedirCodigo(mail)) {
                is Resultado.Ok -> _ingreso.value.copy(trabajando = false, codigoPedido = true)
                is Resultado.Fallo -> _ingreso.value.copy(trabajando = false, error = textoDe(r))
            }
        }
    }

    fun verificarCodigo() {
        val mail = _ingreso.value.mail.trim()
        val codigo = _ingreso.value.codigo.trim()
        if (codigo.isBlank()) {
            _ingreso.value = _ingreso.value.copy(error = "falta el codigo")
            return
        }
        viewModelScope.launch {
            _ingreso.value = _ingreso.value.copy(trabajando = true, error = "")
            when (val r = servicio.verificarCodigo(mail, codigo)) {
                is Resultado.Ok -> {
                    credencial.guardar(r.valor)
                    _ingreso.value = EstadoIngreso()
                    _destino.value = Destino.Pedidos
                    cargar()
                }

                is Resultado.Fallo ->
                    _ingreso.value = _ingreso.value.copy(trabajando = false, error = textoDe(r))
            }
        }
    }
}

data class EstadoIngreso(
    val mail: String = "",
    val codigo: String = "",
    val codigoPedido: Boolean = false,
    val trabajando: Boolean = false,
    val error: String = "",
)

/** Un fallo, dicho como se lo dice a una persona parada en la calle. */
fun textoDe(fallo: Resultado.Fallo): String = when (fallo.motivo) {
    Motivo.SIN_RED -> "No se pudo conectar. Fijate la senal y volve a probar."
    Motivo.SESION_VENCIDA -> "La sesion vencio. Ingresa de nuevo."
    Motivo.DEL_SERVICIO -> fallo.detalle.ifBlank { "El servicio no pudo responder." }
}
