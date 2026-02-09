/**
 * GraphNodeScreen - Graph node detail view
 *
 * Shows details for a selected node in the graph:
 * - Node properties
 * - Connected nodes
 * - Navigation to page
 */

import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GraphStackScreenProps } from '../navigation/types';

type Props = GraphStackScreenProps<'GraphNode'>;

export function GraphNodeScreen({ route }: Props): React.ReactElement {
  const { nodeId } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.nodeId}>Node ID: {nodeId}</Text>
        <Text style={styles.placeholder}>Node details and connections will appear here.</Text>
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
  nodeId: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#8E8E93',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
