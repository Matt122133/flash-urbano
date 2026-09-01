plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    // Aplicado desde T003, cuando `google-services.json` entro al repo: este
    // plugin se planta si no lo encuentra. Es lo que convierte ese archivo en
    // la configuracion que Firebase lee en tiempo de ejecucion.
    alias(libs.plugins.google.services)
}

// ---------------------------------------------------------------------------
// La version sale del tag de la publicacion, y no de estos renglones.
//
// Hasta `017` `versionCode` y `versionName` estaban escritos a mano, y no se
// movieron desde `012`: atravesaron `015` y `016` diciendo lo mismo. Con el APK
// llegando por un link en vez de por cable, eso significa que un telefono no
// puede decir que version corre, que es todo el problema que `017` resuelve.
//
// Ahora hay **una sola fuente**: el tag. No queda ningun paso que alguien pueda
// olvidarse de dar.
// ---------------------------------------------------------------------------

/**
 * Corre un comando y devuelve su salida, o `null` si fallo por lo que sea.
 *
 * Devolver `null` en vez de reventar es deliberado: aca abajo, **no poder leer
 * la version nunca puede romper el build**. Un clon recien bajado no tiene
 * tags, y una maquina puede no tener `git` en el PATH; si cualquiera de esas
 * dos cosas volteara la compilacion, se romperia el trabajo diario para
 * resolver un problema que es de publicacion.
 *
 * `isIgnoreExitValue` cubre el comando que corre y falla —`git describe` sin
 * tags sale con 128—; el `try` cubre el que ni siquiera arranca.
 */
fun salidaDe(vararg comando: String): String? = try {
    val ejecucion = providers.exec {
        commandLine(*comando)
        isIgnoreExitValue = true
    }
    if (ejecucion.result.get().exitValue != 0) {
        null
    } else {
        ejecucion.standardOutput.asText.get().trim().ifEmpty { null }
    }
} catch (_: Exception) {
    null
}

/**
 * El numero de version, derivado del tag alcanzable desde HEAD.
 *
 * **`git describe` solo ve tags alcanzables desde HEAD** (research D2), asi que
 * en una rama de trabajo no encuentra ninguno y cae al ultimo caso. Eso no es
 * una limitacion: es lo que hace que un binario compilado fuera del
 * procedimiento de publicacion **no pueda hacerse pasar por publicado**
 * (FR-006), sin que haya que escribir nada para lograrlo.
 *
 * Las tres situaciones, que son la tabla de research D3:
 *
 * | Situacion                        | nombre              | codigo    |
 * |----------------------------------|---------------------|-----------|
 * | HEAD tiene el tag exacto         | `0.2.0`             | `200`     |
 * | Hay tag, HEAD esta mas adelante  | `0.2.0+3-gc3eb8fe`  | `200`     |
 * | Sin tag, o sin git               | `0.0.0-c3eb8fe`     | `1`       |
 */
fun versionDelTag(): Pair<String, Int> {
    // `--long` fuerza el formato completo aun sobre el tag exacto, asi que hay
    // un solo formato que interpretar en vez de dos. `--match v*` deja afuera
    // cualquier tag que no sea de version.
    val descripcion = salidaDe("git", "describe", "--tags", "--long", "--match", "v*")
    val hash = salidaDe("git", "rev-parse", "--short", "HEAD")

    val forma = Regex("""^v(\d+)\.(\d+)\.(\d+)-(\d+)-g([0-9a-f]+)$""")
    val partes = descripcion?.let { forma.find(it) }
        ?: return Pair("0.0.0-${hash ?: "desconocido"}", 1)

    val (mayor, menor, parche, distancia, corto) = partes.destructured

    // El limite esta aceptado y escrito en research D3: con `*100` entre
    // tramos, una parte de tres cifras se comeria a la de al lado y dos
    // versiones distintas darian el mismo entero. Aca se planta a proposito:
    // solo puede pasar sobre un tag que alguien creo a mano, y un choque
    // silencioso de `versionCode` rompe FR-001 sin que nada avise.
    listOf(mayor, menor, parche).forEach {
        if (it.toInt() > 99) {
            throw GradleException(
                "El tag $descripcion tiene una parte mayor que 99, y la cuenta " +
                    "de versionCode (mayor*10000 + menor*100 + parche) no lo soporta.",
            )
        }
    }

    val codigo = mayor.toInt() * 10000 + menor.toInt() * 100 + parche.toInt()
    val nombre = if (distancia == "0") {
        "$mayor.$menor.$parche"
    } else {
        "$mayor.$menor.$parche+$distancia-g$corto"
    }
    return Pair(nombre, codigo)
}

val (nombreDeVersion, codigoDeVersion) = versionDelTag()

android {
    namespace = "uy.flashurbano.repartidor"
    compileSdk = 36

    defaultConfig {
        applicationId = "uy.flashurbano.repartidor"
        // Android 8.0, de 2017. Cubre practicamente cualquier telefono en uso.
        // TODAVIA NO SE COMPROBO cual tiene el de Diego (T003, research D3): si
        // fuera anterior a 8, la app no instala.
        minSdk = 26
        targetSdk = 36
        // Derivados del tag, arriba. Ver `versionDelTag()`.
        versionCode = codigoDeVersion
        versionName = nombreDeVersion
    }

    buildTypes {
        // A que servicio apunta cada compilacion. Ver research D5.
        //
        // La excepcion de texto plano que `debug` necesita para hablarle al
        // backend local NO vive aca: vive en `src/debug/`, que es lo que
        // garantiza que no pueda colarse en `release`.
        debug {
            // Como el emulador ve el `localhost` de esta maquina.
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:8080\"")
        }
        release {
            buildConfigField(
                "String",
                "BASE_URL",
                "\"https://flash-urbano-production.up.railway.app\"",
            )
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )

            // **Firmado con la clave de DEPURACION, y es deliberado** (research
            // D11). Sin esto `assembleRelease` produce un APK sin firmar, que
            // Android **no instala**: el paso se descubriria con el telefono de
            // Diego en la mano (T037), que es el peor momento.
            //
            // Una clave propia hace falta el dia que esto se publique en una
            // tienda, y ese dia no esta en el horizonte. La clave de depuracion
            // alcanza para instalar a mano, que es como llega este APK.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        compose = true
        // Es lo que publica `BASE_URL`.
        buildConfig = true
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.18.0"))
    implementation("com.google.firebase:firebase-analytics")
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.okhttp)
    // Explicito y no heredado de lifecycle: las dependencias `implementation`
    // no viajan al classpath de compilacion, asi que apoyarse en la
    // transitiva compila hoy y se rompe cuando lifecycle cambie la suya.
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.datastore.preferences)

    // Los avisos de pedido nuevo (018). El BOM fija la version de cada artefacto,
    // asi que `firebase-messaging` va sin numero.
    //
    // El plugin `google-services` NO esta aplicado todavia: se planta si no
    // encuentra `google-services.json`, que sale de la consola de Firebase
    // (T003). Sin el, esto compila y baja los artefactos —que es lo que la Fase 1
    // existe para comprobar— pero Firebase no se inicializa en tiempo de
    // ejecucion. Todavia no hay nada que inicializar.
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    // MockWebServer: el cliente se prueba contra un servidor de verdad en
    // JVM, no contra un doble de OkHttp. Ver ServicioTest.
    testImplementation(libs.okhttp.mockwebserver)
}
