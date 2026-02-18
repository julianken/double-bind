/**
 * Stub for @tauri-apps/plugin-menu used in unit tests.
 *
 * The real plugin requires a Tauri runtime. This stub provides the same
 * surface so that dynamic imports in hooks like useContextMenu resolve
 * without error in jsdom environments.
 *
 * useContextMenu already wraps the import in try/catch for graceful
 * degradation; this stub simply prevents Vite's import-analysis from
 * failing at transform time.
 */

export class MenuItem {
  static new(_opts: { text: string; enabled?: boolean; action?: () => void }): Promise<MenuItem> {
    return Promise.resolve(new MenuItem());
  }
}

export class PredefinedMenuItem {
  static new(_opts: { item: string }): Promise<PredefinedMenuItem> {
    return Promise.resolve(new PredefinedMenuItem());
  }
}

export class Menu {
  static new(_opts: { items: unknown[] }): Promise<Menu> {
    return Promise.resolve(new Menu());
  }

  popup(): Promise<void> {
    return Promise.resolve();
  }
}
