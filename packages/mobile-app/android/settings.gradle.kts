pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://www.jitpack.io") }
    }
}

rootProject.name = "MobileApp"

apply(from = File(rootProject.projectDir, "../node_modules/@react-native/gradle-plugin/settings.gradle.kts"))
include(":app")
includeBuild("../node_modules/@react-native/gradle-plugin")
