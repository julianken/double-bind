/**
 * @format
 */

// MUST be first import - initializes native worklets module
import "react-native-reanimated";

import { AppRegistry } from "react-native";
import App from "./App";

// Must match moduleName in AppDelegate.mm
const appName = "MobileApp";

AppRegistry.registerComponent(appName, () => App);
