# Threat Model

## Scope

Single-user, local-only desktop application. No server, no authentication, no remote API.

## What Is NOT in Scope

- **Local malware**: If malware runs as the user, it can read the RocksDB files directly. The application cannot prevent this.
- **Physical access**: If someone has the user's machine, they have the data.
- **The user as adversary**: The user owns all data and can do whatever they want.

## Attack Vectors

| Vector | Likelihood | Impact | Mitigation |
|--------|:---:|:---:|------------|
| Imported markdown with embedded XSS | **High** | **High** | DOMPurify, CSP, `ScriptMutability::Immutable` on read path |
| Malicious plugins (future) | **Medium** | **High** | Sandboxed iframes, structured API, read-only by default |
| Supply chain attack on npm deps | **Low-Medium** | **High** | Dependency audit, lockfile pinning, minimal deps |
| `import_relations` side channel | **Low** | **High** | TypeScript-level validation in ImportExportService; no `-` prefix names allowed |
| Clipboard paste with malicious content | **Low** | **Medium** | Sanitize pasted HTML before rendering |
| Malicious OPML/JSON import | **Low** | **Medium** | Validate import format, sanitize content |
| Future sharing/collaboration | **Medium** | **High** | Shared notes could contain XSS payloads |

## The Primary Threat: XSS via Imported Content

Users will import notes from other apps. Markdown renderers are historically vulnerable to XSS. If XSS succeeds in the Tauri webview:

1. Attacker gains JavaScript execution in the webview
2. Attacker can call `window.__TAURI_INTERNALS__.invoke(...)` for any permitted command
3. Without mitigation: attacker can execute `::remove pages` and destroy all data

**Defense layers:**
1. **DOMPurify** sanitizes all rendered HTML (prevent XSS from executing)
2. **CSP** blocks inline scripts (backup if sanitizer misses something)
3. **`ScriptMutability::Immutable`** on `query` command (even if XSS calls invoke, reads can't destroy data)
4. **Blocklist** on `mutate` command (even if XSS calls mutate, can't drop relations or install triggers)
5. **Tauri capabilities** restrict which commands each window can call

## CVE Reference

- **CVE-2024-35222**: Tauri v2 beta — remote iframes could access IPC endpoints. Patched in 2.0.0-beta.20+. We target stable Tauri v2.
- **Notable (Electron markdown app)**: Crafted markdown achieved XSS → RCE via Electron's node integration. Tauri's architecture makes this harder (no node integration in webview).

## Tauri Capability Configuration

Tauri v2's capability system has an important default: **app-defined commands are allowed for all windows and webviews by default**. Plugin commands follow deny-by-default.

This means our 5 Rust shim commands (`query`, `mutate`, `import_relations`, `export_relations`, `backup`) are callable from any webview without explicit configuration — including from injected scripts if XSS succeeds.

**Mitigation**: Define explicit capability files in `src-tauri/capabilities/`:

```json
{
  "identifier": "main-window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    { "identifier": "app:query" },
    { "identifier": "app:mutate" },
    { "identifier": "app:export_relations" },
    { "identifier": "app:backup" }
  ]
}
```

Note: `import_relations` is intentionally excluded from the main window capability. It should only be callable from a dedicated import dialog window with restricted permissions.

## Supply Chain Risk (Tauri-Specific)

Tauri desktop apps have **higher supply chain risk** than typical web apps. A compromised npm dependency in the webview can:
- Invoke Tauri IPC commands (filesystem, DB access, shell commands)
- Bypass browser sandboxing via the IPC bridge to native Rust code

**Mitigations**:
1. **Tauri Isolation Pattern**: Adds a cryptographic layer between frontend and IPC bridge
2. **Capability restrictions**: Limit which commands each window can invoke
3. **CSP**: Lock down what the webview can load and communicate with
4. **Lockfile discipline**: Commit lockfiles, use `--frozen-lockfile` in CI
5. **Audit tooling**: `pnpm audit`, Socket.dev for malicious package detection
