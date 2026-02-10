# Mobile E2E Test Infrastructure

This directory contains the end-to-end (E2E) test infrastructure for the Double-Bind mobile app.

## Status

**Infrastructure Prep Phase**: This is foundational infrastructure. Detox is not yet installed.

The test specifications and helpers are ready for implementation but use mock implementations. When ready to activate E2E testing, follow the installation steps below.

## Test Framework

We use **Detox** for React Native E2E testing, chosen for:

- Native React Native support (vs. Appium's web-driver approach)
- Fast, synchronous test execution
- Built-in gesture support (swipe, pinch, drag)
- Gray-box testing (can access app internals)
- Excellent TypeScript support

## Directory Structure

```
test/e2e/
├── setup/
│   ├── detox.config.ts       # Detox configuration template
│   ├── jest.config.js        # Jest config for Detox runner
│   ├── detox-setup.ts        # Global test setup/teardown
│   └── testHelpers.ts        # Reusable test utilities
├── mocks/
│   └── DeviceMock.ts         # Device capability mocks
└── specs/
    ├── appLaunch.spec.ts          # App initialization tests
    ├── pageOperations.spec.ts     # Page CRUD tests
    ├── blockManipulation.spec.ts  # Block editing with touch
    └── graphInteraction.spec.ts   # Graph visualization tests
```

## Installation (When Ready)

### 1. Install Detox

```bash
pnpm add -D detox @types/detox detox-expo-helpers
```

### 2. Install Device Drivers

**iOS (macOS only):**

```bash
brew tap wix/brew
brew install applesimutils
```

**Android:**

Ensure Android SDK is installed with emulator support.

### 3. Configure iOS Project

Add Detox to `ios/Podfile`:

```ruby
target 'DoubleBindMobile' do
  # ... existing pods ...

  # Detox (for E2E tests)
  pod 'DetoxSync', :configurations => ['Debug'], :modular_headers => true
end
```

Run `pod install`:

```bash
cd ios && pod install
```

### 4. Configure Android Project

Add to `android/app/build.gradle`:

```gradle
dependencies {
    // ... existing dependencies ...

    androidTestImplementation('com.wix:detox:+')
}
```

Add to `android/build.gradle`:

```gradle
allprojects {
    repositories {
        // ... existing repositories ...
        maven { url 'https://maven.google.com' }
    }
}
```

### 5. Update package.json

Add E2E test scripts:

```json
{
  "scripts": {
    "test:e2e:ios": "detox test -c ios.sim.debug",
    "test:e2e:android": "detox test -c android.emu.debug",
    "test:e2e:build:ios": "detox build -c ios.sim.debug",
    "test:e2e:build:android": "detox build -c android.emu.debug"
  }
}
```

## Running Tests

### Build App for Testing

**iOS:**

```bash
pnpm test:e2e:build:ios
```

**Android:**

```bash
pnpm test:e2e:build:android
```

### Run Tests

**iOS:**

```bash
pnpm test:e2e:ios
```

**Android:**

```bash
pnpm test:e2e:android
```

### Run Specific Test Suite

```bash
detox test -c ios.sim.debug test/e2e/specs/pageOperations.spec.ts
```

## Test Categories

### 1. App Launch (`appLaunch.spec.ts`)

- App initialization
- Splash screen handling
- Database setup
- Safe area handling
- Memory pressure scenarios

### 2. Page Operations (`pageOperations.spec.ts`)

- Create/edit/delete pages
- Page navigation
- Search and filtering
- Swipe gestures
- Offline support

### 3. Block Manipulation (`blockManipulation.spec.ts`)

- Block creation with mobile keyboard
- Touch-based editing
- Swipe to indent/outdent
- Drag-and-drop reordering
- Long-press context menus

### 4. Graph Interaction (`graphInteraction.spec.ts`)

- Pinch-to-zoom
- Pan gestures
- Node selection
- Graph filtering
- Layout algorithms

## Critical Constraints

### Sequential Execution Only

**NEVER run E2E tests in parallel.** Always use `--workers=1`:

```bash
detox test --workers=1
```

Reasons:

- Device simulators conflict when running parallel tests
- Severe system resource exhaustion (CPU/memory)
- Test isolation requires exclusive device access

This is enforced in `jest.config.js` (`maxWorkers: 1`).

### Test Isolation

Each test should:

1. Reset app state in `beforeEach`
2. Not depend on other tests
3. Clean up after itself
4. Use unique test data identifiers

## Mock Implementations

During infrastructure prep, tests use mock implementations:

- `testHelpers.ts`: Mock Detox API calls with console logs
- `DeviceMock.ts`: Mock device capabilities and gestures

When Detox is installed, replace mocks with actual Detox API calls.

## Debugging

### Take Screenshots

```typescript
await takeScreenshot('debug-screenshot');
```

Screenshots saved to: `test/e2e/artifacts/`

### View Test Logs

```bash
detox test --loglevel trace
```

### Debug Single Test

```bash
detox test -c ios.sim.debug --debug-synchronization 200
```

### Common Issues

**App won't launch:**

- Verify build succeeded
- Check simulator is available: `xcrun simctl list`
- Rebuild: `pnpm test:e2e:build:ios`

**Tests timeout:**

- Increase timeout in test: `{ timeout: 30000 }`
- Check for asynchronous operations not properly awaited

**Gestures not working:**

- Ensure test IDs are set: `testID="element-name"`
- Verify element is visible before interaction
- Add `await wait(300)` after animations

## CI Integration

### GitHub Actions

When ready for CI, add to `.github/workflows/mobile-e2e.yml`:

```yaml
name: Mobile E2E Tests

on: [pull_request]

jobs:
  test-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:e2e:build:ios
      - run: pnpm test:e2e:ios
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: detox-artifacts
          path: test/e2e/artifacts/

  test-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:e2e:build:android
      - run: pnpm test:e2e:android
```

## Best Practices

1. **Use testID for all interactive elements** - Detox relies on stable identifiers
2. **Wait for elements before interaction** - Always `await waitForElement()`
3. **Keep tests focused** - One behavior per test
4. **Use descriptive names** - Test names should explain what's being tested
5. **Mock external dependencies** - API calls, push notifications, etc.
6. **Test on both platforms** - iOS and Android may behave differently
7. **Handle animations** - Wait for animations to complete
8. **Test error states** - Network failures, database errors, etc.

## Performance Considerations

- **Large graphs**: Use level-of-detail rendering
- **Memory pressure**: Simulate with `device.simulateMemoryPressure()`
- **Slow networks**: Test with `device.setNetworkCondition('slow-3g')`
- **Battery optimization**: Test background/foreground transitions

## Accessibility Testing

- Verify VoiceOver compatibility
- Test with larger text sizes
- Ensure touch targets are ≥44x44 points
- Test with reduced motion enabled

## Related Documentation

- [Detox Documentation](https://wix.github.io/Detox/)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- Double-Bind: `docs/testing/e2e-mobile.md` (to be created)
