# @double-bind/mobile-app

React Native mobile application for Double-Bind.

## Prerequisites

- Node.js >= 20.0.0
- pnpm 9.15.0+
- For iOS: Xcode 15+, CocoaPods
- For Android: Android Studio, JDK 17

## Setup

```bash
# Install dependencies from monorepo root
pnpm install

# Install iOS dependencies
cd ios && pod install && cd ..
```

## Development

```bash
# Start Metro bundler
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

## Building

```bash
# Build Android release APK
pnpm build:android

# Build iOS release archive
pnpm build:ios
```

## Testing

```bash
# Run unit tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Architecture

This package contains the React Native application shell. Native modules for CozoDB integration are provided by `@double-bind/mobile`.
