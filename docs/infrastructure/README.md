# Infrastructure

## Overview

Build tooling, development environment, and deployment configuration for the double-bind monorepo.

## Sections

| Document                               | Contents                                                 |
| -------------------------------------- | -------------------------------------------------------- |
| [Tauri Configuration](tauri-config.md) | Tauri v2 setup, capabilities, window config              |
| [Monorepo](monorepo.md)                | pnpm workspace, package structure, dependency rules      |
| [Build Tooling](build-tooling.md)      | TypeScript, Vite, ESLint, Prettier configuration         |
| [Dev Environment](dev-environment.md)  | Local development setup, required tools, troubleshooting |

## Key Principle

Almost all code is TypeScript. Rust exists only as a thin IPC shim between Tauri and rusqlite (SQLite). The infrastructure should make TypeScript development fast and Rust maintenance minimal.
