/**
 * Stub for @tauri-apps/plugin-menu in non-Tauri environments.
 *
 * The real plugin is only available inside a Tauri window at runtime.
 * This stub throws on construction so the dynamic import in useContextMenu
 * falls into its catch block gracefully.
 */

export const Menu = {
  new: async () => {
    throw new Error('Not in Tauri environment');
  },
};

export const MenuItem = {
  new: async () => {
    throw new Error('Not in Tauri environment');
  },
};

export const PredefinedMenuItem = {
  new: async () => {
    throw new Error('Not in Tauri environment');
  },
};
