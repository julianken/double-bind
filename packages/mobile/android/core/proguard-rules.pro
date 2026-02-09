# CozoDB JNI - Keep native methods
-keep class org.cozodb.CozoDB { *; }

# Keep GraphDB interface and implementation
-keep class com.doublebind.core.GraphDB { *; }
-keep class com.doublebind.core.CozoGraphDB { *; }
-keep class com.doublebind.core.QueryResult { *; }
-keep class com.doublebind.core.MutationResult { *; }
-keep class com.doublebind.core.GraphDBConfig { *; }
-keep class com.doublebind.core.CozoDBException { *; }

# Kotlinx serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
