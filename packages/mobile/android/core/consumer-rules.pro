# Consumer ProGuard rules for double-bind-core
# These rules are automatically included in consuming apps

# Keep CozoDB JNI classes when library is used
-keep class org.cozodb.** { *; }

# Keep GraphDB interface and data classes
-keep class com.doublebind.core.GraphDB { *; }
-keep class com.doublebind.core.QueryResult { *; }
-keep class com.doublebind.core.MutationResult { *; }
-keep class com.doublebind.core.GraphDBConfig { *; }

# Keep kotlinx.serialization for data classes used by consumers
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep serializers for GraphDB data classes
-keep,includedescriptorclasses class com.doublebind.core.**$$serializer { *; }
-keepclassmembers class com.doublebind.core.** {
    *** Companion;
}
-keepclasseswithmembers class com.doublebind.core.** {
    kotlinx.serialization.KSerializer serializer(...);
}
