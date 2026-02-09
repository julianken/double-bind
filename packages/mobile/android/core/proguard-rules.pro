# ProGuard rules for Double-Bind Android core module

# Keep CozoDB JNI classes
-keep class org.cozodb.** { *; }

# Keep React Native module classes
-keep class com.doublebind.core.CozoModule { *; }
-keep class com.doublebind.core.CozoPackage { *; }
-keep class com.doublebind.core.CozoGraphDB { *; }

# Keep @ReactMethod annotated methods
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# Keep ReactPackage implementations
-keep class * implements com.facebook.react.ReactPackage { *; }

# Keep native module constructors
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    <init>(...);
}
