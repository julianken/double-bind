/**
 * ConflictDetailView Component
 *
 * Displays side-by-side comparison of conflicting versions
 * with resolution actions. Follows iOS HIG guidelines.
 */

import * as React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { ConflictDetailViewProps } from './ConflictTypes';

const MIN_TOUCH_TARGET = 44;

/**
 * Renders a detailed view of a conflict with local vs remote comparison.
 */
export function ConflictDetailView({
  conflict,
  onKeepLocal,
  onKeepRemote,
  onMergeLater,
  onClose,
  testID = 'conflict-detail-view',
}: ConflictDetailViewProps): JSX.Element {
  // Extract content from snapshots
  const localContent = extractContent(conflict.localVersion.snapshot);
  const remoteContent = extractContent(conflict.remoteVersion.snapshot);

  // Format timestamps
  const localTime = formatTimestamp(conflict.localVersion.timestamp);
  const remoteTime = formatTimestamp(conflict.remoteVersion.timestamp);

  return (
    <View style={styles.container} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close conflict details"
          testID={`${testID}-close-button`}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resolve Conflict</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Conflict Info */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Conflict Type</Text>
        <Text style={styles.infoValue}>{formatConflictType(conflict.conflictType)}</Text>
        <Text style={styles.infoSubtitle}>
          {conflict.entityType === 'page' ? 'Page' : 'Block'} • Detected {formatRelativeTime(conflict.detectedAt)}
        </Text>
      </View>

      {/* Side-by-side comparison */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.comparisonContainer}>
          {/* Local Version */}
          <View style={styles.versionContainer}>
            <View style={styles.versionHeader}>
              <Text style={styles.versionLabel}>Local Version</Text>
              <Text style={styles.versionBadge}>Your Device</Text>
            </View>
            <View style={styles.versionContent}>
              <Text style={styles.versionTime}>{localTime}</Text>
              <Text style={styles.contentText}>{localContent}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Remote Version */}
          <View style={styles.versionContainer}>
            <View style={styles.versionHeader}>
              <Text style={styles.versionLabel}>Remote Version</Text>
              <Text style={[styles.versionBadge, styles.remoteBadge]}>Other Device</Text>
            </View>
            <View style={styles.versionContent}>
              <Text style={styles.versionTime}>{remoteTime}</Text>
              <Text style={styles.contentText}>{remoteContent}</Text>
            </View>
          </View>
        </View>

        {/* Resolution Info */}
        <View style={styles.resolutionInfo}>
          <Text style={styles.resolutionTitle}>Choose a resolution:</Text>
          <Text style={styles.resolutionSubtitle}>
            This will determine which version to keep. You cannot undo this action.
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => onKeepLocal(conflict.conflictId)}
          accessibilityRole="button"
          accessibilityLabel="Keep local version from your device"
          testID={`${testID}-keep-local`}
        >
          <Text style={styles.primaryButtonText}>Keep Local</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => onKeepRemote(conflict.conflictId)}
          accessibilityRole="button"
          accessibilityLabel="Keep remote version from other device"
          testID={`${testID}-keep-remote`}
        >
          <Text style={styles.primaryButtonText}>Keep Remote</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => onMergeLater(conflict.conflictId)}
          accessibilityRole="button"
          accessibilityLabel="Postpone conflict resolution to merge later"
          testID={`${testID}-merge-later`}
        >
          <Text style={styles.secondaryButtonText}>Merge Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Extract content from snapshot for display.
 */
function extractContent(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') {
    return 'No content available';
  }

  const obj = snapshot as Record<string, unknown>;

  if (typeof obj.content === 'string') {
    return obj.content || '(empty)';
  }

  if (typeof obj.title === 'string') {
    return obj.title || '(empty)';
  }

  return JSON.stringify(snapshot, null, 2);
}

/**
 * Format HLC timestamp for display.
 */
function formatTimestamp(hlcString: string): string {
  try {
    // HLC format: physical-logical-nodeId
    const parts = hlcString.split('-');
    const physical = parseInt(parts[0] || '0', 10);

    if (isNaN(physical)) {
      return 'Unknown time';
    }

    const date = new Date(physical);
    return date.toLocaleString();
  } catch {
    return 'Unknown time';
  }
}

/**
 * Format relative time (e.g., "2 hours ago").
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    minHeight: MIN_TOUCH_TARGET,
  },
  closeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  headerSpacer: {
    width: MIN_TOUCH_TARGET,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  comparisonContainer: {
    paddingHorizontal: 16,
  },
  versionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  versionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  versionBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  remoteBadge: {
    backgroundColor: '#34C759',
  },
  versionContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
  },
  versionTime: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  contentText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
    marginHorizontal: 16,
  },
  resolutionInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  resolutionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  resolutionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  actionContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#F2F2F7',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
});
