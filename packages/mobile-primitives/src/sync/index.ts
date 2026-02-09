/**
 * Sync and conflict resolution utilities.
 *
 * Provides infrastructure for detecting and resolving conflicts
 * during synchronization between multiple devices.
 */

// HLC utilities
export {
  initHLC,
  generateHLC,
  updateHLC,
  serializeHLC,
  deserializeHLC,
  compareHLC,
  compareHLCStrings,
  happenedBefore,
  maxHLC,
  createVersionVector,
  updateVersionVector,
  mergeVersionVectors,
  compareVersionVectors,
  vectorPrecedes,
  areConcurrent,
} from './hlc';

// Conflict detection hook
export {
  useConflictDetection,
  type UseConflictDetectionReturn,
  type DetectConflictParams,
} from './useConflictDetection';

// Conflict store implementations
export { InMemoryConflictStore } from './InMemoryConflictStore';

// Sync export service
export { SyncExportService, type SyncExportPackage, type ExportOptions } from './SyncExportService';

// Conflict UI components
export { ConflictListView } from './ConflictListView';
export { ConflictDetailView } from './ConflictDetailView';
export { ConflictResolutionModal } from './ConflictResolutionModal';

// Conflict UI types and utilities
export {
  formatConflictForList,
  type ConflictListItem,
  type ConflictListViewProps,
  type ConflictDetailViewProps,
  type ConflictResolutionModalProps,
} from './ConflictTypes';

// Conflict resolution hook
export { useConflictResolution, type UseConflictResolutionReturn } from './useConflictResolution';
