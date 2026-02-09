/**
 * BlockDetailScreen - Modal block detail view
 *
 * Full-screen modal for viewing/editing a specific block.
 * Shows block content and context (parent page, backlinks).
 */

import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RootStackScreenProps } from '../navigation/types';

type Props = RootStackScreenProps<'BlockDetail'>;

export function BlockDetailScreen({ route }: Props): React.ReactElement {
  const { blockId, pageId } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.metadata}>
          <Text style={styles.metadataLabel}>Block ID:</Text>
          <Text style={styles.metadataValue}>{blockId}</Text>
        </View>
        <View style={styles.metadata}>
          <Text style={styles.metadataLabel}>Page ID:</Text>
          <Text style={styles.metadataValue}>{pageId}</Text>
        </View>
        <Text style={styles.placeholder}>
          Block content and backlinks will appear here. This is a modal view for focused block
          editing.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  metadata: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  metadataLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginRight: 8,
  },
  metadataValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#3C3C43',
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
    marginTop: 16,
    lineHeight: 22,
  },
});
