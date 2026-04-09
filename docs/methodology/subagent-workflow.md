# Multi-Agent Development Pipeline

All non-trivial work in Double-Bind follows a three-role pipeline: implementer, spec reviewer, quality reviewer. This document summarizes the process. The full specification lives in [`.claude/skills/subagent-workflow/SKILL.md`](../../.claude/skills/subagent-workflow/SKILL.md).

## The Three Roles

**Implementer.** Receives a single Linear issue with acceptance criteria. Creates a git worktree, implements the feature or fix, writes tests, runs the full pre-PR gate (tests, lint, typecheck, E2E), and opens a draft pull request. The implementer self-reviews before submitting but does not have final authority.

**Spec Reviewer.** A separate agent instance that reads the Linear issue's acceptance criteria and the PR diff. It verifies each criterion is satisfied and that tests cover the specified behavior. It does not evaluate code quality -- only spec compliance. If gaps are found, the implementer fixes them in the same worktree and branch; no new PR is created.

**Quality Reviewer.** Another separate agent instance that evaluates the code for security vulnerabilities, error handling, performance, accessibility (WCAG 2.1 AA), test quality, and adherence to project conventions. It focuses on high-impact issues rather than style nitpicks. Again, any fixes happen in the same worktree.

Code merges only after both reviews pass.

## Why the Orchestrator Never Edits Code

The lead agent dispatches implementers and reviewers but never modifies files itself. This separation exists because an agent that both writes and reviews code has no independent check on its output. By restricting the orchestrator to dispatch and coordination, every line of code gets at least two independent agent perspectives before merge.

## Linear as Source of Truth

Each Linear issue maps to exactly one git worktree and one pull request. This constraint is enforced by convention and by the workflow specification:

- **One issue = one worktree = one PR.** Never split an issue across multiple PRs or combine multiple issues into one.
- **State transitions are tracked.** Issues move through Backlog, Todo, In Progress, In Review, and Done, with Linear comments at each transition providing an audit trail.
- **Blocked issues are explicit.** If work cannot proceed, the issue is marked Blocked with a `blockedBy` reference to the blocking issue.

## Pre-Commit Hooks as Quality Gates

Automated hooks run before every commit to catch problems that agents commonly introduce:

- **Debug artifact blocking.** Rejects commits containing `debug-*.spec.ts` or `*.bak` files.
- **Staged-diff-aware console.log detection.** Scans only the staged diff for `console.log` additions, avoiding false positives from existing code.
- **Incremental typecheck.** Runs TypeScript type checking on affected packages.

These hooks serve as a deterministic safety net. An agent may forget to clean up artifacts; the hook will not.

## Parallel Execution Model

Independent Linear issues are worked on in parallel -- each in its own worktree with its own implementer agent. Within a single issue, the pipeline is strictly sequential: implementation completes before spec review begins, and spec review passes before quality review starts. This gives parallelism across issues without sacrificing review integrity within any single change.
