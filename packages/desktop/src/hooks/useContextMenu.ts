/**
 * useContextMenu - Generic context menu hook.
 *
 * Wraps @tauri-apps/plugin-menu with a graceful fallback for browser/test
 * environments where the plugin is unavailable.
 *
 * The Tauri plugin is loaded via dynamic import so this module remains
 * safe to import outside a Tauri context. Type declarations for the plugin
 * are provided in src/types/tauri-plugin-menu.d.ts.
 */

import { useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ContextMenuItem {
  /** Display label for the menu item */
  label: string;
  /** Action to execute when the item is clicked */
  action: () => void;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether to render a separator before this item */
  separator?: boolean;
}

export interface UseContextMenuResult {
  /** Show a native context menu at the event position */
  showContextMenu: (event: React.MouseEvent, items: ContextMenuItem[]) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useContextMenu provides a cross-environment context menu.
 *
 * In a Tauri window, it uses @tauri-apps/plugin-menu to render a native menu.
 * In browser/test environments, the dynamic import resolves to nothing and
 * the try/catch handles this gracefully.
 *
 * @example
 * ```ts
 * const { showContextMenu } = useContextMenu();
 *
 * function handleContextMenu(event: React.MouseEvent) {
 *   showContextMenu(event, [
 *     { label: 'Copy', action: () => copy() },
 *     { label: 'Delete', action: () => remove() },
 *   ]);
 * }
 * ```
 */
export function useContextMenu(): UseContextMenuResult {
  const showContextMenu = useCallback(
    async (event: React.MouseEvent, items: ContextMenuItem[]) => {
      event.preventDefault();

      try {
        // Dynamic import — type-declared in src/types/tauri-plugin-menu.d.ts
        // Falls back gracefully in browser/test environments where the Tauri
        // runtime is not present (import() will throw and be caught below).
        const { Menu, MenuItem, PredefinedMenuItem } = await import(
          '@tauri-apps/plugin-menu'
        );

        // Build native menu items
        const menuItems = await Promise.all(
          items.map(async (item: ContextMenuItem) => {
            if (item.separator) {
              return PredefinedMenuItem.new({ item: 'Separator' });
            }

            return MenuItem.new({
              text: item.label,
              enabled: !item.disabled,
              action: () => {
                if (!item.disabled) {
                  item.action();
                }
              },
            });
          })
        );

        const menu = await Menu.new({ items: menuItems });
        await menu.popup();
      } catch {
        // Silently handle — context menu is non-critical UI.
        // This catch fires in browser/test where the Tauri plugin is absent.
      }
    },
    []
  );

  return { showContextMenu };
}
