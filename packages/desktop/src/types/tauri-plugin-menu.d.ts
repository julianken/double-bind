/**
 * Type declarations for @tauri-apps/plugin-menu.
 *
 * This package is an optional Tauri runtime plugin — it is not installed as
 * an npm dependency and only available inside a Tauri context. The module
 * declaration here lets TypeScript accept the dynamic import in useContextMenu
 * without errors, while the runtime guard (try/catch) handles absence gracefully.
 */

declare module '@tauri-apps/plugin-menu' {
  interface MenuItemOptions {
    text: string;
    enabled?: boolean;
    action?: () => void;
  }

  interface PredefinedMenuItemOptions {
    item: 'Separator' | 'Copy' | 'Cut' | 'Paste' | 'SelectAll' | 'Undo' | 'Redo';
  }

  interface MenuOptions {
    items?: Array<MenuItem | PredefinedMenuItem>;
  }

  class MenuItem {
    static new(options: MenuItemOptions): Promise<MenuItem>;
  }

  class PredefinedMenuItem {
    static new(options: PredefinedMenuItemOptions): Promise<PredefinedMenuItem>;
  }

  class Menu {
    static new(options?: MenuOptions): Promise<Menu>;
    popup(): Promise<void>;
  }
}
