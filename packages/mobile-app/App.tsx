/**
 * Double-Bind Mobile App
 *
 * Root entry point that wraps the main application with providers.
 */

import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DatabaseProvider } from "./src/providers/DatabaseProvider";
import { App as MainApp } from "./src/App";

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <MainApp />
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}

export default App;
