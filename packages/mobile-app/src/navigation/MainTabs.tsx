/**
 * MainTabs - Bottom tab navigator
 *
 * Main navigation structure with five tabs:
 * - Home: Daily notes and dashboard
 * - Pages: Page list and management
 * - Search: Full-text search
 * - Graph: Knowledge graph visualization
 * - Settings: App configuration
 */

import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet } from 'react-native';
import type { MainTabParamList } from './types';
import { HomeStack } from './HomeStack';
import { PagesStack } from './PagesStack';
import { SearchStack } from './SearchStack';
import { GraphStack } from './GraphStack';
import { SettingsStack } from './SettingsStack';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Tab icon component - placeholder using text icons.
 * Will be replaced with proper icon library in future.
 */
function TabIcon({
  name,
  focused,
  color,
}: {
  name: string;
  focused: boolean;
  color: string;
}): React.ReactElement {
  const icons: Record<string, { active: string; inactive: string }> = {
    HomeTab: { active: '🏠', inactive: '🏡' },
    PagesTab: { active: '📄', inactive: '📃' },
    SearchTab: { active: '🔍', inactive: '🔎' },
    GraphTab: { active: '🔗', inactive: '⛓️' },
    SettingsTab: { active: '⚙️', inactive: '🔧' },
  };

  const icon = icons[name] ?? { active: '●', inactive: '○' };

  return <Text style={[styles.icon, { color }]}>{focused ? icon.active : icon.inactive}</Text>;
}

export function MainTabs(): React.ReactElement {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tab.Screen
        name="PagesTab"
        component={PagesStack}
        options={{
          tabBarLabel: 'Pages',
          tabBarAccessibilityLabel: 'Pages tab',
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchStack}
        options={{
          tabBarLabel: 'Search',
          tabBarAccessibilityLabel: 'Search tab',
        }}
      />
      <Tab.Screen
        name="GraphTab"
        component={GraphStack}
        options={{
          tabBarLabel: 'Graph',
          tabBarAccessibilityLabel: 'Graph tab',
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStack}
        options={{
          tabBarLabel: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 20,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
