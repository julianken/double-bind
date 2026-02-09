/**
 * Gradle build configuration for the Double-Bind Android core module.
 *
 * This module provides the React Native bridge to CozoDB, exposing database
 * operations to JavaScript via native modules.
 */

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.doublebind.core"
    compileSdk = 34

    defaultConfig {
        minSdk = 24  // Android 7.0 (Nougat) - matches React Native defaults

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // CozoDB Android library
    // Provides SQLite-backed Datalog database with graph algorithms
    implementation("io.github.cozodb:cozo_android:0.7.2")

    // Kotlin coroutines for async database operations
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // React Native bridge
    // Note: Version managed by the React Native project
    implementation("com.facebook.react:react-native:+")

    // Testing dependencies
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
