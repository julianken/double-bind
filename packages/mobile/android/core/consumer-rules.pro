# Consumer ProGuard rules for Double-Bind Core
# These rules are included in the AAR and applied to the consuming app

# Keep CozoDB classes (JNI)
-keep class org.cozodb.** { *; }

# Keep Double-Bind core classes
-keep class com.doublebind.core.** { *; }
