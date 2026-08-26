plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

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
        versionCode = 1
        versionName = "0.1.0"
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
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
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

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    // MockWebServer: el cliente se prueba contra un servidor de verdad en
    // JVM, no contra un doble de OkHttp. Ver ServicioTest.
    testImplementation(libs.okhttp.mockwebserver)
}
