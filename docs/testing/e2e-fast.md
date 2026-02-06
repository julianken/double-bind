# Layer 3: E2E Fast (Playwright + Vite)

## Purpose

Test UI flows in a real browser against the Vite dev server. Tauri's `invoke()` calls are intercepted by a test shim that routes to `cozo-node` — no Rust binary needed.

This is the primary E2E layer. It runs on every PR and catches most UI bugs.

## How It Works

```
Playwright browser
       │
       ▼
Vite dev server (localhost:5173)
       │
       ▼
React app renders normally
       │
       ▼
invoke('query', ...) called
       │
       ▼
Test shim intercepts invoke()  ◄── NOT real Tauri IPC
       │
       ▼
cozo-node (in-memory)          ◄── Real CozoDB, no Rust
       │
       ▼
Result returned to React
```

## Mock Strategy: HTTP Bridge + `mockIPC()`

`cozo-node` is a native NAPI module that cannot run in the browser. Layer 3 uses an HTTP bridge: a lightweight Node.js server wraps `cozo-node` and listens on `localhost:3001`, while `mockIPC()` from `@tauri-apps/api/mocks` intercepts Tauri IPC calls in the browser and forwards them as `fetch()` requests to the bridge.

### HTTP Bridge Server (Node.js side)

```typescript
// e2e/setup/global-setup.ts
import express from 'express';
import { CozoDb } from 'cozo-node';
import { runMigrations } from '@double-bind/migrations';

const app = express();
app.use(express.json());

const testDb = new CozoDb('mem');
await runMigrations(testDb);

app.post('/invoke', async (req, res) => {
  const { cmd, args } = req.body;
  try {
    switch (cmd) {
      case 'query':
        res.json(await testDb.run(args.script, args.params, true));
        break;
      case 'mutate':
        res.json(await testDb.run(args.script, args.params, false));
        break;
      case 'import_relations':
        await testDb.importRelations(args.data);
        res.json({});
        break;
      case 'export_relations':
        res.json(await testDb.exportRelations(args.relations));
        break;
      case 'backup':
        res.json({});  // no-op in tests
        break;
      default:
        res.status(400).json({ error: `Unknown command: ${cmd}` });
    }
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(3001);
```

### Browser-Side Mock (injected via Vite)

```typescript
// e2e/setup/mock-tauri.ts (runs in browser context)
import { mockIPC } from '@tauri-apps/api/mocks';

mockIPC(async (cmd, args) => {
  const response = await fetch('http://localhost:3001/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, args }),
  });
  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(error);
  }
  return response.json();
});
```

### Known Divergences from Real IPC

The HTTP bridge replaces Tauri's binary IPC with HTTP + JSON. This means Layer 3 tests do **not** exercise:

| Aspect | Real Tauri | HTTP Bridge Mock |
|--------|-----------|------------------|
| Serialization | Binary IPC (serde) | HTTP + JSON |
| Async model | Rust thread pool | Node.js event loop |
| Error format | Serialized Rust error strings | JavaScript Error objects |
| ScriptMutability | Engine-enforced | Not enforced (bridge passes `true`/`false` to cozo-node) |
| Concurrency | Multi-threaded Rust | Single-threaded Node.js |
| u64 overflow | Values > 2^53 truncated by JSON | Same truncation (both use JSON) |

These divergences are tested at Layer 4 (full stack E2E).

## Test Examples

### Page CRUD

```typescript
test('create a new page and see it in sidebar', async ({ page }) => {
  await page.goto('/');

  // Click "New Page" button
  await page.getByRole('button', { name: 'New Page' }).click();

  // Type page title
  await page.getByRole('textbox', { name: 'Page title' }).fill('My First Page');
  await page.keyboard.press('Enter');

  // Verify page appears in sidebar
  await expect(page.getByRole('navigation').getByText('My First Page')).toBeVisible();
});
```

### Block Editor

```typescript
test('create nested blocks with indentation', async ({ page }) => {
  await page.goto('/page/test-page');

  // Type in the editor
  await page.getByRole('textbox').fill('Parent block');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); // Indent
  await page.getByRole('textbox').fill('Child block');

  // Verify indentation is rendered
  const childBlock = page.locator('[data-indent-level="1"]');
  await expect(childBlock).toContainText('Child block');
});
```

### Navigation

