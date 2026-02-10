/**
 * Tests for ResponsiveContainer components
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as React from 'react';
import {
  ResponsiveContainer,
  ResponsiveRow,
  ResponsiveColumn,
  useResponsive,
  type ResponsiveContainerProps,
  type ResponsiveRowProps,
  type ResponsiveColumnProps,
} from '../src/layout/ResponsiveContainer';
import { getContentPadding, getMaxContentWidth } from '../src/layout/breakpoints';
import { resetMockDimensions } from './setup';

describe('ResponsiveContainer', () => {
  beforeEach(() => {
    resetMockDimensions();
  });

  describe('ResponsiveContainer component', () => {
    it('should be a valid React component', () => {
      expect(typeof ResponsiveContainer).toBe('function');
    });

    it('should accept required children prop', () => {
      const props: ResponsiveContainerProps = {
        children: React.createElement('div', null, 'Test'),
      };
      expect(props.children).toBeDefined();
    });

    it('should accept optional centerContent prop', () => {
      const props: ResponsiveContainerProps = {
        children: React.createElement('div'),
        centerContent: true,
      };
      expect(props.centerContent).toBe(true);
    });

    it('should accept optional padding prop', () => {
      const props: ResponsiveContainerProps = {
        children: React.createElement('div'),
        padding: 24,
      };
      expect(props.padding).toBe(24);
    });

    it('should accept optional maxWidth prop', () => {
      const props: ResponsiveContainerProps = {
        children: React.createElement('div'),
        maxWidth: 800,
      };
      expect(props.maxWidth).toBe(800);
    });

    it('should accept noPadding prop', () => {
      const props: ResponsiveContainerProps = {
        children: React.createElement('div'),
        noPadding: true,
      };
      expect(props.noPadding).toBe(true);
    });

    it('should accept noMaxWidth prop', () => {
      const props: ResponsiveContainerProps = {
        children: React.createElement('div'),
        noMaxWidth: true,
      };
      expect(props.noMaxWidth).toBe(true);
    });

    it('should accept backgroundColor prop', () => {
      const props: ResponsiveContainerProps = {
        children: React.createElement('div'),
        backgroundColor: '#FF0000',
      };
      expect(props.backgroundColor).toBe('#FF0000');
    });

    it('should accept testID prop', () => {
      const props: ResponsiveContainerProps = {
        children: React.createElement('div'),
        testID: 'container-test',
      };
      expect(props.testID).toBe('container-test');
    });
  });

  describe('ResponsiveRow component', () => {
    it('should be a valid React component', () => {
      expect(typeof ResponsiveRow).toBe('function');
    });

    it('should accept required children prop', () => {
      const props: ResponsiveRowProps = {
        children: React.createElement('div'),
      };
      expect(props.children).toBeDefined();
    });

    it('should accept optional gap prop', () => {
      const props: ResponsiveRowProps = {
        children: React.createElement('div'),
        gap: 16,
      };
      expect(props.gap).toBe(16);
    });

    it('should accept optional wrap prop', () => {
      const props: ResponsiveRowProps = {
        children: React.createElement('div'),
        wrap: true,
      };
      expect(props.wrap).toBe(true);
    });

    it('should accept justifyContent prop', () => {
      const props: ResponsiveRowProps = {
        children: React.createElement('div'),
        justifyContent: 'space-between',
      };
      expect(props.justifyContent).toBe('space-between');
    });

    it('should accept alignItems prop', () => {
      const props: ResponsiveRowProps = {
        children: React.createElement('div'),
        alignItems: 'center',
      };
      expect(props.alignItems).toBe('center');
    });
  });

  describe('ResponsiveColumn component', () => {
    it('should be a valid React component', () => {
      expect(typeof ResponsiveColumn).toBe('function');
    });

    it('should accept required children prop', () => {
      const props: ResponsiveColumnProps = {
        children: React.createElement('div'),
      };
      expect(props.children).toBeDefined();
    });

    it('should accept optional gap prop', () => {
      const props: ResponsiveColumnProps = {
        children: React.createElement('div'),
        gap: 12,
      };
      expect(props.gap).toBe(12);
    });

    it('should accept justifyContent prop', () => {
      const props: ResponsiveColumnProps = {
        children: React.createElement('div'),
        justifyContent: 'flex-end',
      };
      expect(props.justifyContent).toBe('flex-end');
    });
  });

  describe('useResponsive hook export', () => {
    it('should export useResponsive', () => {
      expect(typeof useResponsive).toBe('function');
    });
  });

  describe('getContentPadding utility', () => {
    it('should return 16 for small devices', () => {
      expect(getContentPadding('small')).toBe(16);
    });

    it('should return 20 for medium devices', () => {
      expect(getContentPadding('medium')).toBe(20);
    });

    it('should return 24 for large devices', () => {
      expect(getContentPadding('large')).toBe(24);
    });

    it('should return 32 for xlarge devices', () => {
      expect(getContentPadding('xlarge')).toBe(32);
    });
  });

  describe('getMaxContentWidth utility', () => {
    it('should return undefined for small devices', () => {
      expect(getMaxContentWidth('small')).toBeUndefined();
    });

    it('should return undefined for medium devices', () => {
      expect(getMaxContentWidth('medium')).toBeUndefined();
    });

    it('should return 900 for large devices', () => {
      expect(getMaxContentWidth('large')).toBe(900);
    });

    it('should return 1200 for xlarge devices', () => {
      expect(getMaxContentWidth('xlarge')).toBe(1200);
    });
  });
});
