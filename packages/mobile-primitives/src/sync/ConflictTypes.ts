/**
 * Conflict UI Types
 *
 * Additional types specific to the conflict resolution UI components.
 */

import type { ConflictMetadata } from '@double-bind/types';

/**
 * Props for ConflictListView component.
 */
export interface ConflictListViewProps {
  /** List of conflicts to display */
  conflicts: ConflictMetadata[];

  /** Callback when a conflict item is pressed */
  onConflictPress: (conflict: ConflictMetadata) => void;

  /** Callback to refresh the conflict list */
  onRefresh?: () => void;

  /** Whether the list is currently refreshing */
  refreshing?: boolean;

  /** Test ID for testing */
  testID?: string;
}

/**
 * Props for ConflictDetailView component.
 */
export interface ConflictDetailViewProps {
  /** The conflict to display */
  conflict: ConflictMetadata;

  /** Callback when "Keep Local" is pressed */
  onKeepLocal: (conflictId: string) => void;

  /** Callback when "Keep Remote" is pressed */
  onKeepRemote: (conflictId: string) => void;

  /** Callback when "Merge Later" is pressed */
  onMergeLater: (conflictId: string) => void;

  /** Callback when back/close is pressed */
  onClose: () => void;

  /** Test ID for testing */
  testID?: string;
}

/**
 * Props for ConflictResolutionModal component.
 */
export interface ConflictResolutionModalProps {
  /** Whether the modal is visible */
  visible: boolean;

  /** The conflict to resolve */
  conflict: ConflictMetadata | null;

  /** Callback when resolution is confirmed */
  onResolve: (conflictId: string, method: 'local' | 'remote' | 'merge-later') => void;

  /** Callback when modal is dismissed */
  onDismiss: () => void;

  /** Test ID for testing */
  testID?: string;
}

/**
 * Conflict item for list display.
 */
export interface ConflictListItem {
  /** Conflict metadata */
  conflict: ConflictMetadata;

  /** Human-readable title */
  title: string;

  /** Human-readable subtitle */
  subtitle: string;

  /** Icon name for the conflict type */
  icon: string;
}

/**
 * Format conflict metadata for list display.
 */
export function formatConflictForList(conflict: ConflictMetadata): ConflictListItem {
  // Get entity content preview
  const localContent = getContentPreview(conflict.localVersion.snapshot);

  // Format title based on entity type
  const title = conflict.entityType === 'page'
    ? `Page: ${localContent}`
    : `Block: ${localContent}`;

  // Format subtitle with conflict type
  const subtitle = `${formatConflictType(conflict.conflictType)} • ${formatTimestamp(conflict.detectedAt)}`;

  // Select icon based on conflict type
  const icon = getConflictIcon(conflict.conflictType);

  return {
    conflict,
    title,
    subtitle,
    icon,
  };
}

/**
 * Get a preview of content from a snapshot.
 */
function getContentPreview(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') {
    return 'Unknown';
  }

  const obj = snapshot as Record<string, unknown>;

  // Try to extract content
  if (typeof obj.content === 'string') {
    return obj.content.substring(0, 50) + (obj.content.length > 50 ? '...' : '');
  }

  if (typeof obj.title === 'string') {
    return obj.title;
  }

  return 'Unknown';
}

/**
 * Format conflict type for display.
 */
function formatConflictType(type: string): string {
  const labels: Record<string, string> = {
    content: 'Content Change',
    move: 'Block Moved',
    delete: 'Deletion Conflict',
    parent: 'Parent Changed',
    order: 'Order Changed',
    structural: 'Structure Changed',
  };

  return labels[type] || 'Conflict';
}

/**
 * Format timestamp for display.
 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

/**
 * Get icon name for conflict type.
 */
function getConflictIcon(type: string): string {
  const icons: Record<string, string> = {
    content: 'edit',
    move: 'move',
    delete: 'trash',
    parent: 'folder',
    order: 'reorder',
    structural: 'warning',
  };

  return icons[type] || 'alert-circle';
}
