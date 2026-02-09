/**
 * ShareReceiver Tests
 *
 * Tests for the ShareReceiver component and useShareProcessor hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import type { PageId } from '@double-bind/types';
import {
  useShareProcessor,
  type NoteService,
  type ProcessingResult,
} from '../../src/ios/ShareReceiver';

describe('ShareReceiver', () => {
  let mockNoteService: NoteService;

  beforeEach(() => {
    mockNoteService = {
      createNote: vi.fn(async (_title: string, _content: string) => ({
        pageId: 'test-page-id' as PageId,
      })),
      pageExists: vi.fn(async (_title: string) => false),
    };
  });

  describe('useShareProcessor', () => {
    it('should process shared text content', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      let processResult: ProcessingResult;
      await act(async () => {
        processResult = await result.current.processShare('Hello, world!');
      });

      expect(processResult.state).toBe('success');
      expect(processResult.pageId).toBe('test-page-id');
      expect(mockNoteService.createNote).toHaveBeenCalledWith('Hello, world!', 'Hello, world!');
    });

    it('should extract and use title from content', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const content = 'My Title\nSome content here\nMore content';

      await act(async () => {
        await result.current.processShare(content);
      });

      expect(mockNoteService.createNote).toHaveBeenCalledWith('My Title', content);
    });

    it('should process URL content', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const content = 'Check out https://example.com';

      await act(async () => {
        await result.current.processShare(content);
      });

      expect(mockNoteService.createNote).toHaveBeenCalled();
      expect(result.current.result.state).toBe('success');
    });

    it('should preserve wiki links in content', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const content = 'Link to [[My Page]] and some text';

      await act(async () => {
        await result.current.processShare(content);
      });

      const callArgs = (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(callArgs[1]).toContain('[[My Page]]');
    });

    it('should reject empty content', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      let processResult: ProcessingResult;
      await act(async () => {
        processResult = await result.current.processShare('');
      });

      expect(processResult.state).toBe('error');
      expect(processResult.error).toBeDefined();
      expect(mockNoteService.createNote).not.toHaveBeenCalled();
    });

    it('should sanitize content', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const content = 'Hello\0World'; // Contains null byte

      await act(async () => {
        await result.current.processShare(content);
      });

      const callArgs = (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(callArgs[1]).toBe('HelloWorld');
    });

    it('should handle note creation errors', async () => {
      (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error')
      );

      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      let processResult: ProcessingResult;
      await act(async () => {
        processResult = await result.current.processShare('Test content');
      });

      expect(processResult.state).toBe('error');
      expect(processResult.error).toBe('Database error');
    });

    it('should update result state during processing', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      expect(result.current.result.state).toBe('idle');

      await act(async () => {
        await result.current.processShare('Test content');
      });

      // After processing completes, state should be success
      expect(result.current.result.state).toBe('success');
    });

    it('should generate title from URL hostname', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const content = 'https://example.com/path/to/page';

      await act(async () => {
        await result.current.processShare(content);
      });

      const callArgs = (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(callArgs[0]).toContain('example.com');
    });

    it('should truncate long titles', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const longTitle = 'A'.repeat(100);
      const content = `${longTitle}\nSome content`;

      await act(async () => {
        await result.current.processShare(content);
      });

      const callArgs = (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(callArgs[0].length).toBeLessThanOrEqual(83); // 80 + '...'
    });

    it('should use content as title for single-line short content', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      // Single line content (uses first line as title even if short)
      const content = 'x'; // Short content

      await act(async () => {
        await result.current.processShare(content);
      });

      const callArgs = (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0];
      // For single line, it uses the line itself as title
      expect(callArgs[0]).toBe('x');
    });

    it('should handle content with excessive whitespace', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const content = 'Line1\n\n\n\n\n\nLine2';

      await act(async () => {
        await result.current.processShare(content);
      });

      const callArgs = (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const sanitized = callArgs[1];
      expect(sanitized).toBe('Line1\n\n\nLine2'); // Max 3 newlines
    });

    it('should process multiple shares sequentially', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      await act(async () => {
        await result.current.processShare('First share');
      });

      expect(result.current.result.state).toBe('success');

      await act(async () => {
        await result.current.processShare('Second share');
      });

      expect(result.current.result.state).toBe('success');
      expect(mockNoteService.createNote).toHaveBeenCalledTimes(2);
    });
  });

  describe('title generation', () => {
    it('should use first line as title for multiline content', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const content = 'Title Line\nContent line 1\nContent line 2';

      await act(async () => {
        await result.current.processShare(content);
      });

      const callArgs = (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(callArgs[0]).toBe('Title Line');
    });

    it('should not use first line if empty', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const content = '\nContent line';

      await act(async () => {
        await result.current.processShare(content);
      });

      const callArgs = (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(callArgs[0]).not.toBe('');
      // When first line is empty, second line is used
      expect(callArgs[0]).toBe('Content line');
    });

    it('should handle URL with query parameters in title', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      const content = 'https://example.com/page?query=value';

      await act(async () => {
        await result.current.processShare(content);
      });

      const callArgs = (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(callArgs[0]).toContain('example.com');
    });
  });

  describe('validation', () => {
    it('should validate content before processing', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      // Content too long
      const longContent = 'A'.repeat(100 * 1024 + 1);

      let processResult: ProcessingResult;
      await act(async () => {
        processResult = await result.current.processShare(longContent);
      });

      expect(processResult.state).toBe('error');
      expect(processResult.error).toContain('maximum length');
      expect(mockNoteService.createNote).not.toHaveBeenCalled();
    });

    it('should validate URL format for URL content', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      // This will be detected as URL type but URL is invalid
      // However, parseSharedContent will still parse it
      const content = 'not a url';

      await act(async () => {
        await result.current.processShare(content);
      });

      // Should succeed as plain text since URL parsing is lenient
      expect(result.current.result.state).toBe('success');
    });
  });

  describe('error handling', () => {
    it('should handle unknown errors gracefully', async () => {
      (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        'Unknown error'
      );

      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      let processResult: ProcessingResult;
      await act(async () => {
        processResult = await result.current.processShare('Test');
      });

      expect(processResult.state).toBe('error');
      expect(processResult.error).toBe('Unknown error');
    });

    it('should maintain state after error', async () => {
      (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('First error')
      );
      (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        pageId: 'test-id' as PageId,
      });

      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      // First attempt fails
      await act(async () => {
        await result.current.processShare('Test 1');
      });

      expect(result.current.result.state).toBe('error');

      // Second attempt succeeds
      await act(async () => {
        await result.current.processShare('Test 2');
      });

      expect(result.current.result.state).toBe('success');
    });
  });

  describe('result state', () => {
    it('should provide correct result on success', async () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      await act(async () => {
        await result.current.processShare('Test content');
      });

      expect(result.current.result.state).toBe('success');
      expect(result.current.result.pageId).toBe('test-page-id');
      expect(result.current.result.title).toBe('Test content');
      expect(result.current.result.error).toBeUndefined();
    });

    it('should provide correct result on error', async () => {
      (mockNoteService.createNote as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed')
      );

      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      await act(async () => {
        await result.current.processShare('Test');
      });

      expect(result.current.result.state).toBe('error');
      expect(result.current.result.error).toBe('Failed');
      expect(result.current.result.pageId).toBeUndefined();
    });

    it('should start with idle state', () => {
      const { result } = renderHook(() => useShareProcessor(mockNoteService));

      expect(result.current.result.state).toBe('idle');
    });
  });
});
