import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { useSettingsStore } from '../../../src/stores/settings-store.js';

describe('useSettingsStore', () => {
  beforeAll(() => {
    // jsdom does not implement window.matchMedia — stub it for the
    // setThemePreference('system') code path that calls it.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  beforeEach(() => {
    localStorage.clear();
    // Reset to known defaults before each test
    useSettingsStore.setState({
      themePreference: 'system',
      fontSize: 16,
      lineSpacing: 'comfortable',
      editorMaxWidth: 720,
      fontScale: 1.0,
      defaultBlockType: 'paragraph',
      markdownRendering: true,
      focusModeDefault: false,
      customBindings: {},
      reducedMotion: 'system',
      highContrast: 'system',
      animateFocusRings: true,
    });
  });

  // ============================================================================
  // Default values
  // ============================================================================

  describe('Default Values', () => {
    it('has correct default appearance values', () => {
      const store = useSettingsStore.getState();

      expect(store.themePreference).toBe('system');
      expect(store.fontSize).toBe(16);
      expect(store.lineSpacing).toBe('comfortable');
      expect(store.editorMaxWidth).toBe(720);
      expect(store.fontScale).toBe(1.0);
    });

    it('has correct default editor behavior values', () => {
      const store = useSettingsStore.getState();

      expect(store.defaultBlockType).toBe('paragraph');
      expect(store.markdownRendering).toBe(true);
      expect(store.focusModeDefault).toBe(false);
    });

    it('has correct default keyboard binding values', () => {
      const store = useSettingsStore.getState();

      expect(store.customBindings).toEqual({});
    });

    it('has correct default accessibility values', () => {
      const store = useSettingsStore.getState();

      expect(store.reducedMotion).toBe('system');
      expect(store.highContrast).toBe('system');
      expect(store.animateFocusRings).toBe(true);
    });
  });

  // ============================================================================
  // Theme
  // ============================================================================

  describe('setThemePreference', () => {
    it('updates themePreference to light', () => {
      useSettingsStore.getState().setThemePreference('light');
      expect(useSettingsStore.getState().themePreference).toBe('light');
    });

    it('updates themePreference to dark', () => {
      useSettingsStore.getState().setThemePreference('dark');
      expect(useSettingsStore.getState().themePreference).toBe('dark');
    });

    it('updates themePreference back to system', () => {
      useSettingsStore.getState().setThemePreference('dark');
      useSettingsStore.getState().setThemePreference('system');
      expect(useSettingsStore.getState().themePreference).toBe('system');
    });
  });

  // ============================================================================
  // resetToDefaults
  // ============================================================================

  describe('resetToDefaults', () => {
    it('resets all settings back to defaults', () => {
      const store = useSettingsStore.getState();

      // Mutate several settings
      store.setThemePreference('dark');
      store.setFontSize(20);
      store.setLineSpacing('relaxed');
      store.setEditorMaxWidth(1000);
      store.setFontScale(1.2);
      store.setDefaultBlockType('bullet');
      store.setMarkdownRendering(false);
      store.setFocusModeDefault(true);
      store.setCustomBinding('openSettings', 'Cmd+,');
      store.setReducedMotion('on');
      store.setHighContrast('off');
      store.setAnimateFocusRings(false);

      // Reset
      useSettingsStore.getState().resetToDefaults();

      const resetState = useSettingsStore.getState();
      expect(resetState.themePreference).toBe('system');
      expect(resetState.fontSize).toBe(16);
      expect(resetState.lineSpacing).toBe('comfortable');
      expect(resetState.editorMaxWidth).toBe(720);
      expect(resetState.fontScale).toBe(1.0);
      expect(resetState.defaultBlockType).toBe('paragraph');
      expect(resetState.markdownRendering).toBe(true);
      expect(resetState.focusModeDefault).toBe(false);
      expect(resetState.customBindings).toEqual({});
      expect(resetState.reducedMotion).toBe('system');
      expect(resetState.highContrast).toBe('system');
      expect(resetState.animateFocusRings).toBe(true);
    });

    it('resets customBindings to empty object', () => {
      const store = useSettingsStore.getState();
      store.setCustomBinding('openSettings', 'Cmd+,');
      store.setCustomBinding('toggleSidebar', 'Cmd+\\');
      expect(Object.keys(useSettingsStore.getState().customBindings).length).toBe(2);

      useSettingsStore.getState().resetToDefaults();
      expect(useSettingsStore.getState().customBindings).toEqual({});
    });
  });

  // ============================================================================
  // Custom bindings
  // ============================================================================

  describe('setCustomBinding / clearCustomBinding', () => {
    it('setCustomBinding stores a chord for an action', () => {
      useSettingsStore.getState().setCustomBinding('openSettings', 'Cmd+,');
      expect(useSettingsStore.getState().customBindings['openSettings']).toBe('Cmd+,');
    });

    it('setCustomBinding overwrites an existing binding', () => {
      useSettingsStore.getState().setCustomBinding('openSettings', 'Cmd+,');
      useSettingsStore.getState().setCustomBinding('openSettings', 'Ctrl+,');
      expect(useSettingsStore.getState().customBindings['openSettings']).toBe('Ctrl+,');
    });

    it('setCustomBinding with null clears the binding for an action', () => {
      useSettingsStore.getState().setCustomBinding('openSettings', 'Cmd+,');
      expect(useSettingsStore.getState().customBindings['openSettings']).toBe('Cmd+,');

      useSettingsStore.getState().setCustomBinding('openSettings', null);
      expect(useSettingsStore.getState().customBindings['openSettings']).toBeNull();
    });

    it('setCustomBinding preserves other bindings when updating one', () => {
      useSettingsStore.getState().setCustomBinding('openSettings', 'Cmd+,');
      useSettingsStore.getState().setCustomBinding('toggleSidebar', 'Cmd+\\');

      useSettingsStore.getState().setCustomBinding('openSettings', 'Ctrl+,');

      const { customBindings } = useSettingsStore.getState();
      expect(customBindings['openSettings']).toBe('Ctrl+,');
      expect(customBindings['toggleSidebar']).toBe('Cmd+\\');
    });

    it('setCustomBinding does not mutate previous state object', () => {
      useSettingsStore.getState().setCustomBinding('openSettings', 'Cmd+,');
      const firstBindings = useSettingsStore.getState().customBindings;

      useSettingsStore.getState().setCustomBinding('toggleSidebar', 'Cmd+\\');
      const secondBindings = useSettingsStore.getState().customBindings;

      expect(secondBindings).not.toBe(firstBindings);
      expect(Object.keys(firstBindings)).toHaveLength(1);
      expect(Object.keys(secondBindings)).toHaveLength(2);
    });
  });
});
