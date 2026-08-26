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
import uy.flashurbano.repartidor.datos.Pedido
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

    /** La lista cruda, para poder reagrupar sin volver a pedirla. */
    private var pedidos: List<Pedido> = emptyList()

    /**
     * Los pedidos que estan viajando al servicio ahora mismo.
     *
     * Es lo que sostiene FR-008: mientras un id este aca, su tarjeta muestra que
     * esta yendo y **el boton no se puede volver a tocar**. Nada se dibuja como
     * hecho hasta que el servicio conteste.
     */
    private val _moviendo = MutableStateFlow<Set<String>>(emptySet())
    val moviendo: StateFlow<Set<String>> = _moviendo.asStateFlow()

    /** Lo ultimo que salio mal al mover, para decirlo en pantalla. */
    private val _aviso = MutableStateFlow("")
    val aviso: StateFlow<String> = _aviso.asStateFlow()

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
                volverAlIngreso("Hay que ingresar de nuevo.")
                return@launch
            }

            val respuesta = servicio.pedidos(guardada)
            if (respuesta is Resultado.Ok) pedidos = respuesta.valor

            val estado = estadoDesde(respuesta)
            if (estado is EstadoPantalla.HayQueIngresar) {
                // La credencial ya no vale: se borra. Conservarla solo invita a
                // reintentar con algo que ya se sabe muerto.
                credencial.olvidar()
                volverAlIngreso("La sesión venció. Ingresá otra vez.")
                return@launch
            }
            _pantalla.value = estado
        }
    }

    private fun volverAlIngreso(motivo: String) {
        _ingreso.value = EstadoIngreso()
        _destino.value = Destino.Ingreso(motivo)
    }

    // ----------------------------------------------------------------- mover

    /**
     * Mueve un pedido a un estado.
     *
     * **FR-008: el cambio NO se dibuja hasta que el servicio conteste.** Un
     * pedido que "se movio" en la pantalla y no en la base es peor que un error
     * visible: Diego sigue su dia creyendo que quedo registrado, y el cliente
     * ve "Pendiente" en la web.
     *
     * Mientras viaja, el id queda en `moviendo`, lo que apaga el boton. **Sin
     * eso, dos toques seguidos mandan dos peticiones**; el servicio las aguanta
     * —es idempotente— pero la pantalla parpadearia y la segunda podria llegar
     * despues de un deshacer y pisarlo.
     */
    fun mover(pedido: Pedido, destino: String) {
        if (_moviendo.value.contains(pedido.id)) return

        viewModelScope.launch {
            _moviendo.value = _moviendo.value + pedido.id
            _aviso.value = ""

            val guardada = credencial.leer()
            if (guardada == null) {
                _moviendo.value = _moviendo.value - pedido.id
                volverAlIngreso("Hay que ingresar de nuevo.")
                return@launch
            }

            when (val r = servicio.cambiarEstado(guardada, pedido.id, destino)) {
                is Resultado.Ok -> {
                    // Se reemplaza por **lo que devolvio el servicio**, no por
                    // lo que la app pidio. Si el servicio hubiera decidido otra
                    // cosa, la pantalla muestra la verdad y no el deseo.
                    pedidos = pedidos.map { if (it.id == r.valor.id) r.valor else it }
                    _pantalla.value = agrupar(pedidos)
                }

                is Resultado.Fallo -> {
                    if (r.motivo == Motivo.SESION_VENCIDA) {
                        credencial.olvidar()
                        _moviendo.value = _moviendo.value - pedido.id
                        volverAlIngreso("La sesión venció. Ingresá otra vez.")
                        return@launch
                    }
                    // El pedido **queda donde estaba**. No se toca `pedidos`.
                    _aviso.value = pedido.codigo + ": " + textoDe(r)
                }
            }
            _moviendo.value = _moviendo.value - pedido.id
        }
    }

    fun descartarAviso() {
        _aviso.value = ""
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
            _ingreso.value = _ingreso.value.copy(error = "Falta el mail.")
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
            _ingreso.value = _ingreso.value.copy(error = "Falta el código.")
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
fun textoDe(fallo: Resultado.Fallo): String = mensajeDe(fallo.motivo, fallo.detalle)
