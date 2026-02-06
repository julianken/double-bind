# ADR-003: Tauri v2 as Desktop Shell

## Status
Accepted

## Context

The desktop app needs a shell that provides a webview for React rendering and access to the local filesystem for CozoDB's RocksDB storage.

## Options Considered

### 1. Electron
- **Pros**: Mature, huge ecosystem, consistent Chromium rendering, well-documented
- **Cons**: Bundles Chromium (~150MB binary), high RAM usage (~200-300MB baseline), large attack surface

### 2. Tauri v2
- **Pros**: Uses system webview (~10MB binary), low RAM (~30-50MB baseline), Rust backend, granular capability system for security
- **Cons**: Rendering differences across platforms (WebKit on macOS, WebView2 on Windows), younger ecosystem, requires Rust toolchain for building

### 3. Neutralinojs
- **Pros**: Very lightweight
- **Cons**: Less mature, smaller community, limited API surface

## Decision

Tauri v2.

## Consequences

**Positive**:
- ~10MB binary vs ~150MB for Electron
- ~30-50MB RAM vs ~200-300MB for Electron
- Rust backend naturally hosts CozoDB (also Rust)
- Tauri v2 capabilities system enables per-window command restrictions (important for plugin sandboxing)
- System webview means automatic OS-level security updates

**Negative**:
- WebKit (macOS) and WebView2 (Windows) have rendering differences — must test cross-platform
- Smaller ecosystem means fewer ready-made Tauri plugins
- Rust toolchain required for building (but not for business logic development)

**Note on "the shim"**: Tauri's standard usage pattern is a thin Rust backend with a web frontend. This is not a hack — it is the designed architecture. The Rust side handles system-level operations (database, filesystem); the web side handles UI.

<!-- TODO: Document cross-platform rendering differences to watch for -->
<!-- TODO: Document Tauri v2 capabilities configuration -->
