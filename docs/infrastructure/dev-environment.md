# Development Environment

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| pnpm | 9+ | Package manager |
| Rust | stable (latest) | Compiling CozoDB + Tauri shim |
| Cargo | (comes with Rust) | Rust package manager |

### Platform-Specific Dependencies

**macOS**:
```bash
# Xcode command line tools (for WebKit headers)
xcode-select --install
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

**Windows**:
- WebView2 Runtime (pre-installed on Windows 10/11)
- Visual Studio Build Tools (for Rust compilation)

## First-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/{org}/double-bind.git
cd double-bind

# 2. Install Node.js dependencies
pnpm install

# 3. Build TypeScript packages (in dependency order)
pnpm build

# 4. Run development server
pnpm dev
```

`pnpm dev` starts:
1. Vite dev server on `localhost:5173`
2. Tauri development binary (compiles Rust on first run)
3. Hot module replacement for React code

## Common Commands

```bash
# Development
pnpm dev                # Start Tauri + Vite dev server
pnpm dev:web            # Start Vite only (no Tauri, for UI development)

# Building
pnpm build              # Build all TypeScript packages
pnpm tauri build        # Build production Tauri binary
pnpm tauri build --debug # Build debug Tauri binary

# Testing
pnpm test               # Unit tests (all packages)
pnpm test:watch         # Unit tests in watch mode
pnpm test:integration   # Integration tests (real CozoDB)
pnpm test:e2e           # E2E tests (Playwright + Vite)
pnpm test:e2e:full      # E2E tests (Playwright + Tauri binary)

# Code Quality
pnpm lint               # ESLint
pnpm typecheck          # TypeScript type checking
pnpm format             # Prettier formatting
pnpm format:check       # Check formatting without writing

# Utilities
pnpm clean              # Remove all dist/ and node_modules/
pnpm reset              # Clean + fresh install + build
```

## IDE Setup

### VS Code (Recommended)

Extensions:
- **Rust Analyzer** — Rust language support
- **ESLint** — JavaScript/TypeScript linting
- **Prettier** — Code formatting
- **Tauri** — Tauri development support

Settings:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.workingDirectories": [
    { "pattern": "packages/*" }
  ]
}
```

### Neovim / Other Editors

The project uses standard tools (TypeScript, ESLint, Prettier, rust-analyzer) — any editor with LSP support works.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DOUBLE_BIND_DB_PATH` | Platform app data dir | Override database location |
| `DOUBLE_BIND_TEST_MODE` | `false` | Enable test-specific behaviors |
| `DOUBLE_BIND_LOG_LEVEL` | `info` | Logging verbosity |

These are read by the Rust shim at startup. TypeScript code doesn't read environment variables directly (local-only app).

## Troubleshooting

### Rust compilation fails

```bash
# Update Rust toolchain
rustup update stable

# Clear Cargo cache
cargo clean --manifest-path packages/desktop/src-tauri/Cargo.toml
```

### cozo-node native module fails to load

```bash
# Rebuild native modules
pnpm rebuild

# Or reinstall with explicit platform target
pnpm install --force
```

### Tauri dev server doesn't start

```bash
# Check if port 5173 is in use
lsof -i :5173

# Start Vite separately to see errors
cd packages/desktop && pnpm vite
```

### Tests fail with "CozoDB not found"

Integration tests require `cozo-node` native bindings. Ensure:
1. Rust is installed
2. `pnpm install` completed without errors
3. Platform-specific build tools are installed

### WebKit rendering differences

The Tauri webview uses platform WebKit (macOS/Linux), not Chromium. Test in both:
- `pnpm dev:web` + open in Chrome (for fast iteration)
- `pnpm dev` (for real WebKit rendering)

## Database Location

Development database is stored at the platform-specific app data directory. To start fresh:

```bash
# macOS
rm -rf ~/Library/Application\ Support/com.double-bind.app/db

# Linux
rm -rf ~/.local/share/double-bind/db

# Windows
rmdir /s %APPDATA%\double-bind\db
```

<!-- TODO: Define exact Node.js, pnpm, Rust version requirements -->
<!-- TODO: Define .nvmrc or .node-version file -->
<!-- TODO: Define Docker development environment option -->
<!-- TODO: Define database backup/restore for development -->
<!-- TODO: Define sample data seeding script for development -->