```typescript
test('clicking a page link navigates to that page', async ({ page }) => {
  // Seed a page with a [[link]]
  await seedTestData({ pages: [
    { id: 'p1', title: 'Page One', blocks: [{ content: 'See [[Page Two]]' }] },
    { id: 'p2', title: 'Page Two', blocks: [{ content: 'Hello' }] },
  ]});

  await page.goto('/page/p1');
  await page.getByRole('link', { name: 'Page Two' }).click();

  await expect(page).toHaveURL(/\/page\/p2/);
  await expect(page.getByText('Hello')).toBeVisible();
});
```

### Search

```typescript
test('search finds pages by title', async ({ page }) => {
  await seedTestData({ pages: [
    { id: 'p1', title: 'Quantum Computing Notes' },
    { id: 'p2', title: 'Classical Music Theory' },
  ]});

  await page.goto('/');
  await page.getByRole('searchbox').fill('quantum');

  await expect(page.getByRole('listbox').getByText('Quantum Computing Notes')).toBeVisible();
  await expect(page.getByRole('listbox').getByText('Classical Music Theory')).not.toBeVisible();
});
```

## Configuration

```typescript
// packages/desktop/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:5173',
  },
  // CRITICAL: JSON reporter for reliable result parsing
  // Terminal output may not show failure counts (TTY issues, background runs)
  reporter: [
    ['list'],
    ['json', { outputFile: '../../test-results/results.json' }],
    ['html', { outputFolder: '../../playwright-report', open: 'never' }],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // WebKit too, since Tauri uses WebKit on macOS
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
```

## Understanding Test Results

**CRITICAL:** Always run the summary command to see failure counts clearly:

```bash
# Step 1: Run tests (generates JSON results)
pnpm test:e2e

# Step 2: View clear summary
pnpm test:e2e:summary

Test Results Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  3 failed      ← ALWAYS clearly visible
  2 skipped
  45 passed
  50 total
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Why the summary command is necessary:**
- Terminal output may not show failure counts (background runs, TTY issues)
- The JSON reporter writes complete results to `test-results/results.json`
- `pnpm test:e2e:summary` parses JSON and displays counts clearly
- **NEVER claim "no failures" without checking the summary**

**Viewing failure details:**

```bash
# View detailed results
ls test-results/

# View screenshots of failures
open test-results/<test-name>/test-failed-1.png
```
```

## File Structure

```
packages/desktop/e2e/
├── playwright.config.ts
├── setup/
│   ├── mock-tauri.ts           # Replaces invoke() with cozo-node
│   └── global-setup.ts         # Start cozo-node bridge if needed
├── fixtures/
│   ├── test-data.ts            # Seed data helpers
│   └── page-object.ts          # Page object models
└── tests/
    ├── page-crud.spec.ts
    ├── block-editor.spec.ts
    ├── block-references.spec.ts
    ├── navigation.spec.ts
    ├── backlinks.spec.ts
    ├── search.spec.ts
    ├── graph-view.spec.ts
    └── keyboard-shortcuts.spec.ts
```

## What This Does NOT Test

- Tauri IPC serialization (binary protocol, not HTTP)
- Rust shim (`ScriptMutability` enforcement in Rust)
- Real file system operations (backup writes to disk)
- Application startup/initialization
- WebKit-specific rendering on actual Tauri webview

These gaps are covered by Layer 4 (E2E Full).

## Resolved Decisions

- **Mock strategy**: HTTP bridge approach. `cozo-node` is a native NAPI module that cannot run in the browser. A lightweight HTTP server (`global-setup.ts`) wraps `cozo-node` and listens on `localhost:3001`. The `mockIPC()` callback in the browser sends `fetch()` requests to this server. This adds ~10 lines of Express/Fastify boilerplate but cleanly separates the Node.js NAPI dependency from the browser context.
- **Test data seeding**: Direct DB via the HTTP bridge. `seedTestData()` sends migration + insert requests to `localhost:3001` before each test.
- **Page object model**: Lightweight — one POM per screen (PageViewPOM, SidebarPOM, SearchPOM). Encapsulates selectors and common actions.
- **Visual regression**: Deferred. Focus on functional E2E first.
- **cozo-wasm**: Not viable — CozoDB's WASM build lacks RocksDB storage engine and has limited FTS support. HTTP bridge to `cozo-node` is the correct approach.
