# Plugin Sandboxing (Future)

## Current State

V1 plugins run with full trust in the same webview context. This is acceptable for built-in plugins only.

## Future Architecture

When third-party plugins are supported, they must be sandboxed:

### Approach: Sandboxed Iframes

1. Each plugin runs in a sandboxed `<iframe>` without `allow-same-origin`
2. Plugin cannot access parent window's `invoke()` directly
3. Communication happens via `postMessage` with the host app as gatekeeper
4. Host validates every message and decides which CozoDB operations to perform

### Plugin Capabilities

| Capability | Default | Requires Approval |
|-----------|:---:|:---:|
| Read pages/blocks | Yes | No |
| Write pages/blocks | No | Yes |
| Run graph algorithms | Yes | No |
| Import data | No | Yes |
| Export data | No | Yes |
| System operations | No | Never |

### Tauri v2 Capabilities

Tauri v2's capability system can restrict per-window IPC access:
- Main window: access to `query` + `mutate`
- Plugin windows: access to `query` only (read-only by default)
- Preview windows: access to `query` only

### Open Questions

<!-- TODO: Define plugin API surface -->
<!-- TODO: Define plugin manifest format -->
<!-- TODO: Define plugin installation and update mechanism -->
<!-- TODO: Define plugin permission UI (approval dialogs) -->
<!-- TODO: Research Tauri's webview isolation options for plugin sandboxing -->
<!-- TODO: Evaluate Web Workers as alternative to iframes -->
