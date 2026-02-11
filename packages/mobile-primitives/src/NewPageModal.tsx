/**
 * NewPageModal - Modal for creating a new page with title input.
 *
 * A modal dialog that prompts the user to enter a title for a new page.
 * Features keyboard handling with KeyboardAvoidingView for iOS.
 *
 * @example
 * ```tsx
 * const [visible, setVisible] = useState(false);
 *
 * <NewPageModal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   onSubmit={(title) => {
 *     createPage(title);
 *     setVisible(false);
 *   }}
 * />
 * ```
 */

import React, { useState, type ReactElement } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ModalOverlay } from './ModalOverlay';

/**
 * Props for NewPageModal component.
 */
export interface NewPageModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal is closed (cancel or backdrop press) */
  onClose: () => void;
  /** Called when user submits with a title */
  onSubmit: (title: string) => void;
  /** Initial title value (defaults to empty string) */
  initialTitle?: string;
  /** Placeholder text for input (defaults to "Page title") */
  placeholder?: string;
  /** Whether submission is in progress */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
}

/**
 * Modal component for creating a new page.
 *
 * Features:
 * - Title input with auto-focus
 * - Keyboard handling (KeyboardAvoidingView)
 * - Cancel/Create buttons (44pt touch targets)
 * - Loading state support
 * - Empty title handling
 */
export function NewPageModal({
  visible,
  onClose,
  onSubmit,
  initialTitle = '',
  placeholder = 'Page title',
  isLoading = false,
  error = null,
}: NewPageModalProps): ReactElement {
  const [title, setTitle] = useState(initialTitle);

  const handleSubmit = () => {
    // Allow empty title - defaults to "Untitled" in the service
    onSubmit(title.trim() || 'Untitled');
    setTitle(''); // Reset for next time
  };

  const handleCancel = () => {
    setTitle(''); // Reset on cancel
    onClose();
  };

  return (
    <ModalOverlay visible={visible} onClose={handleCancel}>
      <View style={styles.modal}>
        <Text style={styles.title}>New Page</Text>

        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={placeholder}
          placeholderTextColor="#999999"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          editable={!isLoading}
          testID="new-page-input"
        />

        {error && (
          <Text style={styles.errorText} testID="error-message">
            {error}
          </Text>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="cancel-button"
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.createButton, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Create page"
            testID="create-button"
          >
            <Text style={[styles.buttonText, styles.createButtonText]}>
              {isLoading ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ModalOverlay>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: 320,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    marginBottom: 20,
    minHeight: 44, // iOS HIG minimum touch target
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    minHeight: 44, // iOS HIG minimum touch target
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#000000',
  },
  createButtonText: {
    color: '#FFFFFF',
  },
});
