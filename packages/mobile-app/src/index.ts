/**
 * @double-bind/mobile-app
 *
 * React Native mobile application for Double Bind.
 * This is the entry point that registers the app with React Native.
 */

import { AppRegistry } from 'react-native';
import { App } from './App';

// Register the app component
AppRegistry.registerComponent('DoubleBind', () => App);

// Re-export for external usage
export { App } from './App';
export * from './navigation';
export * from './screens';
