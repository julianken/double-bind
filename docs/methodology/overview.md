# Agentic Engineering Methodology

Double-Bind is developed using multi-agent AI orchestration. A human developer designs the architecture, makes technical decisions, and reviews all output. AI agents implement code, investigate problems, and produce drafts. This document describes how the process works; the companion documents cover the [multi-agent pipeline](subagent-workflow.md) and [testing philosophy](testing-philosophy.md) in detail.

## Roles

The human developer is responsible for system architecture, dependency ordering, acceptance criteria, and final approval of all merged code. AI agents never make architectural decisions autonomously. They receive scoped instructions tied to a single Linear issue and produce code within that scope.

Agents operate in three roles: implementer, spec reviewer, and quality reviewer. These roles are filled by separate agent instances with no shared state, which prevents an agent from reviewing its own work. The orchestrating agent dispatches work but never edits code directly.

## Quality Model

Quality is enforced through structure, not trust. Every code change passes through:

- **Automated pre-commit hooks** that block debug artifacts, detect stray `console.log` statements via staged-diff analysis, and run incremental type checking
- **Spec review** verifying that acceptance criteria from the Linear issue are met
- **Quality review** checking for security vulnerabilities, error handling, accessibility, and adherence to project conventions
- **Local test suite** covering four layers from unit tests through full-stack E2E

No code merges without passing all four gates. The system assumes that any individual agent output may contain errors and compensates through redundant, independent verification.

## Why This Approach

The methodology produces a complete audit trail: every change maps to a Linear issue, every issue maps to a single PR, and every PR passes through triple-agent review before merge. The constraints that make this work for AI agents -- deterministic tests, no manual verification steps, explicit acceptance criteria -- also make the codebase easier to maintain by any future contributor.

For the full agent pipeline specification, see [Multi-Agent Development Pipeline](subagent-workflow.md). For the testing constraints that underpin the process, see [Testing as Architectural Constraint](testing-philosophy.md).
