# ProGuard rules for double-bind-core Android library

# Keep CozoDB JNI classes
-keep class org.cozodb.** { *; }

# Keep kotlinx.serialization classes
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep GraphDB data classes for serialization
-keep,includedescriptorclasses class com.doublebind.core.**$$serializer { *; }
-keepclassmembers class com.doublebind.core.** {
    *** Companion;
}
-keepclasseswithmembers class com.doublebind.core.** {
    kotlinx.serialization.KSerializer serializer(...);
}
