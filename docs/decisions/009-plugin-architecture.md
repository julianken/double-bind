# ADR-009: Plugin Architecture from Day 1

## Status
Accepted

## Context

The app should be extensible for community contributions and to keep the core small. The TUI client itself is effectively a plugin (a different frontend consuming the same core).

## Decision

Design plugin extension points from day 1. Ship core features as built-in plugins where possible.

## Extension Points

| Extension Point | What Plugins Can Do |
|----------------|-------------------|
| Commands | Add to command palette |
| Query Functions | Custom Datalog functions |
| Importers | Parse external formats (Roam JSON, OPML, etc.) |
| Exporters | Export to external formats (Markdown, HTML, etc.) |
| Graph Algorithms | Custom network analysis |

## Consequences

- Forces clean abstractions in core
- Core features (markdown import, PageRank) are plugins themselves, validating the API
- Plugin security is deferred — v1 plugins run with full trust
- Future: sandboxed iframes for untrusted plugins (see [Plugin Sandboxing](../security/plugin-sandboxing.md))

<!-- TODO: Define Plugin interface -->
<!-- TODO: Define PluginContext API -->
<!-- TODO: Document plugin lifecycle (load, unload, enable, disable) -->
<!-- TODO: Document how plugins interact with the command palette -->
