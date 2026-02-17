/**
 * React Native package that registers the DatabaseModule native module.
 *
 * This package is added to the list of packages in MainApplication to expose
 * the DatabaseModule to JavaScript via NativeModules.
 *
 * Integration in MainApplication.kt:
 * ```kotlin
 * override fun getPackages(): List<ReactPackage> =
 *     PackageList(this).packages.apply {
 *         add(DatabasePackage())
 *     }
 * ```
 */
package com.doublebind.core

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Package that registers DatabaseModule with React Native.
 *
 * This class follows the standard React Native pattern for exposing native
 * modules to JavaScript. It creates no view managers since DatabaseModule is
 * a headless utility module.
 */
class DatabasePackage : ReactPackage {

    /**
     * Create native modules to register with React Native.
     *
     * @param reactContext The React application context
     * @return List containing the DatabaseModule instance
     */
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(DatabaseModule(reactContext))
    }

    /**
     * Create view managers to register with React Native.
     *
     * DatabaseModule is a headless utility module with no UI components,
     * so this returns an empty list.
     *
     * @param reactContext The React application context
     * @return Empty list (no view managers)
     */
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
