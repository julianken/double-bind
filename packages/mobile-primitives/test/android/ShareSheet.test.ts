/**
 * ShareSheet Tests
 *
 * Tests for Android share sheet integration for sharing from the app.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import {
  useShareSheet,
  setShareAPI,
  shareTextContent,
  shareUrlContent,
  type ShareAPI,
} from '../../src/android/ShareSheet';

describe('ShareSheet', () => {
  let mockShareAPI: ShareAPI;

  beforeEach(() => {
    mockShareAPI = {
      share: vi.fn().mockResolvedValue({ action: 'sharedAction' }),
    };
    setShareAPI(mockShareAPI);
  });

  describe('useShareSheet', () => {
    it('should initialize with correct state', () => {
      const { result } = renderHook(() => useShareSheet());

      expect(result.current.isSharing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should share text content', async () => {
      const { result } = renderHook(() => useShareSheet());

      let shareResult;
      await act(async () => {
        shareResult = await result.current.shareText('Hello, world!');
      });

      expect(shareResult).toEqual({
        success: true,
        action: 'shared',
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith({ message: 'Hello, world!' }, {});
    });

    it('should share text with title', async () => {
      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareText('Content', { title: 'My Title' });
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith(
        { message: 'Content', title: 'My Title' },
        {}
      );
    });

    it('should share text with dialog title', async () => {
      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareText('Content', { dialogTitle: 'Share with' });
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith(
        { message: 'Content' },
        { dialogTitle: 'Share with' }
      );
    });

    it('should share text with excluded apps', async () => {
      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareText('Content', {
          excludedApps: ['com.example.app'],
        });
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith(
        { message: 'Content' },
        { excludedActivityTypes: ['com.example.app'] }
      );
    });

    it('should handle share cancellation', async () => {
      mockShareAPI.share = vi.fn().mockResolvedValue({ action: 'dismissedAction' });

      const { result } = renderHook(() => useShareSheet());

      let shareResult;
      await act(async () => {
        shareResult = await result.current.shareText('Content');
      });

      expect(shareResult).toEqual({
        success: false,
        action: 'cancelled',
      });
    });

    it('should handle empty content error', async () => {
      const { result } = renderHook(() => useShareSheet());

      let shareResult;
      await act(async () => {
        shareResult = await result.current.shareText('');
      });

      expect(shareResult.success).toBe(false);
      expect(shareResult.error).toContain('empty');
      expect(result.current.error).toContain('empty');
    });

    it('should handle share API errors', async () => {
      mockShareAPI.share = vi.fn().mockRejectedValue(new Error('Share failed'));

      const { result } = renderHook(() => useShareSheet());

      let shareResult;
      await act(async () => {
        shareResult = await result.current.shareText('Content');
      });

      expect(shareResult.success).toBe(false);
      expect(shareResult.error).toBe('Share failed');
      expect(result.current.error).toBe('Share failed');
    });

    it('should set isSharing during share operation', async () => {
      let resolveFn: (value: { action: string }) => void;
      const promise = new Promise<{ action: string }>((resolve) => {
        resolveFn = resolve;
      });
      mockShareAPI.share = vi.fn().mockReturnValue(promise);

      const { result } = renderHook(() => useShareSheet());

      const sharePromise = act(async () => {
        await result.current.shareText('Content');
      });

      // Should be sharing
      expect(result.current.isSharing).toBe(true);

      // Resolve the share
      resolveFn!({ action: 'sharedAction' });
      await sharePromise;

      // Should not be sharing anymore
      expect(result.current.isSharing).toBe(false);
    });

    it('should share URL', async () => {
      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareUrl('https://example.com');
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith({ message: 'https://example.com' }, {});
    });

    it('should validate URL format', async () => {
      const { result } = renderHook(() => useShareSheet());

      let shareResult;
      await act(async () => {
        shareResult = await result.current.shareUrl('not a url');
      });

      expect(shareResult.success).toBe(false);
      expect(shareResult.error).toContain('Invalid URL');
      expect(result.current.error).toContain('Invalid URL');
    });

    it('should share with wiki links preserved', async () => {
      const { result } = renderHook(() => useShareSheet());

      const content = 'See [[My Page]] and [[Another Page]]';

      await act(async () => {
        await result.current.shareWithWikiLinks(content);
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith({ message: content }, {});
    });

    it('should share as markdown', async () => {
      const { result } = renderHook(() => useShareSheet());

      await act(async () => {
        await result.current.shareAsMarkdown('Check out https://example.com', {
          title: 'My Note',
        });
      });

      expect(mockShareAPI.share).toHaveBeenCalled();
      const callArgs = (mockShareAPI.share as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        message: string;
      };
      expect(callArgs.message).toContain('# My Note');
      expect(callArgs.message).toContain('[https://example.com]');
    });

    it('should show error if Share API not available', async () => {
      setShareAPI(null as unknown as ShareAPI);

      const { result } = renderHook(() => useShareSheet());

      let shareResult;
      await act(async () => {
        shareResult = await result.current.shareText('Content');
      });

      expect(shareResult.success).toBe(false);
      expect(shareResult.error).toContain('Share API not available');
    });
  });

  describe('shareTextContent', () => {
    it('should share text content', async () => {
      const result = await shareTextContent('Hello');

      expect(result.success).toBe(true);
      expect(mockShareAPI.share).toHaveBeenCalled();
    });

    it('should handle options', async () => {
      await shareTextContent('Content', {
        title: 'Title',
        dialogTitle: 'Share',
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith(
        { message: 'Content', title: 'Title' },
        { dialogTitle: 'Share' }
      );
    });

    it('should handle cancellation', async () => {
      mockShareAPI.share = vi.fn().mockResolvedValue({ action: 'dismissedAction' });

      const result = await shareTextContent('Content');

      expect(result).toEqual({
        success: false,
        action: 'cancelled',
      });
    });

    it('should handle errors', async () => {
      mockShareAPI.share = vi.fn().mockRejectedValue(new Error('Test error'));

      const result = await shareTextContent('Content');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should return error if Share API not available', async () => {
      setShareAPI(null as unknown as ShareAPI);

      const result = await shareTextContent('Content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Share API not available');
    });
  });

  describe('shareUrlContent', () => {
    it('should share URL', async () => {
      const result = await shareUrlContent('https://example.com');

      expect(result.success).toBe(true);
      expect(mockShareAPI.share).toHaveBeenCalled();
    });

    it('should validate URL format', async () => {
      const result = await shareUrlContent('not a url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should handle options', async () => {
      await shareUrlContent('https://example.com', {
        title: 'Link',
      });

      expect(mockShareAPI.share).toHaveBeenCalledWith(
        { message: 'https://example.com', title: 'Link' },
        {}
      );
    });
  });
});
