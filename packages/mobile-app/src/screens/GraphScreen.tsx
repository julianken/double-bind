/**
 * GraphScreen - Knowledge graph visualization
 *
 * Displays the full knowledge graph showing:
 * - All pages as nodes
 * - Links between pages as edges
 * - Interactive zoom and pan
 */

import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { GraphStackScreenProps } from '../navigation/types';

type Props = GraphStackScreenProps<'Graph'>;

export function GraphScreen({ navigation }: Props): React.ReactElement {
  const handleNodePress = (nodeId: string) => {
    navigation.navigate('GraphNode', { nodeId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.graphPlaceholder}>
          <Text style={styles.graphIcon}>🔗</Text>
          <Text style={styles.graphText}>Graph Visualization</Text>
        </View>

        <TouchableOpacity
          style={styles.nodeButton}
          onPress={() => handleNodePress('example-node')}
          accessibilityRole="button"
          accessibilityLabel="View example node details"
        >
          <Text style={styles.nodeButtonText}>View Example Node</Text>
        </TouchableOpacity>

        <Text style={styles.placeholder}>Interactive graph will be displayed here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  graphPlaceholder: {
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  graphIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  graphText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  nodeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  nodeButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
