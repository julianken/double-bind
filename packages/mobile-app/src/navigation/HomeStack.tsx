/**
 * HomeStack - Home/Daily Notes navigation stack
 *
 * Handles navigation for the home tab including:
 * - Main home screen (dashboard)
 * - Daily notes view
 */

import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { DailyNoteScreen } from '../screens/DailyNoteScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Double Bind',
          // Disable large title to prevent content overlap issues
          headerLargeTitle: false,
        }}
      />
      <Stack.Screen
        name="DailyNote"
        component={DailyNoteScreen}
        options={({ route }) => ({
          title: route.params?.date ?? "Today's Note",
        })}
      />
    </Stack.Navigator>
  );
}
