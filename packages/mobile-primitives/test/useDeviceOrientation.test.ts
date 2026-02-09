/**
 * Tests for useDeviceOrientation hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dimensions } from 'react-native';
import {
  useDeviceOrientation,
  useIsLandscape,
  useIsTablet,
  useIsSplitScreen,
} from '../src/layout/useDeviceOrientation';
import { getResponsiveConfig } from '../src/layout/breakpoints';
import { dimensionListeners, resetMockDimensions } from './setup';

describe('useDeviceOrientation', () => {
  beforeEach(() => {
    resetMockDimensions();
  });

  describe('getResponsiveConfig (underlying logic)', () => {
    // Test the underlying config function directly
    it('should compute correct config for phone portrait', () => {
      const config = getResponsiveConfig(375, 812);

      expect(config.deviceType).toBe('phone');
      expect(config.orientation).toBe('portrait');
      expect(config.isTablet).toBe(false);
      expect(config.isLandscape).toBe(false);
      expect(config.deviceSize).toBe('small');
    });

    it('should compute correct config for phone landscape', () => {
      const config = getResponsiveConfig(812, 375);

      expect(config.deviceType).toBe('tablet');
      expect(config.orientation).toBe('landscape');
      expect(config.isLandscape).toBe(true);
    });

    it('should compute correct config for tablet portrait', () => {
      const config = getResponsiveConfig(768, 1024);

      expect(config.deviceType).toBe('tablet');
      expect(config.orientation).toBe('portrait');
      expect(config.isTablet).toBe(true);
      expect(config.deviceSize).toBe('large');
    });

    it('should compute correct config for tablet landscape', () => {
      const config = getResponsiveConfig(1024, 768);

      expect(config.deviceType).toBe('tablet');
      expect(config.orientation).toBe('landscape');
      expect(config.isTablet).toBe(true);
      expect(config.isLandscape).toBe(true);
      expect(config.deviceSize).toBe('xlarge');
    });

    it('should detect split screen on tablet', () => {
      // 600 / 1400 = 0.43 (< 0.5 - third-screen mode, and width >= 600)
      const config = getResponsiveConfig(600, 1400);

      expect(config.isSplitScreen).toBe(true);
      expect(config.layoutMode).toBe('third');
    });
  });

  describe('Dimensions mock setup', () => {
    it('should return mocked dimensions', () => {
      const dims = Dimensions.get('window');
      expect(dims.width).toBe(375);
      expect(dims.height).toBe(812);
    });

    it('should register dimension listeners', () => {
      const handler = vi.fn();
      const subscription = Dimensions.addEventListener('change', handler);

      expect(dimensionListeners).toHaveLength(1);

      subscription.remove();
      expect(dimensionListeners).toHaveLength(0);
    });

    it('should clean up listeners on remove', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const sub1 = Dimensions.addEventListener('change', handler1);
      const sub2 = Dimensions.addEventListener('change', handler2);

      expect(dimensionListeners).toHaveLength(2);

      sub1.remove();
      expect(dimensionListeners).toHaveLength(1);

      sub2.remove();
      expect(dimensionListeners).toHaveLength(0);
    });
  });

  describe('hook exports', () => {
    it('should export useDeviceOrientation', () => {
      expect(typeof useDeviceOrientation).toBe('function');
    });

    it('should export useIsLandscape', () => {
      expect(typeof useIsLandscape).toBe('function');
    });

    it('should export useIsTablet', () => {
      expect(typeof useIsTablet).toBe('function');
    });

    it('should export useIsSplitScreen', () => {
      expect(typeof useIsSplitScreen).toBe('function');
    });
  });
});
