# Tauri Configuration

## Tauri v2

We target stable Tauri v2, which uses a capability-based security model for IPC access control.

### Why Tauri v2 (not v1)

- **Capability system**: Per-window IPC permissions (critical for future plugin sandboxing)
- **Multi-webview**: Support for split panes and plugin windows
- **Mobile support**: Future iOS/Android possibility (not in scope for v1)
- **Active development**: v1 is maintenance-only

## Project Structure

```
packages/desktop/src-tauri/
├── Cargo.toml
├── build.rs
├── tauri.conf.json
├── capabilities/
│   ├── main-window.json
│   └── plugin-window.json    (future)
├── icons/
│   ├── icon.icns             (macOS)
│   ├── icon.ico              (Windows)
│   └── icon.png              (Linux)
└── src/
    └── main.rs               (the Rust shim)
```

## tauri.conf.json

```json
{
  "$schema": "https://raw.githubusercontent.com/nicerdicer/tauri-v2-schemas/main/schema.json",
  "productName": "Double Bind",
  "version": "0.1.0",
  "identifier": "com.double-bind.app",
  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Double Bind",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/icon.icns",
      "icons/icon.ico",
      "icons/icon.png"
    ]
  }
}
```

## Capabilities

Tauri v2 capabilities restrict which IPC commands each window can call.

### Main Window Capability

```json
{
  "$schema": "https://raw.githubusercontent.com/nicerdicer/tauri-v2-schemas/main/capabilities-schema.json",
  "identifier": "main-window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "app:query",
    "app:mutate",
    "app:import_relations",
    "app:export_relations",
    "app:backup"
  ]
}
```

The main window has access to all 5 commands.

### Plugin Window Capability (Future)

```json
{
  "identifier": "plugin-window",
  "windows": ["plugin-*"],
  "permissions": [
    "core:default",
    "app:query"
  ]
}
```

Plugin windows can only call `query` (read-only). No mutation access.

### Preview Window Capability (Future)

```json
{
  "identifier": "preview-window",
  "windows": ["preview-*"],
  "permissions": [
    "core:default",
    "app:query"
  ]
}
```

## Content Security Policy

CSP is configured in `tauri.conf.json` and enforced by the webview:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
```

| Directive | Value | Effect |
|-----------|-------|--------|
| `default-src` | `'self'` | Block all external resources by default |
| `script-src` | `'self'` | No inline scripts, no external scripts |
| `style-src` | `'self' 'unsafe-inline'` | Allow inline styles (needed for ProseMirror) |
| `img-src` | `'self' data:` | Allow embedded images via data URIs |

`unsafe-inline` for styles is a pragmatic choice — ProseMirror and many CSS-in-JS solutions need it. `unsafe-inline` for scripts is NOT allowed.

## Platform Considerations

### macOS

- Webview: WebKit (WKWebView)
- App bundle: `.app` directory
- Data directory: `~/Library/Application Support/com.double-bind.app/`
- Code signing: Required for distribution (Apple Developer account)

### Linux

- Webview: WebKitGTK
- Package formats: `.deb`, `.AppImage`, `.rpm`
- Data directory: `~/.local/share/double-bind/`
- Dependencies: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`

### Windows

- Webview: WebView2 (Chromium-based, pre-installed on Windows 10/11)
- Package format: `.msi`, `.exe` (NSIS)
- Data directory: `%APPDATA%/double-bind/`
- No additional runtime dependencies

## Development vs Production

| Setting | Dev | Production |
|---------|-----|------------|
| Frontend URL | `http://localhost:5173` (Vite dev server) | Bundled static files |
| DevTools | Enabled | Disabled |
| CSP | Same | Same |
| Debug symbols | Yes | Stripped |
| Binary size | ~50MB | ~10MB |

## CVE Awareness

- **CVE-2024-35222** (Tauri v2 beta): Remote iframes could access IPC endpoints. Patched in v2.0.0-beta.20+. We target stable v2, which includes this fix.
- Keep Tauri updated — webview vulnerabilities in WebKit/WebView2 are patched via OS updates, but Tauri-specific IPC vulnerabilities require Tauri updates.

<!-- TODO: Define exact Tauri v2 version to target -->
<!-- TODO: Define code signing strategy for macOS/Windows -->
<!-- TODO: Define auto-update mechanism (Tauri's built-in updater) -->
<!-- TODO: Define DevTools access policy (hidden in production? keyboard shortcut?) -->
<!-- TODO: Define deep linking / URL protocol handler (double-bind://page/xxx) -->
