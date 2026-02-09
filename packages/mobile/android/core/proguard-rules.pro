# ProGuard rules for Double-Bind Core module

# Keep CozoDB native library classes
-keep class org.cozodb.** { *; }

# Keep Kotlin serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep Double-Bind serializable classes
-keep,includedescriptorclasses class com.doublebind.core.**$$serializer { *; }
-keepclassmembers class com.doublebind.core.** {
    *** Companion;
}
-keepclasseswithmembers class com.doublebind.core.** {
    kotlinx.serialization.KSerializer serializer(...);
}
