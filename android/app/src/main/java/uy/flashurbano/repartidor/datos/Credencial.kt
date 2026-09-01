package uy.flashurbano.repartidor.datos

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * Donde vive la credencial de Diego.
 *
 * `DataStore` de Preferences (research D6). **Sin `EncryptedSharedPreferences`**:
 * el almacenamiento de la app ya lo cifra el sistema mientras el telefono este
 * bloqueado, que es la proteccion real. Una capa de cifrado propia sobre un
 * telefono desbloqueado —donde se ve la app entera igual— seria sensacion de
 * seguridad, no seguridad.
 *
 * **Es lo UNICO que sobrevive a cerrar la app.** Los pedidos no se guardan
 * (data-model seccion 4): sin credencial valida no hay lista, y por eso un
 * telefono perdido no es un archivo de datos de clientes.
 */
private val Context.almacen by preferencesDataStore(name = "credencial")

private val CLAVE = stringPreferencesKey("credencial")

/**
 * La direccion a la que el proveedor le entrega los avisos a ESTE telefono.
 *
 * Vive en el mismo almacen que la credencial y no en uno propio: son dos datos
 * del mismo aparato, los dos hay que borrarlos si el telefono se pierde, y un
 * segundo `DataStore` seria un archivo mas para acordarse.
 */
private val CLAVE_PUSH = stringPreferencesKey("push_token")

class Credencial(private val contexto: Context) {

    /** La credencial guardada, o null si nunca se ingreso. */
    suspend fun leer(): String? =
        contexto.almacen.data.map { it[CLAVE] }.first()

    suspend fun guardar(valor: String) {
        contexto.almacen.edit { it[CLAVE] = valor }
    }

    /**
     * Borra la credencial. Es lo que se hace cuando el servicio dice que ya no
     * vale: no tiene sentido conservarla, y guardarla invita a reintentar con
     * algo que ya se sabe muerto.
     *
     * **No borra el token de avisos**, y es a proposito: el token describe al
     * telefono, no a la sesion. Sobrevive a un reingreso porque el aparato
     * sigue siendo el mismo, y del lado del servicio la fila de la sesion vieja
     * ya quedo fuera de alcance —la consulta de destinatarios filtra por
     * `revocada_en IS NULL`—, asi que no hay nada que limpiar ahi. Borrarlo
     * aca obligaria a esperar a que el proveedor lo vuelva a entregar, que no
     * ocurre en cada arranque.
     */
    suspend fun olvidar() {
        contexto.almacen.edit { it.remove(CLAVE) }
    }

    /** El token de avisos guardado, o null si el proveedor todavia no dio uno. */
    suspend fun leerPushToken(): String? =
        contexto.almacen.data.map { it[CLAVE_PUSH] }.first()

    /**
     * Guarda el token de avisos.
     *
     * Se llama al arrancar y cada vez que el proveedor lo renueva. **Guardarlo
     * no lo declara**: eso pasa en la proxima llamada al servicio, que lo lleva
     * en una cabecera. No hay endpoint propio para esto (research D1).
     */
    suspend fun guardarPushToken(valor: String) {
        contexto.almacen.edit { it[CLAVE_PUSH] = valor }
    }
}
