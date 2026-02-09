/**
 * Tests for breakpoints and responsive utilities
 */

import { describe, it, expect } from 'vitest';
import {
  BREAKPOINTS,
  getDeviceType,
  getOrientation,
  getDeviceSize,
  getLayoutMode,
  getResponsiveConfig,
  getContentPadding,
  getMaxContentWidth,
} from '../src/layout/breakpoints';

describe('breakpoints', () => {
  describe('BREAKPOINTS', () => {
    it('should define standard breakpoint values', () => {
      expect(BREAKPOINTS.phoneSmall).toBe(320);
      expect(BREAKPOINTS.phone).toBe(375);
      expect(BREAKPOINTS.phoneLarge).toBe(428);
      expect(BREAKPOINTS.tabletSmall).toBe(600);
      expect(BREAKPOINTS.tablet).toBe(768);
      expect(BREAKPOINTS.tabletLarge).toBe(1024);
      expect(BREAKPOINTS.tabletXL).toBe(1366);
    });
  });

  describe('getDeviceType', () => {
    it('should return "phone" for widths below tablet breakpoint', () => {
      expect(getDeviceType(320)).toBe('phone');
      expect(getDeviceType(375)).toBe('phone');
      expect(getDeviceType(599)).toBe('phone');
    });

    it('should return "tablet" for widths at or above tablet breakpoint', () => {
      expect(getDeviceType(600)).toBe('tablet');
      expect(getDeviceType(768)).toBe('tablet');
      expect(getDeviceType(1024)).toBe('tablet');
    });
  });

  describe('getOrientation', () => {
    it('should return "portrait" when height > width', () => {
      expect(getOrientation(375, 812)).toBe('portrait');
      expect(getOrientation(768, 1024)).toBe('portrait');
    });

    it('should return "landscape" when width > height', () => {
      expect(getOrientation(812, 375)).toBe('landscape');
      expect(getOrientation(1024, 768)).toBe('landscape');
    });

    it('should return "portrait" when width equals height', () => {
      expect(getOrientation(500, 500)).toBe('portrait');
    });
  });

  describe('getDeviceSize', () => {
    it('should return "small" for phone-sized widths', () => {
      expect(getDeviceSize(320)).toBe('small');
      expect(getDeviceSize(375)).toBe('small');
      expect(getDeviceSize(599)).toBe('small');
    });

    it('should return "medium" for small tablet widths', () => {
      expect(getDeviceSize(600)).toBe('medium');
      expect(getDeviceSize(767)).toBe('medium');
    });

    it('should return "large" for standard tablet widths', () => {
      expect(getDeviceSize(768)).toBe('large');
      expect(getDeviceSize(1023)).toBe('large');
    });

    it('should return "xlarge" for large tablet widths', () => {
      expect(getDeviceSize(1024)).toBe('xlarge');
      expect(getDeviceSize(1366)).toBe('xlarge');
    });
  });

  describe('getLayoutMode', () => {
    it('should return "full" for normal aspect ratios', () => {
      expect(getLayoutMode(375, 812)).toBe('full');
      expect(getLayoutMode(768, 1024)).toBe('full');
    });

    it('should return "half" for half-screen mode on tablets', () => {
      // 600 / 1024 = 0.586 (between 0.5 and 0.75 - narrow aspect ratio)
      expect(getLayoutMode(600, 1024)).toBe('half');
      // 700 / 1024 = 0.68 (also half-screen range)
      expect(getLayoutMode(700, 1024)).toBe('half');
    });

    it('should return "third" for third-screen mode on tablets', () => {
      // Third-screen mode requires width >= 600 (tabletSmall) AND aspectRatio < 0.5
      // 600 / 1400 = 0.43 (< 0.5 - third-screen, tablet width)
      expect(getLayoutMode(600, 1400)).toBe('third');
      // 650 / 1500 = 0.43 (also third-screen range)
      expect(getLayoutMode(650, 1500)).toBe('third');
    });

    it('should return "compact" for slide-over mode', () => {
      expect(getLayoutMode(300, 800)).toBe('compact');
    });
  });

  describe('getResponsiveConfig', () => {
    it('should return complete config for iPhone-sized screen', () => {
      const config = getResponsiveConfig(375, 812);

      expect(config.deviceType).toBe('phone');
      expect(config.orientation).toBe('portrait');
      expect(config.deviceSize).toBe('small');
      expect(config.layoutMode).toBe('full');
      expect(config.isTablet).toBe(false);
      expect(config.isLandscape).toBe(false);
      expect(config.isSplitScreen).toBe(false);
      expect(config.width).toBe(375);
      expect(config.height).toBe(812);
    });

    it('should return complete config for iPad-sized screen', () => {
      const config = getResponsiveConfig(768, 1024);

      expect(config.deviceType).toBe('tablet');
      expect(config.orientation).toBe('portrait');
      expect(config.deviceSize).toBe('large');
      expect(config.layoutMode).toBe('full');
      expect(config.isTablet).toBe(true);
      expect(config.isLandscape).toBe(false);
      expect(config.isSplitScreen).toBe(false);
    });

    it('should return complete config for landscape tablet', () => {
      const config = getResponsiveConfig(1024, 768);

      expect(config.deviceType).toBe('tablet');
      expect(config.orientation).toBe('landscape');
      expect(config.isTablet).toBe(true);
      expect(config.isLandscape).toBe(true);
    });
  });

  describe('getContentPadding', () => {
    it('should return appropriate padding for each device size', () => {
      expect(getContentPadding('small')).toBe(16);
      expect(getContentPadding('medium')).toBe(20);
      expect(getContentPadding('large')).toBe(24);
      expect(getContentPadding('xlarge')).toBe(32);
    });
  });

  describe('getMaxContentWidth', () => {
    it('should return undefined for small and medium sizes', () => {
      expect(getMaxContentWidth('small')).toBeUndefined();
      expect(getMaxContentWidth('medium')).toBeUndefined();
    });

    it('should return max width for large devices', () => {
      expect(getMaxContentWidth('large')).toBe(900);
      expect(getMaxContentWidth('xlarge')).toBe(1200);
    });
  });
});
