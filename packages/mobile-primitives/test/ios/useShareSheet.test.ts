/**
 * useShareSheet Hook Tests
 *
 * Tests for the iOS share sheet hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { useShareSheet, setShareAPI } from '../../src/ios/useShareSheet';
import type { ShareResult } from '../../src/ios/types';

// ShareAPI type from useShareSheet (not exported, so we define it here for tests)
interface ShareAPI {
  share: (
    options: { message?: string; title?: string; url?: string },
    dialogOptions?: { dialogTitle?: string; subject?: string; tintColor?: string }
  ) => Promise<{ action: 'sharedAction' | 'dismissedAction' }>;
}

describe('useShareSheet', () => {
  // Mock Share API
  const mockShareAPI = {
    share: vi.fn(),
  };

  beforeEach(() => {
    mockShareAPI.share.mockClear();
    setShareAPI(mockShareAPI as unknown as ShareAPI);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('shareText', () => {
    it('should share text content successfully', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      let shareResult: ShareResult;
      await act(async () => {
        shareResult = await result.current.shareText('Hello, world!');
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith({
        message: 'Hello, world!',
      });
      expect(shareResult.success).toBe(true);
      expect(shareResult.action).toBe('shared');
    });

    it('should handle share cancellation', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'dismissedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      let shareResult: ShareResult;
      await act(async () => {
        shareResult = await result.current.shareText('Test content');
      });

      expect(shareResult.success).toBe(false);
      expect(shareResult.action).toBe('cancelled');
    });

    it('should include title in share options', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareText('Content', { title: 'My Title' });
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith({
        message: 'Content',
        title: 'My Title',
      });
    });

    it('should reject empty content', async () => {
      const { result } = renderHook(() => useShareSheet());

      let shareResult: ShareResult;
      await act(async () => {
        shareResult = await result.current.shareText('');
      });

      expect(shareResult.success).toBe(false);
      expect(shareResult.error).toContain('empty');
      expect(mockShareAPI.share).not.toHaveBeenCalled();
    });

    it('should handle Share API errors', async () => {
      mockShareAPI.share.mockRejectedValue(new Error('Share failed'));

      const { result } = renderHook(() => useShareSheet());

      let shareResult: ShareResult;
      await act(async () => {
        shareResult = await result.current.shareText('Test');
      });

      expect(shareResult.success).toBe(false);
      expect(shareResult.error).toBe('Share failed');
    });

    it('should update isSharing state during operation', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      expect(result.current.isSharing).toBe(false);

      await act(async () => {
        await result.current.shareText('Test');
      });

      // After completion, isSharing should be false again
      expect(result.current.isSharing).toBe(false);
    });

    it('should clear error on new share', async () => {
      mockShareAPI.share.mockRejectedValueOnce(new Error('First error'));
      mockShareAPI.share.mockResolvedValueOnce({ action: 'sharedAction' });

      const { result } = renderHook(() => useShareSheet());

      // First share fails
      await act(async () => {
        await result.current.shareText('Test 1');
      });

      expect(result.current.error).toBe('First error');

      // Second share succeeds
      await act(async () => {
        await result.current.shareText('Test 2');
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('shareWithWikiLinks', () => {
    it('should preserve wiki links in content', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      const content = 'Link to [[My Page]] and [[Another Page]]';

      await act(async () => {
        await result.current.shareWithWikiLinks(content);
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith({
        message: content,
      });
    });

    it('should handle content without wiki links', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareWithWikiLinks('Plain text');
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith({
        message: 'Plain text',
      });
    });

    it('should pass through options', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareWithWikiLinks('Content', {
          title: 'My Title',
        });
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith({
        message: 'Content',
        title: 'My Title',
      });
    });
  });

  describe('shareAsMarkdown', () => {
    it('should convert content to markdown', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareAsMarkdown('Check out https://example.com');
      });

      // Should convert URL to markdown link
      expect(mockShareAPI.share).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('[https://example.com](https://example.com)'),
        })
      );
    });

    it('should add title to markdown', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareAsMarkdown('Content', {
          title: 'My Note',
        });
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('# My Note'),
        })
      );
    });

    it('should preserve wiki links in markdown', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareAsMarkdown('See [[My Page]]');
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('[[My Page]]'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle missing Share API', async () => {
      setShareAPI(null as unknown as ShareAPI);

      const { result } = renderHook(() => useShareSheet());

      let shareResult: ShareResult;
      await act(async () => {
        shareResult = await result.current.shareText('Test');
      });

      expect(shareResult.success).toBe(false);
      expect(shareResult.error).toContain('Share API not available');

      // Restore for other tests
      setShareAPI(mockShareAPI as unknown as ShareAPI);
    });

    it('should set error state on failure', async () => {
      mockShareAPI.share.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareText('Test');
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should handle unknown errors', async () => {
      mockShareAPI.share.mockRejectedValue('Unknown error');

      const { result } = renderHook(() => useShareSheet());

      let shareResult: ShareResult;
      await act(async () => {
        shareResult = await result.current.shareText('Test');
      });

      expect(shareResult.success).toBe(false);
      expect(shareResult.error).toBe('Unknown error');
    });
  });

  describe('state management', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useShareSheet());

      expect(result.current.isSharing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should maintain state across multiple operations', async () => {
      mockShareAPI.share.mockResolvedValue({
        action: 'sharedAction',
      });

      const { result } = renderHook(() => useShareSheet());

      // First share
      await act(async () => {
        await result.current.shareText('First');
      });

      expect(result.current.isSharing).toBe(false);
      expect(result.current.error).toBeNull();

      // Second share
      await act(async () => {
        await result.current.shareText('Second');
      });

      expect(result.current.isSharing).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
