"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ExternalKeyboard = void 0;
exports.dismiss = dismiss;
var _reactNative = require("react-native");
const LINKING_ERROR = `The package 'react-native-external-keyboard' doesn't seem to be linked. Make sure: \n\n${_reactNative.Platform.select({
  ios: "- You have run 'pod install'\n",
  default: ''
})}- You rebuilt the app after installing the package\n` + `- You are not using Expo Go\n`;

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null;
const ExternalKeyboardModule = isTurboModuleEnabled ? require('../nativeSpec/NativeExternalKeyboardModule').default : _reactNative.NativeModules.ExternalKeyboardModule;
const ExternalKeyboard = exports.ExternalKeyboard = ExternalKeyboardModule || new Proxy({}, {
  get() {
    throw new Error(LINKING_ERROR);
  }
});
function dismiss() {
  _reactNative.Keyboard.dismiss();
  ExternalKeyboard.dismissKeyboard();
}
//# sourceMappingURL=Keyboard.android.js.map