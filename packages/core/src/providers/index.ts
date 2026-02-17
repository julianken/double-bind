/**
 * Providers module - Platform-agnostic database provider abstractions
 *
 * This module exports interfaces for database lifecycle management.
 * Platform-specific implementations (Tauri, Capacitor, Node) implement
 * these interfaces to provide consistent database access across platforms.
 */

export type {
  DatabaseProvider,
  DatabaseProviderConfig,
  DatabaseProviderInitResult,
} from './database-provider.js';
