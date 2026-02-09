/**
 * App - Root application component for Double Bind Mobile
 *
 * Sets up:
 * - React Navigation with NavigationContainer
 * - Deep linking configuration
 * - Safe area handling
 * - Theme provider (future)
 */

import * as React from 'react';
import { StatusBar, StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './navigation/RootNavigator';
import { linking } from './navigation/linking';

/**
 * Loading fallback component shown while deep link is being resolved.
 */
function LoadingFallback(): React.ReactElement {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

/**
 * Root App component.
 *
 * Provides the navigation container with:
 * - Deep linking support via linking config
 * - Safe area insets for notched devices
 * - Loading fallback for link resolution
 */
export function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer
        linking={linking}
        fallback={<LoadingFallback />}
        onReady={() => {
          // Navigation container is ready
          // Can be used for analytics, splash screen hiding, etc.
        }}
        onStateChange={(_state) => {
          // Track navigation state changes
          // Can be used for analytics or state persistence
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
});

export default App;
