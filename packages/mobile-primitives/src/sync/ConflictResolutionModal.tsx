/**
 * ConflictResolutionModal Component
 *
 * Modal dialog for confirming conflict resolution actions.
 * Provides clear confirmation UI with iOS HIG styling.
 */

import * as React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { ConflictResolutionModalProps } from './ConflictTypes';

const MIN_TOUCH_TARGET = 44;

/**
 * Renders a modal for confirming conflict resolution.
 */
export function ConflictResolutionModal({
  visible,
  conflict,
  onResolve,
  onDismiss,
  testID = 'conflict-resolution-modal',
}: ConflictResolutionModalProps): JSX.Element {
  const [selectedMethod, setSelectedMethod] = React.useState<
    'local' | 'remote' | 'merge-later' | null
  >(null);

  // Reset selection when modal is opened
  React.useEffect(() => {
    if (visible) {
      setSelectedMethod(null);
    }
  }, [visible]);

  if (!conflict) {
    return <></>;
  }

  const handleConfirm = () => {
    if (selectedMethod) {
      onResolve(conflict.conflictId, selectedMethod);
      setSelectedMethod(null);
    }
  };

  const handleCancel = () => {
    setSelectedMethod(null);
    onDismiss();
  };

  const getMethodTitle = (method: 'local' | 'remote' | 'merge-later'): string => {
    switch (method) {
      case 'local':
        return 'Keep Local Version';
      case 'remote':
        return 'Keep Remote Version';
      case 'merge-later':
        return 'Merge Later';
    }
  };

  const getMethodDescription = (method: 'local' | 'remote' | 'merge-later'): string => {
    switch (method) {
      case 'local':
        return 'Use the version from your device and discard the remote changes.';
      case 'remote':
        return 'Use the version from the other device and discard your local changes.';
      case 'merge-later':
        return 'Postpone this decision. The conflict will remain unresolved.';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      testID={testID}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choose Resolution Method</Text>
            <Text style={styles.headerSubtitle}>
              Select how you want to resolve this conflict
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                selectedMethod === 'local' && styles.optionButtonSelected,
              ]}
              onPress={() => setSelectedMethod('local')}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedMethod === 'local' }}
              accessibilityLabel="Keep local version"
              testID={`${testID}-option-local`}
            >
              <View style={styles.optionRadio}>
                {selectedMethod === 'local' && <View style={styles.optionRadioSelected} />}
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{getMethodTitle('local')}</Text>
                <Text style={styles.optionDescription}>{getMethodDescription('local')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                selectedMethod === 'remote' && styles.optionButtonSelected,
              ]}
              onPress={() => setSelectedMethod('remote')}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedMethod === 'remote' }}
              accessibilityLabel="Keep remote version"
              testID={`${testID}-option-remote`}
            >
              <View style={styles.optionRadio}>
                {selectedMethod === 'remote' && <View style={styles.optionRadioSelected} />}
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{getMethodTitle('remote')}</Text>
                <Text style={styles.optionDescription}>{getMethodDescription('remote')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                selectedMethod === 'merge-later' && styles.optionButtonSelected,
              ]}
              onPress={() => setSelectedMethod('merge-later')}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedMethod === 'merge-later' }}
              accessibilityLabel="Merge later"
              testID={`${testID}-option-merge-later`}
            >
              <View style={styles.optionRadio}>
                {selectedMethod === 'merge-later' && <View style={styles.optionRadioSelected} />}
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{getMethodTitle('merge-later')}</Text>
                <Text style={styles.optionDescription}>{getMethodDescription('merge-later')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel and close modal"
              testID={`${testID}-cancel`}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.confirmButton,
                !selectedMethod && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedMethod}
              accessibilityRole="button"
              accessibilityLabel="Confirm resolution"
              accessibilityState={{ disabled: !selectedMethod }}
              testID={`${testID}-confirm`}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  !selectedMethod && styles.confirmButtonTextDisabled,
                ]}
              >
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  optionsContainer: {
    paddingVertical: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: '#FFFFFF',
  },
  optionButtonSelected: {
    backgroundColor: '#F2F2F7',
  },
  optionRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E5EA',
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#007AFF',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonDisabled: {
    backgroundColor: '#F2F2F7',
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmButtonTextDisabled: {
    color: '#C7C7CC',
  },
});
