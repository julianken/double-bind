/**
 * GraphStack - Graph visualization navigation stack
 *
 * Handles navigation for the graph tab including:
 * - Full graph view
 * - Graph node detail view
 */

import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { GraphStackParamList } from './types';
import { GraphScreen } from '../screens/GraphScreen';
import { GraphNodeScreen } from '../screens/GraphNodeScreen';

const Stack = createNativeStackNavigator<GraphStackParamList>();

export function GraphStack(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="Graph"
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Graph"
        component={GraphScreen}
        options={{
          title: 'Graph',
          // Disable large title - it conflicts with the fixed controls section below
          headerLargeTitle: false,
        }}
      />
      <Stack.Screen
        name="GraphNode"
        component={GraphNodeScreen}
        options={{
          title: 'Node Details',
        }}
      />
    </Stack.Navigator>
  );
}
