# @double-bind/mobile-app

React Native mobile application for Double-Bind.

## Overview

This package contains the React Native mobile application with:

- React Navigation v6 for navigation (tabs and stacks)
- Deep linking support (`doublebind://` URLs)
- TypeScript with type-safe navigation

## Structure

```
src/
├── App.tsx              # Root app component
├── index.ts             # Entry point
├── navigation/          # Navigation configuration
│   ├── types.ts         # Navigation type definitions
│   ├── RootNavigator.tsx    # Root stack navigator
│   ├── MainTabs.tsx     # Bottom tab navigator
│   ├── HomeStack.tsx    # Home tab navigation
│   ├── PagesStack.tsx   # Pages tab navigation
│   ├── SearchStack.tsx  # Search tab navigation
│   ├── GraphStack.tsx   # Graph tab navigation
│   ├── SettingsStack.tsx    # Settings tab navigation
│   └── linking.ts       # Deep linking configuration
└── screens/             # Screen components
    ├── HomeScreen.tsx
    ├── PageListScreen.tsx
    └── ...
```

## Navigation Structure

```
RootNavigator (Native Stack)
├── MainTabs (Bottom Tabs)
│   ├── HomeTab (Native Stack)
│   │   ├── Home
│   │   └── DailyNote
│   ├── PagesTab (Native Stack)
│   │   ├── PageList
│   │   └── Page
│   ├── SearchTab (Native Stack)
│   │   ├── Search
│   │   └── SearchResults
│   ├── GraphTab (Native Stack)
│   │   ├── Graph
│   │   └── GraphNode
│   └── SettingsTab (Native Stack)
│       ├── Settings
│       ├── ThemeSettings
│       ├── DatabaseSettings
│       └── About
├── PageDetail (Modal)
└── BlockDetail (Modal)
```

## Deep Linking

The app supports deep links with the `doublebind://` URL scheme:

| URL                                      | Screen               |
| ---------------------------------------- | -------------------- |
| `doublebind://home`                      | Home                 |
| `doublebind://pages`                     | Page List            |
| `doublebind://pages/:pageId`             | Page View            |
| `doublebind://search`                    | Search               |
| `doublebind://graph`                     | Graph                |
| `doublebind://settings`                  | Settings             |
| `doublebind://page/:pageId`              | Page Detail (Modal)  |
| `doublebind://block/:blockId?pageId=xxx` | Block Detail (Modal) |

## Development

```bash
# Start Metro bundler
pnpm start

# Run on iOS simulator
pnpm ios

# Run on Android emulator
pnpm android

# Type check (warnings expected due to React 18/19 compatibility)
pnpm typecheck
```

## Known Issues

### TypeScript Errors with React Navigation

This package uses React Navigation v6 which was built with React 18 types. The monorepo uses React 19 for the desktop app, causing TypeScript errors like:

```
'Stack.Navigator' cannot be used as a JSX component.
```

**This is a known compatibility issue.** The code is valid and works correctly at runtime with React Native's bundled React 18. The errors will be resolved when:

1. React Navigation v7 adds full React 19 support, or
2. The monorepo migrates to a separate tsconfig for mobile

For now, `pnpm typecheck` will show warnings but not fail the build.

## Dependencies

- `@react-navigation/native` - Core navigation
- `@react-navigation/bottom-tabs` - Tab navigator
- `@react-navigation/native-stack` - Native stack navigator
- `react-native-screens` - Native screen containers
- `react-native-safe-area-context` - Safe area handling
