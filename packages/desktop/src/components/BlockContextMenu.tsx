/**
 * BlockContextMenu - Context menu overlay for block-level operations.
 *
 * Renders when the user right-clicks a BlockNode. Listens for the
 * `block-context-menu` CustomEvent via useBlockContextMenu and renders a
 * floating menu at the click coordinates.
 *
 * Actions exposed (per acceptance criteria):
 *   - Open in Right Panel
 *   - Copy Reference
 *   - Delete Block
 *   - (Plus existing: Copy, Cut, Duplicate from hook)
 *
 * Dismisses on:
 *   - Action selection
 *   - Backdrop click
 *   - Escape key
 *
 * Mount this once as a page-level singleton alongside HoverPreview.
 *
 * @see packages/desktop/src/hooks/useBlockContextMenu.ts
 */

import { memo, useEffect, useCallback } from 'react';
import type { BlockId } from '@double-bind/types';
import {
  useBlockContextMenu,
  type BlockContextMenuAction,
} from '../hooks/useBlockContextMenu.js';
import styles from './BlockContextMenu.module.css';

// ============================================================================
// Types
// ============================================================================

export interface BlockContextMenuProps {
  /**
   * Callback for "Open in Right Panel" — receives the blockId to open.
   * If not provided the action is omitted from the menu.
   */
  onOpenInRightPanel?: (blockId: BlockId) => void;
}

// ============================================================================
// BlockContextMenu Component
// ============================================================================

/**
 * BlockContextMenu is a page-level singleton that renders a floating context
 * menu when the user right-clicks a block. It manages its own visibility via
 * the useBlockContextMenu hook.
 */
export const BlockContextMenu = memo(function BlockContextMenu({
  onOpenInRightPanel,
}: BlockContextMenuProps) {
  const { isVisible, position, blockId, close, actions } = useBlockContextMenu();

  // Dismiss on Escape key
  useEffect(() => {
    if (!isVisible) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, close]);

  const handleBackdropClick = useCallback(() => {
    close();
  }, [close]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    // Prevent backdrop from also firing
    e.stopPropagation();
  }, []);

  if (!isVisible || !blockId) {
    return null;
  }

  // Build the full action list with the additional DBB-450 actions first
  const additionalActions: BlockContextMenuAction[] = [];

  additionalActions.push({
    label: 'Open in Right Panel',
    action: () => {
      if (onOpenInRightPanel) {
        onOpenInRightPanel(blockId);
      }
      close();
    },
  });

  additionalActions.push({
    label: 'Copy Reference',
    action: () => {
      // Format: ((blockId))
      const ref = `((${blockId}))`;
      void navigator.clipboard.writeText(ref).catch(() => {
        // Clipboard access denied — no-op
      });
      close();
    },
  });

  // Separator before existing hook actions (Copy, Cut, Duplicate, Delete)
  const allActions: BlockContextMenuAction[] = [
    ...additionalActions,
    ...actions.map((action, index) => ({
      ...action,
      // Add separator before the first hook action when we have additional actions
      separator: index === 0 && additionalActions.length > 0 ? true : action.separator,
    })),
  ];

  return (
    // Backdrop to capture outside clicks — no aria-hidden so the menu inside
    // remains accessible to screen readers and testing-library queries
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      data-testid="block-context-menu-backdrop"
    >
      <div
        className={styles.menu}
        role="menu"
        aria-label="Block actions"
        style={{ top: position.y, left: position.x }}
        onClick={handleMenuClick}
        data-testid="block-context-menu"
      >
        {allActions.map((action, index) => (
          <div key={`${action.label}-${index}`}>
            {action.separator && index > 0 && (
              <div className={styles.separator} role="separator" />
            )}
            <button
              type="button"
              role="menuitem"
              className={[
                styles.item,
                action.label === 'Delete' || action.label === 'Delete Block'
                  ? styles['item--danger']
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={action.action}
              disabled={action.disabled}
              data-testid={`block-context-menu-item-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {action.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

BlockContextMenu.displayName = 'BlockContextMenu';
