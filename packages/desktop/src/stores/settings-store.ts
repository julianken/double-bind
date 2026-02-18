/**
 * Settings Store - User preferences and application settings
 *
 * Manages:
 * - Appearance (theme, font size, line spacing, editor max width, font scale)
 * - Editor behavior (default block type, markdown rendering, focus mode default)
 * - Keyboard bindings
 * - Accessibility overrides (reduced motion, high contrast, focus rings)
 *
 * This is the SOURCE OF TRUTH for themePreference. The AppStore.themePreference
 * is a deprecated shim that will be removed after Phase 6 migration.
 *
 * Persistence key: `double-bind-settings`
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ThemePreference } from './ui-store.js';

// ============================================================================
// Types
// ============================================================================

export type LineSpacing = 'compact' | 'comfortable' | 'relaxed';
export type AccessibilityOverride = 'system' | 'on' | 'off';
export type FontScale = 0.8 | 0.9 | 1.0 | 1.1 | 1.2;
export type DefaultBlockType = 'paragraph' | 'bullet' | 'heading';

export interface SettingsStore {
  // === Appearance ===
  /** SOURCE OF TRUTH for theme preference */
  themePreference: ThemePreference;
  /** default: 16 */
  fontSize: number;
  /** default: 'comfortable' */
  lineSpacing: LineSpacing;
  /** default: 720 */
  editorMaxWidth: number;
  /** default: 1.0 */
  fontScale: FontScale;

  // === Editor Behavior ===
  /** default: 'paragraph' */
  defaultBlockType: DefaultBlockType;
  /** default: true */
  markdownRendering: boolean;
  /** default: false */
  focusModeDefault: boolean;

  // === Keyboard ===
  customBindings: Record<string, string | null>;

  // === Accessibility ===
  /** default: 'system' */
  reducedMotion: AccessibilityOverride;
  /** default: 'system' */
  highContrast: AccessibilityOverride;
  /** default: true */
  animateFocusRings: boolean;

  // === Actions ===
  setThemePreference: (preference: ThemePreference) => void;
  setFontSize: (size: number) => void;
  setLineSpacing: (spacing: LineSpacing) => void;
  setEditorMaxWidth: (width: number) => void;
  setFontScale: (scale: FontScale) => void;
  setDefaultBlockType: (type: DefaultBlockType) => void;
  setMarkdownRendering: (enabled: boolean) => void;
  setFocusModeDefault: (enabled: boolean) => void;
  setCustomBinding: (action: string, chord: string | null) => void;
  setReducedMotion: (value: AccessibilityOverride) => void;
  setHighContrast: (value: AccessibilityOverride) => void;
  setAnimateFocusRings: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

// ============================================================================
// Defaults
// ============================================================================

const SETTINGS_DEFAULTS = {
  themePreference: 'system' as ThemePreference,
  fontSize: 16,
  lineSpacing: 'comfortable' as LineSpacing,
  editorMaxWidth: 720,
  fontScale: 1.0 as FontScale,
  defaultBlockType: 'paragraph' as DefaultBlockType,
  markdownRendering: true,
  focusModeDefault: false,
  customBindings: {} as Record<string, string | null>,
  reducedMotion: 'system' as AccessibilityOverride,
  highContrast: 'system' as AccessibilityOverride,
  animateFocusRings: true,
};

// ============================================================================
// Store
// ============================================================================

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...SETTINGS_DEFAULTS,

      setThemePreference: (preference) => {
        set({ themePreference: preference });
        // Side effect: apply to DOM immediately
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute(
            'data-theme',
            preference === 'system'
              ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : preference
          );
        }
      },

      setFontSize: (size) => set({ fontSize: size }),

      setLineSpacing: (spacing) => set({ lineSpacing: spacing }),

      setEditorMaxWidth: (width) => set({ editorMaxWidth: width }),

      setFontScale: (scale) => {
        set({ fontScale: scale });
        if (typeof document !== 'undefined') {
          document.documentElement.style.setProperty('--font-scale', String(scale));
        }
      },

      setDefaultBlockType: (type) => set({ defaultBlockType: type }),

      setMarkdownRendering: (enabled) => set({ markdownRendering: enabled }),

      setFocusModeDefault: (enabled) => set({ focusModeDefault: enabled }),

      setCustomBinding: (action, chord) =>
        set((state) => ({
          customBindings: { ...state.customBindings, [action]: chord },
        })),

      setReducedMotion: (value) => {
        set({ reducedMotion: value });
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.reducedMotion = value;
        }
      },

      setHighContrast: (value) => set({ highContrast: value }),

      setAnimateFocusRings: (enabled) => set({ animateFocusRings: enabled }),

      resetToDefaults: () => set(SETTINGS_DEFAULTS),
    }),
    {
      name: 'double-bind-settings',
      storage: createJSONStorage(() => localStorage),
      // No partialize — entire store is preference data, all fields persisted
    }
  )
);
