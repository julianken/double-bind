# Layer 4: E2E Full (Playwright + Tauri Binary)

## Purpose

Test the actual built application. Launches the Tauri binary, connects Playwright to the webview. This is the only layer that exercises the complete stack including Rust code.

Runs on merge to main. Catches IPC serialization bugs, Rust shim behavior, and binary packaging issues.

## How It Works

```
Playwright (WebDriver/CDP)
       │
       ▼
Tauri application window
       │
       ▼
React app in system webview
       │
       ▼
invoke('query', ...) via real Tauri IPC
       │
       ▼
Rust shim (ScriptMutability enforcement)
       │
       ▼
CozoDB (RocksDB backend, real disk I/O)
```

## Setup

### Building the Binary

```bash
# Build debug binary (faster build, includes debug symbols)
pnpm tauri build --debug

# Binary location varies by platform:
# macOS:  src-tauri/target/debug/double-bind
# Linux:  src-tauri/target/debug/double-bind
# Windows: src-tauri/target/debug/double-bind.exe
```

### Launching for Tests

```typescript
// e2e-full/setup/launch-app.ts
import { spawn, ChildProcess } from 'child_process';
import { remote } from 'webdriverio';

let app: ChildProcess;
let tauriDriver: ChildProcess;
let browser: WebdriverIO.Browser;

export async function launchApp() {
  // Start tauri-driver (WebDriver server)
  tauriDriver = spawn('tauri-driver', [], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for tauri-driver to be ready
  await waitForPort(4444);

  // Build path to debug binary
  const binaryPath = process.platform === 'win32'
    ? './src-tauri/target/debug/double-bind.exe'
    : './src-tauri/target/debug/double-bind';

  // Connect via WebDriver
  browser = await remote({
    hostname: '127.0.0.1',
    port: 4444,
    capabilities: {
      'tauri:options': {
        application: binaryPath,
        webviewOptions: {},
      },
    },
  });

  return browser;
}

export async function teardownApp() {
  await browser?.deleteSession();
  tauriDriver?.kill();
  // Clean up test database
  await fs.rm('/tmp/double-bind-test', { recursive: true, force: true });
}
```

## Test Examples

### Application Launch

```typescript
test('app launches and shows empty state', async () => {
  const page = await launchApp();
  await expect(page.getByText('Create your first page')).toBeVisible();
});
```

### IPC Round-Trip

```typescript
test('query command returns valid data', async () => {
  const page = await launchApp();

  // Create a page through the UI
  await page.getByRole('button', { name: 'New Page' }).click();
  await page.getByRole('textbox').fill('Test Page');
  await page.keyboard.press('Enter');

  // Verify data persisted by reloading
  await page.reload();
  await expect(page.getByText('Test Page')).toBeVisible();
});
```

### ScriptMutability Enforcement

```typescript
test('query command rejects mutation attempts', async () => {
  const page = await launchApp();

  // Attempt to call invoke('query') with a mutating script via devtools
  const result = await page.evaluate(async () => {
    try {
      await window.__TAURI_INTERNALS__.invoke('query', {
        script: ':put blocks { block_id: "evil", page_id: "p", content: "hacked", order: 1.0, created_at: 0.0, updated_at: 0.0 }',
        params: {},
      });
      return 'should-have-thrown';
    } catch (e) {
      return e.message;
    }
  });

  expect(result).toContain('immutable'); // CozoDB rejects it
});
```

### Mutate Blocklist

```typescript
test('mutate command rejects ::remove', async () => {
  const page = await launchApp();

  const result = await page.evaluate(async () => {
    try {
      await window.__TAURI_INTERNALS__.invoke('mutate', {
        script: '::remove blocks',
        params: {},
      });
      return 'should-have-thrown';
    } catch (e) {
      return e.message;
    }
  });

  expect(result).toContain('blocked'); // Rust shim blocklist rejects it
});
```

> **Note**: Tests use `window.__TAURI_INTERNALS__` directly because they need to bypass the TypeScript layer to test the Rust shim's security enforcement. In application code, always use `invoke()` from `@tauri-apps/api/core`.

### Persistence Across Restarts

```typescript
test('data persists after app restart', async () => {
  // First launch: create data
  let page = await launchApp();
  await page.getByRole('button', { name: 'New Page' }).click();
  await page.getByRole('textbox').fill('Persistent Page');
  await page.keyboard.press('Enter');
  await teardownApp({ keepDb: true }); // Don't delete the test DB

  // Second launch: verify data
  page = await launchApp(); // Same DB_PATH
  await expect(page.getByText('Persistent Page')).toBeVisible();
  await teardownApp();
});
```

