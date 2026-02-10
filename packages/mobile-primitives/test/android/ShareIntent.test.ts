/**
 * ShareIntent Tests
 *
 * Tests for Android share intent handling including ACTION_SEND
 * and ACTION_SEND_MULTIPLE support.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import {
  useShareIntent,
  setShareIntentBridge,
  parseActionSend,
  parseActionSendMultiple,
  type ShareIntentBridge,
  type ShareIntentData,
} from '../../src/android/ShareIntent';
import { ShareIntentAction, ShareMimeType, ShareContentType } from '../../src/android/types';

// Helper to wait for async updates
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ShareIntent', () => {
  let mockBridge: ShareIntentBridge;

  beforeEach(() => {
    mockBridge = {
      getInitialIntent: vi.fn().mockResolvedValue(null),
      clearIntent: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn().mockReturnValue(() => {}),
    };
    setShareIntentBridge(mockBridge);
  });

  describe('useShareIntent', () => {
    it('should initialize with null content', async () => {
      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.content).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should load initial intent on mount', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_PLAIN,
        text: 'Hello, world!',
      };

      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.content).toBeTruthy();
      expect(result.current.content?.content).toBe('Hello, world!');
      expect(mockBridge.clearIntent).toHaveBeenCalled();
    });

    it('should handle text/plain intents', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_PLAIN,
        text: 'Plain text content',
      };

      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.content?.type).toBe(ShareContentType.Text);
      expect(result.current.content?.content).toBe('Plain text content');
    });

    it('should handle text/html intents', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_HTML,
        htmlText: '<p>HTML content</p>',
      };

      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.content?.type).toBe(ShareContentType.HTML);
      expect(result.current.content?.content).toContain('HTML content');
    });

    it('should handle URL intents', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_PLAIN,
        url: 'https://example.com',
      };

      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.content?.type).toBe(ShareContentType.URL);
      expect(result.current.content?.url).toBe('https://example.com');
    });

    it('should handle image intents', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.IMAGE_PNG,
        imageUris: ['content://image1.png'],
      };

      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.content?.type).toBe(ShareContentType.Image);
      expect(result.current.content?.imageUris).toEqual(['content://image1.png']);
    });

    it('should handle multiple image intents', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND_MULTIPLE,
        type: ShareMimeType.IMAGE_ANY,
        imageUris: ['content://image1.png', 'content://image2.jpg'],
      };

      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.content?.imageUris).toHaveLength(2);
    });

    it('should preserve subject as title', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_PLAIN,
        text: 'Content here',
        subject: 'My Subject',
      };

      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.content?.title).toBe('My Subject');
    });

    it('should preserve source app', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_PLAIN,
        text: 'Content',
        sourceApp: 'com.example.app',
      };

      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.content?.sourceApp).toBe('com.example.app');
    });

    it('should clear content when clearContent is called', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_PLAIN,
        text: 'Content',
      };

      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.content).toBeTruthy();

      act(() => {
        result.current.clearContent();
      });

      expect(result.current.content).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockBridge.getInitialIntent = vi.fn().mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.error).toBe('Test error');
      expect(result.current.content).toBeNull();
    });

    it('should listen for new intents', async () => {
      let listener: ((intent: ShareIntentData) => void) | null = null;
      mockBridge.addListener = vi.fn((callback) => {
        listener = callback;
        return () => {};
      });

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      // Simulate new intent
      const newIntent: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_PLAIN,
        text: 'New content',
      };

      act(() => {
        listener?.(newIntent);
      });

      await act(async () => {
        await wait(10);
      });

      expect(result.current.content?.content).toBe('New content');
    });

    it('should manually check for intent', async () => {
      const intentData: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_PLAIN,
        text: 'Manual check',
      };

      // Initially no intent
      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(null);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.content).toBeNull();

      // Now add intent
      mockBridge.getInitialIntent = vi.fn().mockResolvedValue(intentData);

      await act(async () => {
        await result.current.checkIntent();
      });

      expect(result.current.content?.content).toBe('Manual check');
    });

    it('should show error if bridge not available', async () => {
      setShareIntentBridge(null as unknown as ShareIntentBridge);

      const { result } = renderHook(() => useShareIntent());

      await act(async () => {
        await wait(50);
      });

      expect(result.current.error).toContain('Share intent bridge not available');
    });
  });

  describe('parseActionSend', () => {
    it('should parse ACTION_SEND intent', () => {
      const intent: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_PLAIN,
        text: 'Hello',
      };

      const result = parseActionSend(intent);

      expect(result).toBeTruthy();
      expect(result?.content).toBe('Hello');
    });

    it('should return null for non-SEND action', () => {
      const intent: ShareIntentData = {
        action: ShareIntentAction.SEND_MULTIPLE,
        type: ShareMimeType.TEXT_PLAIN,
        text: 'Hello',
      };

      const result = parseActionSend(intent);

      expect(result).toBeNull();
    });

    it('should handle HTML text', () => {
      const intent: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.TEXT_HTML,
        htmlText: '<p>HTML</p>',
      };

      const result = parseActionSend(intent);

      expect(result).toBeTruthy();
      expect(result?.content).toContain('HTML');
    });
  });

  describe('parseActionSendMultiple', () => {
    it('should parse ACTION_SEND_MULTIPLE intent', () => {
      const intent: ShareIntentData = {
        action: ShareIntentAction.SEND_MULTIPLE,
        type: ShareMimeType.IMAGE_ANY,
        imageUris: ['uri1', 'uri2'],
      };

      const result = parseActionSendMultiple(intent);

      expect(result).toBeTruthy();
      expect(result?.imageUris).toEqual(['uri1', 'uri2']);
    });

    it('should return null for non-SEND_MULTIPLE action', () => {
      const intent: ShareIntentData = {
        action: ShareIntentAction.SEND,
        type: ShareMimeType.IMAGE_ANY,
        imageUris: ['uri1'],
      };

      const result = parseActionSendMultiple(intent);

      expect(result).toBeNull();
    });

    it('should handle multiple images', () => {
      const intent: ShareIntentData = {
        action: ShareIntentAction.SEND_MULTIPLE,
        type: ShareMimeType.IMAGE_ANY,
        imageUris: ['uri1', 'uri2', 'uri3'],
      };

      const result = parseActionSendMultiple(intent);

      expect(result).toBeTruthy();
      expect(result?.imageUris).toHaveLength(3);
      expect(result?.content).toContain('3 image');
    });
  });
});
