// La tercera superficie del repo. Ver research D2 de `012-app-repartidor`.
//
// Build aparte del de `web/` y del de `backend/`: no comparte codigo con
// ninguno de los dos, habla con el servicio por HTTP igual que el sitio.

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "FlashUrbanoRepartidor"
include(":app")
