# Security

Security architecture for a local-first desktop application with an embedded database.

## Contents

| Document                                          | Description                                              |
| ------------------------------------------------- | -------------------------------------------------------- |
| [Threat Model](./threat-model.md)                 | Attack vectors and risk assessment for a local-first app |
| [Injection Prevention](./injection-prevention.md) | SQL injection analysis and prevention                    |
| [Content Rendering](./content-rendering.md)       | XSS prevention when rendering imported content           |
| [Plugin Sandboxing](./plugin-sandboxing.md)       | Future plugin security architecture                      |

## Security Principles

1. **Parameterized queries always.** User data never enters SQL strings directly.
2. **Read-only query path.** The `query` command runs SELECT statements only.
3. **Sanitize rendered content.** DOMPurify on all imported/user-generated HTML.
4. **Minimal Rust surface.** Less code = less attack surface.