### Backup

```typescript
test('backup command creates a file', async () => {
  const page = await launchApp();
  const backupPath = '/tmp/double-bind-test-backup';

  await page.evaluate(async (path) => {
    await window.__TAURI_INTERNALS__.invoke('backup', { path });
  }, backupPath);

  expect(fs.existsSync(backupPath)).toBe(true);
  const stats = fs.statSync(backupPath);
  expect(stats.size).toBeGreaterThan(0);
});
```

## Configuration

```typescript
// packages/desktop/e2e-full/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000, // Longer timeout for app launch
  retries: 1,     // Retry once (app launch can be flaky)
  workers: 1,     // Serial execution (one app instance at a time)
  use: {
    trace: 'on-first-retry',
  },
  // CRITICAL: JSON reporter for reliable result parsing
  reporter: [
    ['list'],
    ['json', { outputFile: '../../test-results/results.json' }],
    ['html', { outputFolder: '../../playwright-report', open: 'never' }],
  ],
});
```

## Understanding Test Results

Same as Layer 3 — always run the summary command:

```bash
pnpm test:e2e:full
pnpm test:e2e:summary   # REQUIRED - verify results from JSON
```

**NEVER claim "no failures" without checking `pnpm test:e2e:summary`.**

## File Structure

```
packages/desktop/e2e-full/
├── playwright.config.ts
├── setup/
│   └── launch-app.ts          # Build + launch Tauri binary
└── tests/
    ├── app-launch.spec.ts
    ├── ipc-roundtrip.spec.ts
    ├── persistence.spec.ts
    ├── security.spec.ts        # ScriptMutability + blocklist
    └── backup.spec.ts
```

## What This Adds Beyond Layer 3

| Aspect | Layer 3 (Fast) | Layer 4 (Full) |
|--------|:-:|:-:|
| Tauri IPC binary protocol | Mock | Real |
| Rust shim | Skipped | Tested |
| ScriptMutability | Simulated | Engine-enforced |
| RocksDB persistence | In-memory | Real disk |
| Backup to file | No-op | Verified |
| App startup time | N/A | Measured |
| Binary packaging | N/A | Validated |

## Platform Support (Validated)

Architectural review validated the E2E testing options per platform:

| Platform | Webview | Test Connection | Status |
|----------|---------|----------------|--------|
| Linux | WebKitGTK | **tauri-driver + WebdriverIO** | Supported (WebKitWebDriver) |
| Windows | WebView2 (Chromium) | **Playwright CDP** or **tauri-driver** | Supported |
| macOS | WKWebView | **Not supported** | No WKWebView WebDriver exists (Tauri issue #7068) |

### Why Not Playwright CDP Everywhere?

Playwright's `connectOverCDP()` only works with Chromium-based browsers. On Linux, Tauri uses WebKitGTK (WebKit-based, not Chromium). On macOS, Tauri uses WKWebView (also WebKit). CDP simply does not work on these platforms.

### tauri-driver

`tauri-driver` is an official Tauri project (Rust crate v2.0.4, npm `@crabnebula/tauri-driver` v2.0.8). It wraps platform-specific WebDriver implementations:
- **Linux**: Uses `webkit2gtk-driver` (WebKitWebDriver)
- **Windows**: Uses Microsoft Edge Driver
- **macOS**: No WebDriver available for WKWebView

Documented in the official [Tauri v2 WebDriver docs](https://v2.tauri.app/develop/tests/webdriver/) with examples for [WebdriverIO](https://v2.tauri.app/develop/tests/webdriver/example/webdriverio/) and [Selenium](https://v2.tauri.app/develop/tests/webdriver/example/selenium/).

### CI Strategy

```yaml
# GitHub Actions matrix
strategy:
  matrix:
    include:
      - os: ubuntu-latest    # Layer 4: tauri-driver + WebdriverIO
      - os: windows-latest   # Layer 4: tauri-driver + WebdriverIO (or Playwright CDP)
      # macOS: Layer 4 skipped (no WebDriver support for WKWebView)
      # macOS is tested at Layer 3 (mock IPC) only
```

## Resolved Decisions

- **Test connection**: tauri-driver + WebdriverIO on Linux/Windows. macOS skipped at Layer 4.
- **CI matrix**: Ubuntu + Windows. macOS tested at Layer 3 only.
- **App launch**: tauri-driver handles binary launch via WebDriver capabilities
- **Headless mode**: tauri-driver supports headless on Linux (set `DISPLAY` env var)
- **Database isolation**: Each test uses a unique `DOUBLE_BIND_DB_PATH` in `/tmp/`
