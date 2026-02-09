# Consumer rules for double-bind core library
# These rules are included when this library is consumed by another module

# Keep CozoDB JNI native methods
-keep class org.cozodb.CozoDB { *; }

# Keep public API
-keep class com.doublebind.core.** { *; }
