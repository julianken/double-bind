# Security

Security architecture for a local-first desktop application with an embedded database.

## Contents

| Document | Description |
|----------|-------------|
| [Threat Model](./threat-model.md) | Attack vectors and risk assessment for a local-first app |
| [Script Mutability](./script-mutability.md) | CozoDB's engine-enforced read/write separation |
| [Injection Prevention](./injection-prevention.md) | Datalog injection analysis and prevention |
| [Content Rendering](./content-rendering.md) | XSS prevention when rendering imported content |
| [Plugin Sandboxing](./plugin-sandboxing.md) | Future plugin security architecture |

## Security Principles

1. **Parameterized queries always.** User data never enters CozoScript strings.
2. **Engine-enforced read-only.** The `query` command uses `ScriptMutability::Immutable`.
3. **Blocklist on writes.** The `mutate` command rejects dangerous system operations.
4. **Sanitize rendered content.** DOMPurify on all imported/user-generated HTML.
5. **Minimal Rust surface.** Less code = less attack surface.
