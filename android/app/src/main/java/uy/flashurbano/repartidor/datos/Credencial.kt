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
     */
    suspend fun olvidar() {
        contexto.almacen.edit { it.remove(CLAVE) }
    }
}
