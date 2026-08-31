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
import uy.flashurbano.repartidor.datos.Seccion
import uy.flashurbano.repartidor.datos.seccionDe
import uy.flashurbano.repartidor.datos.Estados
import uy.flashurbano.repartidor.datos.Pedido
import uy.flashurbano.repartidor.datos.Receptor
import uy.flashurbano.repartidor.datos.Servicio

/** En que parte de la app estamos. */
sealed interface Destino {
    data object Arrancando : Destino
    data class Ingreso(val motivo: String = "") : Destino
    data object Pedidos : Destino
}

/**
 * Un movimiento que se puede revertir.
 *
 * `estadoAnterior` es a donde vuelve, y `adonde` es la seccion a la que se fue
 * —lo que el aviso le dice a Diego para que sepa donde buscarlo si no deshace—.
 */
data class Deshacer(
    val pedidoId: String,
    val codigo: String,
    val estadoAnterior: String,
    val adonde: Seccion,
)

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

    /**
     * En que pestaña esta Diego.
     *
     * **Arranca en PENDIENTES y eso no es arbitrario**: es donde nace todo
     * pedido —`pedidos.estado` es `NOT NULL DEFAULT 'creacion'` y `seccionDe()`
     * lo manda ahi— asi que es la bandeja de entrada del trabajo del dia.
     *
     * Vive en el ViewModel y no en la pantalla para que sobreviva a un giro de
     * telefono: con `remember` se perderia y Diego volveria a Pendientes cada
     * vez que rota la mano.
     */
    private val _seccion = MutableStateFlow(Seccion.PENDIENTES)
    val seccion: StateFlow<Seccion> = _seccion.asStateFlow()

    fun elegirSeccion(cual: Seccion) {
        _seccion.value = cual
    }

    /**
     * El ultimo movimiento que salio bien, para poder volver atras.
     *
     * **Existe porque mover un pedido ahora lo saca de la pantalla.** Con las
     * pestanas de `015`, tocar "Lo tengo" en Pendientes hace que el pedido
     * desaparezca de la lista que Diego esta mirando: sin este aviso, la unica
     * senal de que paso algo es que una tarjeta se fue, y para corregir un toque
     * de mas habria que adivinar a que pestana ir.
     *
     * Guarda el estado ANTERIOR, no el destino: deshacer es volver a donde
     * estaba, y ese dato se pierde apenas el servicio contesta.
     */
    private val _deshacer = MutableStateFlow<Deshacer?>(null)
    val deshacer: StateFlow<Deshacer?> = _deshacer.asStateFlow()

    /**
     * Se perdio la conexion y lo que se ve es lo ultimo que se bajo.
     *
     * **No es lo mismo que `NoSePudo`.** Aquel es "no se pudo averiguar si hay
     * trabajo" y ocupa la pantalla entera porque no hay nada que mostrar. Esto
     * es "esto es lo de recien, y puede estar viejo": Diego sigue viendo sus
     * pedidos y sabe que no los puede mover.
     */
    private val _sinRed = MutableStateFlow(false)
    val sinRed: StateFlow<Boolean> = _sinRed.asStateFlow()

    /** El aviso se fue —lo toco, o se lo llevo el tiempo—. */
    fun descartarDeshacer() {
        _deshacer.value = null
    }

    /**
     * El pedido que se esta entregando, mientras la hoja esta abierta.
     *
     * **Nulo mientras no se este entregando nada, y esa es toda la maquina de
     * estados que hace falta**: no hay un booleano aparte que pueda quedar en
     * desacuerdo con el pedido.
     */
    private val _entregando = MutableStateFlow<Pedido?>(null)
    val entregando: StateFlow<Pedido?> = _entregando.asStateFlow()

    /** Diego toco "Entregado": se abre la hoja. **Todavia no se movio nada.** */
    fun pedirEntrega(pedido: Pedido) {
        _entregando.value = pedido
    }

    /**
     * Cerro la hoja sin confirmar.
     *
     * **El pedido NO cambia de estado** (FR-004). Es lo que hace que la hoja sea
     * el paso de confirmacion y no un tramite despues del hecho.
     */
    fun cancelarEntrega() {
        _entregando.value = null
    }

    /** Confirmo quien recibio: recien ahora se mueve. */
    fun confirmarEntrega(pedido: Pedido, nombre: String, documento: String) {
        _entregando.value = null
        mover(pedido, Estados.ENTREGA, Receptor(nombre.trim(), documento.trim()))
    }

    /** Volver el pedido a donde estaba, y sacar el aviso. */
    fun revertir(cual: Deshacer) {
        _deshacer.value = null
        val pedido = pedidos.firstOrNull { it.id == cual.pedidoId } ?: return
        mover(pedido, cual.estadoAnterior, recordable = false)
    }

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

            // **Una recarga que falla por red NO borra lo que ya estaba**
            // (FR-016). Antes, tocar Actualizar en un sotano dejaba a Diego con
            // una pantalla de error y sin sus pedidos — justo cuando mas los
            // necesita, porque sin senal tampoco los puede volver a pedir.
            //
            // Solo aplica si hay algo que conservar: la primera carga sin red no
            // tiene nada viejo que mostrar y cae en el camino de siempre.
            val esDeRed = respuesta is Resultado.Fallo && respuesta.motivo == Motivo.SIN_RED
            if (esDeRed && pedidos.isNotEmpty()) {
                _sinRed.value = true
                _pantalla.value = agrupar(pedidos)
                return@launch
            }
            _sinRed.value = false

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
    /**
     * @param recordable si este movimiento deja un aviso de deshacer. **Lo que
     *   deshace un deshacer no se puede deshacer**: encadenarlos dejaria a Diego
     *   rebotando entre dos estados sin saber cual es el bueno.
     */
    /**
     * @param receptor quien recibio, **obligatorio al entregar** desde `016`.
     *   Mover a `entrega` sin el da 400: por eso el unico camino hacia ese
     *   estado pasa por `confirmarEntrega()`, y la tarjeta ya no lo ofrece
     *   directo.
     */
    fun mover(
        pedido: Pedido,
        destino: String,
        receptor: Receptor? = null,
        recordable: Boolean = true,
    ) {
        if (_moviendo.value.contains(pedido.id)) return

        val estadoAnterior = pedido.estado

        viewModelScope.launch {
            _moviendo.value = _moviendo.value + pedido.id
            _aviso.value = ""
            _deshacer.value = null

            val guardada = credencial.leer()
            if (guardada == null) {
                _moviendo.value = _moviendo.value - pedido.id
                volverAlIngreso("Hay que ingresar de nuevo.")
                return@launch
            }

            when (val r = servicio.cambiarEstado(guardada, pedido.id, destino, receptor)) {
                is Resultado.Ok -> {
                    // Se reemplaza por **lo que devolvio el servicio**, no por
                    // lo que la app pidio. Si el servicio hubiera decidido otra
                    // cosa, la pantalla muestra la verdad y no el deseo.
                    pedidos = pedidos.map { if (it.id == r.valor.id) r.valor else it }
                    _pantalla.value = agrupar(pedidos)

                    // El aviso se arma **despues** de que el servicio confirmo.
                    // Ofrecer deshacer algo que todavia no paso es prometer una
                    // marcha atras sobre un movimiento que puede fallar.
                    if (recordable) {
                        _deshacer.value = Deshacer(
                            pedidoId = r.valor.id,
                            codigo = r.valor.codigo,
                            estadoAnterior = estadoAnterior,
                            adonde = seccionDe(r.valor.estado),
                        )
                    }
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
