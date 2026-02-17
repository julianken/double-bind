# Documentation Templates

Templates for maintaining consistent documentation across the double-bind monorepo.

## Document Types

Every doc file falls into one of four categories:

| Type          | Purpose                                   | Maintenance                       | Examples                         |
| ------------- | ----------------------------------------- | --------------------------------- | -------------------------------- |
| **Decision**  | Records a past architectural choice       | Immutable after acceptance        | ADRs in `docs/decisions/`        |
| **Reference** | Describes current state of a system       | Active — update when code changes | Package specs, architecture docs |
| **Guide**     | Explains how to do a task                 | Moderate — degrades gracefully    | Testing guides, dev environment  |
| **Concept**   | Explains a CS concept or design principle | Low — rarely changes              | Research docs, design principles |

## Staleness Convention

All **Reference** and **Guide** docs should include a verification marker:

```markdown
<!-- last-verified: YYYY-MM-DD -->
```

This signals when the content was last checked against the codebase. Agents and humans can calibrate trust accordingly — a doc verified last week is more trustworthy than one from six months ago.

**Decision** and **Concept** docs do not need this marker (they describe stable truths).

## Anti-Patterns to Avoid

1. **Never embed code blocks >10 lines.** Reference the source file instead: "See `packages/core/src/services/block-service.ts`." Embedded code drifts silently.
2. **Never hard-code counts** ("10-package monorepo", "91 files changed"). Use qualitative descriptions or reference a source of truth.
3. **Never duplicate interface signatures.** The TypeScript source is the canonical reference. Describe the interface's purpose and point to the file.
4. **Never pin exact versions** in prose ("React 19.0.1"). Use major versions ("React 19") or omit.
5. **Avoid implementation details that change with refactors.** Describe behavior and contracts, not internal function call chains.

---

## Template 1: Package README

Lives at `packages/*/README.md`. Short, current, maintained by whoever changes the package.

````markdown
# @double-bind/[name]

<!-- last-verified: YYYY-MM-DD -->

**Layer:** [0-4] | **Category:** [Foundation | Infrastructure | Business Logic | UI | Application]

One-sentence description of what this package does.

## Exports

- `InterfaceName` — what it represents
- `functionName()` — what it does
- `ClassName` — what it provides

## Dependencies

**Internal:** `@double-bind/types`, `@double-bind/core`
**Key external:** `better-sqlite3`, `react`

## Testing

```bash
pnpm --filter @double-bind/[name] test
```
````

See `test/` directory for unit and integration tests.

````

**Rules:**
- No implementation details — this is a signpost, not a spec
- List exports by name only — see source for signatures
- Update when the export surface changes

---

## Template 2: ADR (Architecture Decision Record)

Lives at `docs/decisions/NNN-title.md`. Immutable after acceptance.

```markdown
# ADR-NNN: Title in Imperative Form

## Status

Accepted | Superseded by [ADR-NNN](./NNN-title.md) | Deprecated

## Context

What problem exists? What constraints are non-negotiable? (2-5 sentences, no code.)

## Options Considered

### Option A: Name

Brief description. **Pros:** ... **Cons:** ...

### Option B: Name

Brief description. **Pros:** ... **Cons:** ...

## Decision

Use [chosen option]. One sentence, optionally with a "because" clause.

## Consequences

**Positive:**
- What becomes easier

**Negative:**
- What becomes harder or what we lose

## References

- [ADR-NNN](./NNN-related.md) — related decision
- `packages/path/to/implementation` — where this is implemented
````

**Rules:**

- Never edit Context, Options, or Decision sections after acceptance
- To add retrospective notes, add a dated `## Revalidation (Month Year)` section at the bottom
- To supersede, change Status and create a new ADR that references this one

---

## Template 3: System Reference

Lives at `docs/[section]/[topic].md`. Describes a current system — requires active maintenance.

```markdown
# Topic Name

<!-- last-verified: YYYY-MM-DD -->

One paragraph: what is this system and what role does it play?

## Architecture

[ASCII diagram or Mermaid showing components and relationships]

## Design Principles

1. **Principle name** — one-sentence explanation
2. **Principle name** — one-sentence explanation

## Components

### Component Name

What it does, what it owns, what it depends on. (One paragraph per component.)

See `packages/path/to/file.ts` for implementation.

## Integration Points

What other systems does this touch? Where are the boundaries?

## Non-Obvious Decisions

Things that look strange but are intentional. Reference the relevant ADR.
```

**Rules:**

- Architecture diagrams show components, not class names
- Reference source files, never embed implementation code
- Design principles should be stable truths that survive refactors

---

## Template 4: Testing Guide

Lives at `docs/testing/[layer].md`. Explains how to use a testing layer.

````markdown
# [Layer Name] Tests

<!-- last-verified: YYYY-MM-DD -->

One sentence: what does this layer verify?

## Architecture

[ASCII diagram showing test runtime — what is real vs mocked]

## What This Layer Covers

- Behavior area 1
- Behavior area 2

## What This Layer Does NOT Cover

- Gap 1 — covered by [other layer]
- Gap 2 — not yet implemented

## Running Tests

```bash
pnpm [command]
```
````

## Interpreting Results

How to verify tests passed. Any non-obvious failure modes.

```

**Rules:**
- The "does NOT cover" section is the most valuable — prevents false confidence
- Never embed test infrastructure code — reference the setup files
- Keep examples at the behavior level, not the assertion level
```
