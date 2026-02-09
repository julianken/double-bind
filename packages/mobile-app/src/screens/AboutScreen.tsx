/**
 * AboutScreen - App information
 *
 * Displays:
 * - App version
 * - Credits
 * - Links to documentation
 */

import * as React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import type { SettingsStackScreenProps } from '../navigation/types';

type Props = SettingsStackScreenProps<'About'>;

export function AboutScreen(_props: Props): React.ReactElement {
  const handleLinkPress = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appIcon}>📝</Text>
        <Text style={styles.appName}>Double Bind</Text>
        <Text style={styles.version}>Version 0.0.1</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.description}>
          A local-first note-taking app with graph-native architecture. All your data stays on your
          device.
        </Text>
      </View>

      <View style={styles.linksSection}>
        <TouchableOpacity
          style={styles.link}
          onPress={() => handleLinkPress('https://github.com/double-bind/double-bind')}
          accessibilityRole="link"
          accessibilityLabel="View source code on GitHub"
        >
          <Text style={styles.linkText}>GitHub Repository</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.link}
          onPress={() =>
            handleLinkPress('https://github.com/double-bind/double-bind/blob/main/docs')
          }
          accessibilityRole="link"
          accessibilityLabel="View documentation"
        >
          <Text style={styles.linkText}>Documentation</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Built with React Native, CozoDB, and TypeScript</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
  },
  appIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    padding: 16,
  },
  description: {
    fontSize: 15,
    color: '#3C3C43',
    textAlign: 'center',
    lineHeight: 22,
  },
  linksSection: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  link: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  linkText: {
    fontSize: 17,
    color: '#007AFF',
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#8E8E93',
  },
});
