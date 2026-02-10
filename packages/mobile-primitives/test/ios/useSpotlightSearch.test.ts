/**
 * Tests for useSpotlightSearch hook and search utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import {
  useSpotlightSearch,
  useHasSpotlight,
  MockSpotlightSearchBridge,
  type SpotlightSearchHandler,
} from '../../src/ios/useSpotlightSearch.js';

describe('MockSpotlightSearchBridge', () => {
  let bridge: MockSpotlightSearchBridge;

  beforeEach(() => {
    bridge = new MockSpotlightSearchBridge();
  });

  it('should start with no handlers', () => {
    expect(bridge.getHandlerCount()).toBe(0);
  });

  it('should add and remove listeners', () => {
    const handler = vi.fn();
    const cleanup = bridge.addListener(handler);

    expect(bridge.getHandlerCount()).toBe(1);

    cleanup();
    expect(bridge.getHandlerCount()).toBe(0);
  });

  it('should notify handlers when search result is simulated', () => {
    const handler = vi.fn();
    bridge.addListener(handler);

    bridge.simulateSearchResult({
      itemIdentifier: 'test-id',
      pageId: 'test-page-id',
      searchQuery: 'test query',
    });

    expect(handler).toHaveBeenCalledWith({
      itemIdentifier: 'test-id',
      pageId: 'test-page-id',
      searchQuery: 'test query',
    });
  });

  it('should notify multiple handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bridge.addListener(handler1);
    bridge.addListener(handler2);

    bridge.simulateSearchResult({
      itemIdentifier: 'test-id',
      pageId: 'test-page-id',
    });

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('should not notify removed handlers', () => {
    const handler = vi.fn();
    const cleanup = bridge.addListener(handler);

    cleanup();

    bridge.simulateSearchResult({
      itemIdentifier: 'test-id',
      pageId: 'test-page-id',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should parse valid deep links', () => {
    const result = bridge.parseDeepLink('doublebind://page/test-page-id');

    expect(result).toEqual({
      itemIdentifier: 'test-page-id',
      pageId: 'test-page-id',
      searchQuery: undefined,
    });
  });

  it('should parse deep links with query', () => {
    const result = bridge.parseDeepLink('doublebind://page/test-page-id?query=search%20term');

    expect(result).toEqual({
      itemIdentifier: 'test-page-id',
      pageId: 'test-page-id',
      searchQuery: 'search term',
    });
  });

  it('should return null for invalid deep links', () => {
    expect(bridge.parseDeepLink('https://example.com')).toBeNull();
    expect(bridge.parseDeepLink('doublebind://invalid')).toBeNull();
    expect(bridge.parseDeepLink('')).toBeNull();
  });

  it('should report as available by default', () => {
    expect(bridge.isAvailable()).toBe(true);
  });

  it('should allow setting availability', () => {
    bridge.setAvailable(false);
    expect(bridge.isAvailable()).toBe(false);

    bridge.setAvailable(true);
    expect(bridge.isAvailable()).toBe(true);
  });
});

describe('useSpotlightSearch', () => {
  let bridge: MockSpotlightSearchBridge;

  beforeEach(() => {
    bridge = new MockSpotlightSearchBridge();
  });

  it('should register handler on mount', () => {
    const handler = vi.fn();

    renderHook(() => useSpotlightSearch(handler, { bridge }));

    expect(bridge.getHandlerCount()).toBe(1);
  });

  it('should unregister handler on unmount', () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() => useSpotlightSearch(handler, { bridge }));

    expect(bridge.getHandlerCount()).toBe(1);

    unmount();
    expect(bridge.getHandlerCount()).toBe(0);
  });

  it('should call handler when search result is tapped', () => {
    const handler = vi.fn();

    renderHook(() => useSpotlightSearch(handler, { bridge }));

    bridge.simulateSearchResult({
      itemIdentifier: 'test-id',
      pageId: 'test-page-id',
      searchQuery: 'test query',
    });

    expect(handler).toHaveBeenCalledWith({
      itemIdentifier: 'test-id',
      pageId: 'test-page-id',
      searchQuery: 'test query',
    });
  });

  it('should use latest handler when it changes', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const { rerender } = renderHook<
      { handler: SpotlightSearchHandler },
      ReturnType<typeof useSpotlightSearch>
    >(({ handler }) => useSpotlightSearch(handler, { bridge }), {
      initialProps: { handler: handler1 },
    });

    bridge.simulateSearchResult({
      itemIdentifier: 'test-id',
      pageId: 'test-page-id',
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();

    // Update handler
    rerender({ handler: handler2 });

    bridge.simulateSearchResult({
      itemIdentifier: 'test-id-2',
      pageId: 'test-page-id-2',
    });

    expect(handler1).toHaveBeenCalledTimes(1); // Still only called once
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should not register handler when disabled', () => {
    const handler = vi.fn();

    renderHook(() => useSpotlightSearch(handler, { bridge, enabled: false }));

    expect(bridge.getHandlerCount()).toBe(0);
  });

  it('should unregister handler when disabled', () => {
    const handler = vi.fn();

    const { rerender } = renderHook<{ enabled: boolean }, ReturnType<typeof useSpotlightSearch>>(
      ({ enabled }) => useSpotlightSearch(handler, { bridge, enabled }),
      { initialProps: { enabled: true } }
    );

    expect(bridge.getHandlerCount()).toBe(1);

    rerender({ enabled: false });
    expect(bridge.getHandlerCount()).toBe(0);
  });

  it('should re-register handler when re-enabled', () => {
    const handler = vi.fn();

    const { rerender } = renderHook<{ enabled: boolean }, ReturnType<typeof useSpotlightSearch>>(
      ({ enabled }) => useSpotlightSearch(handler, { bridge, enabled }),
      { initialProps: { enabled: false } }
    );

    expect(bridge.getHandlerCount()).toBe(0);

    rerender({ enabled: true });
    expect(bridge.getHandlerCount()).toBe(1);
  });

  it('should return availability status', () => {
    const handler = vi.fn();

    const { result } = renderHook(() => useSpotlightSearch(handler, { bridge }));

    expect(result.current.isAvailable).toBe(true);
  });

  it('should return parseDeepLink function', () => {
    const handler = vi.fn();

    const { result } = renderHook(() => useSpotlightSearch(handler, { bridge }));

    expect(result.current.parseDeepLink).toBeInstanceOf(Function);
  });

  it('should parse deep links correctly', () => {
    const handler = vi.fn();

    const { result } = renderHook(() => useSpotlightSearch(handler, { bridge }));

    const parsed = result.current.parseDeepLink('doublebind://page/test-page-id');

    expect(parsed).toEqual({
      itemIdentifier: 'test-page-id',
      pageId: 'test-page-id',
      searchQuery: undefined,
    });
  });

  it('should handle missing bridge gracefully', () => {
    const handler = vi.fn();

    const { result } = renderHook(() => useSpotlightSearch(handler));

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.parseDeepLink('doublebind://page/test')).toBeNull();
  });

  it('should not re-register on re-renders without prop changes', () => {
    const handler = vi.fn();

    const { rerender } = renderHook(() => useSpotlightSearch(handler, { bridge }));

    expect(bridge.getHandlerCount()).toBe(1);

    // Re-render without changing props
    rerender();

    // Should still have only one handler
    expect(bridge.getHandlerCount()).toBe(1);
  });
});

describe('useHasSpotlight', () => {
  it('should return true when bridge is available', () => {
    const bridge = new MockSpotlightSearchBridge();
    const { result } = renderHook(() => useHasSpotlight(bridge));

    expect(result.current).toBe(true);
  });

  it('should return false when bridge is unavailable', () => {
    const bridge = new MockSpotlightSearchBridge();
    bridge.setAvailable(false);

    const { result } = renderHook(() => useHasSpotlight(bridge));

    expect(result.current).toBe(false);
  });

  it('should return false when no bridge provided', () => {
    const { result } = renderHook(() => useHasSpotlight());

    expect(result.current).toBe(false);
  });
});
