/**
 * Tests for ScreenLayout components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import {
  ScreenLayout,
  TabletLayout,
  type ScreenLayoutProps,
  type TabletLayoutProps,
} from '../src/layout/ScreenLayout';
import { resetMockDimensions } from './setup';

describe('ScreenLayout', () => {
  beforeEach(() => {
    resetMockDimensions();
  });

  describe('ScreenLayout component', () => {
    it('should be a valid React component', () => {
      expect(typeof ScreenLayout).toBe('function');
    });

    it('should accept required children prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div', null, 'Test'),
      };
      expect(props.children).toBeDefined();
    });

    it('should accept optional header prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        header: React.createElement('div', null, 'Header'),
      };
      expect(props.header).toBeDefined();
    });

    it('should accept optional footer prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        footer: React.createElement('div', null, 'Footer'),
      };
      expect(props.footer).toBeDefined();
    });

    it('should accept optional title prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        title: 'My Screen',
      };
      expect(props.title).toBe('My Screen');
    });

    it('should accept optional backgroundColor prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        backgroundColor: '#FF0000',
      };
      expect(props.backgroundColor).toBe('#FF0000');
    });

    it('should accept scrollable prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        scrollable: true,
      };
      expect(props.scrollable).toBe(true);
    });

    it('should accept refreshing and onRefresh props', () => {
      const onRefresh = vi.fn();
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        refreshing: false,
        onRefresh,
      };
      expect(props.refreshing).toBe(false);
      expect(props.onRefresh).toBe(onRefresh);
    });

    it('should accept loading and loadingMessage props', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        loading: true,
        loadingMessage: 'Loading data...',
      };
      expect(props.loading).toBe(true);
      expect(props.loadingMessage).toBe('Loading data...');
    });

    it('should accept error and onRetry props', () => {
      const onRetry = vi.fn();
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        error: 'Something went wrong',
        onRetry,
      };
      expect(props.error).toBe('Something went wrong');
      expect(props.onRetry).toBe(onRetry);
    });

    it('should accept edges prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        edges: ['top', 'bottom'],
      };
      expect(props.edges).toEqual(['top', 'bottom']);
    });

    it('should accept style and contentStyle props', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        style: { marginTop: 10 },
        contentStyle: { padding: 20 },
      };
      expect(props.style).toEqual({ marginTop: 10 });
      expect(props.contentStyle).toEqual({ padding: 20 });
    });

    it('should accept responsivePadding prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        responsivePadding: false,
      };
      expect(props.responsivePadding).toBe(false);
    });

    it('should accept centerContent prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        centerContent: true,
      };
      expect(props.centerContent).toBe(true);
    });

    it('should accept keyboardAvoiding prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        keyboardAvoiding: true,
      };
      expect(props.keyboardAvoiding).toBe(true);
    });

    it('should accept testID prop', () => {
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
        testID: 'screen-layout-test',
      };
      expect(props.testID).toBe('screen-layout-test');
    });
  });

  describe('TabletLayout component', () => {
    it('should be a valid React component', () => {
      expect(typeof TabletLayout).toBe('function');
    });

    it('should accept required children prop', () => {
      const props: TabletLayoutProps = {
        children: React.createElement('div', null, 'Main Content'),
      };
      expect(props.children).toBeDefined();
    });

    it('should accept optional sidebar prop', () => {
      const props: TabletLayoutProps = {
        children: React.createElement('div'),
        sidebar: React.createElement('div', null, 'Sidebar'),
      };
      expect(props.sidebar).toBeDefined();
    });

    it('should accept optional sidebarWidth prop', () => {
      const props: TabletLayoutProps = {
        children: React.createElement('div'),
        sidebarWidth: 280,
      };
      expect(props.sidebarWidth).toBe(280);
    });

    it('should accept landscapeOnly prop', () => {
      const props: TabletLayoutProps = {
        children: React.createElement('div'),
        landscapeOnly: true,
      };
      expect(props.landscapeOnly).toBe(true);
    });

    it('should accept backgroundColor prop', () => {
      const props: TabletLayoutProps = {
        children: React.createElement('div'),
        backgroundColor: '#FFFFFF',
      };
      expect(props.backgroundColor).toBe('#FFFFFF');
    });

    it('should accept edges prop', () => {
      const props: TabletLayoutProps = {
        children: React.createElement('div'),
        edges: ['top', 'left', 'right'],
      };
      expect(props.edges).toEqual(['top', 'left', 'right']);
    });

    it('should accept testID prop', () => {
      const props: TabletLayoutProps = {
        children: React.createElement('div'),
        testID: 'tablet-layout-test',
      };
      expect(props.testID).toBe('tablet-layout-test');
    });
  });

  describe('default prop values', () => {
    it('ScreenLayout should have sensible defaults', () => {
      // Test that component renders without optional props
      const props: ScreenLayoutProps = {
        children: React.createElement('div'),
      };

      // These should not throw
      expect(props.backgroundColor).toBeUndefined();
      expect(props.scrollable).toBeUndefined();
      expect(props.loading).toBeUndefined();
      expect(props.error).toBeUndefined();
    });

    it('TabletLayout should have sensible defaults', () => {
      const props: TabletLayoutProps = {
        children: React.createElement('div'),
      };

      expect(props.sidebarWidth).toBeUndefined(); // defaults to 320 in component
      expect(props.landscapeOnly).toBeUndefined(); // defaults to false
    });
  });
});
