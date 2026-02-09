# Consumer ProGuard rules for Double-Bind Android core module
# These rules are applied to consumers of this library

# Keep CozoDB JNI classes
-keep class org.cozodb.** { *; }

# Keep public API classes
-keep class com.doublebind.core.CozoModule { *; }
-keep class com.doublebind.core.CozoPackage { *; }
-keep class com.doublebind.core.CozoGraphDB { *; }
