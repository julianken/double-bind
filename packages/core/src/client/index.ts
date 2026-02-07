/**
 * Client module - GraphDB implementations for different environments
 */
export { tauriGraphDB } from './tauri-graph-db.js';
export { httpGraphDB, isInTauri } from './http-graph-db.js';
