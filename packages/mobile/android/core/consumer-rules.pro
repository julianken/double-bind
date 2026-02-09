# Consumer ProGuard rules for double-bind-core
# These rules are automatically included in consuming apps

# Keep CozoDB JNI classes when library is used
-keep class org.cozodb.** { *; }

# Keep GraphDB interface and data classes
-keep class com.doublebind.core.GraphDB { *; }
-keep class com.doublebind.core.QueryResult { *; }
-keep class com.doublebind.core.MutationResult { *; }
-keep class com.doublebind.core.GraphDBConfig { *; }
