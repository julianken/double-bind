/**
 * ContextMenu — Right-click context menu for graph nodes.
 *
 * Options:
 * - Open page
 * - Open in sidebar
 * - Pin to graph
 * - Remove from view
 *
 * Implemented as a custom DOM-positioned menu (not native Tauri menu) so it
 * can appear at precise canvas coordinates. Closes on outside click or Escape.
 */

import { useCallback, useEffect, useRef } from 'react';
import styles from './ContextMenu.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextMenuAction {
  label: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

export interface ContextMenuProps {
  /** Whether the menu is visible */
  visible: boolean;
  /** Screen x position */
  x: number;
  /** Screen y position */
  y: number;
  /** The node ID this menu is for */
  nodeId: string | null;
  /** Menu items to render */
  items: ContextMenuAction[];
  /** Called when the menu should close */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Right-click context menu for graph nodes.
 *
 * @example
 * ```tsx
 * <ContextMenu
 *   visible={menuVisible}
 *   x={menuX}
 *   y={menuY}
 *   nodeId={menuNodeId}
 *   items={[
 *     { label: 'Open page', action: () => navigateToPage(menuNodeId) },
 *     { label: 'Open in sidebar', action: () => openInSidebar(menuNodeId) },
 *   ]}
 *   onClose={() => setMenuVisible(false)}
 * />
 * ```
 */
export function ContextMenu({ visible, x, y, nodeId, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
  }, [visible, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!visible) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [visible, onClose]);

  const handleItemClick = useCallback(
    (item: ContextMenuAction) => {
      if (item.disabled) return;
      item.action();
      onClose();
    },
    [onClose]
  );

  if (!visible || nodeId === null) return null;

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: x, top: y }}
      data-testid="graph-context-menu"
      role="menu"
      aria-label="Node options"
    >
      {items.map((item, idx) => (
        <div key={idx}>
          {item.separator && idx > 0 && <div className={styles.separator} role="separator" />}
          <button
            type="button"
            className={`${styles.item} ${item.disabled ? styles.itemDisabled : ''}`}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            role="menuitem"
            data-testid={`context-menu-item-${idx}`}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
