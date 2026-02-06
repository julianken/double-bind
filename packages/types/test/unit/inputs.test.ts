/**
 * Unit tests for input types
 * Tests CreatePageInput, CreateBlockInput, and UpdateBlockInput
 */

import type { CreatePageInput, CreateBlockInput, UpdateBlockInput } from '../../src/inputs';

describe('Input Types', () => {
  describe('CreatePageInput', () => {
    it('should create input with required title', () => {
      const input: CreatePageInput = {
        title: 'My New Page',
      };

      expect(input.title).toBe('My New Page');
      expect(input.dailyNoteDate).toBeUndefined();
    });

    it('should create input with title and daily note date', () => {
      const input: CreatePageInput = {
        title: 'February 5, 2026',
        dailyNoteDate: '2026-02-05',
      };

      expect(input.title).toBe('February 5, 2026');
      expect(input.dailyNoteDate).toBe('2026-02-05');
    });

    it('should handle empty title', () => {
      const input: CreatePageInput = {
        title: '',
      };

      expect(input.title).toBe('');
    });

    it('should handle long title', () => {
      const longTitle = 'A'.repeat(1000);
      const input: CreatePageInput = {
        title: longTitle,
      };

      expect(input.title).toHaveLength(1000);
    });

    it('should handle title with special characters', () => {
      const input: CreatePageInput = {
        title: 'Title with [[brackets]] and #tags',
      };

      expect(input.title).toContain('[[');
      expect(input.title).toContain('#');
    });

    it('should handle title with unicode', () => {
      const input: CreatePageInput = {
        title: 'タイトル 🚀 Título',
      };

      expect(input.title).toContain('タイトル');
      expect(input.title).toContain('🚀');
      expect(input.title).toContain('Título');
    });

    it('should create daily note with valid date format', () => {
      const input: CreatePageInput = {
        title: 'Daily Note',
        dailyNoteDate: '2026-02-05',
      };

      expect(input.dailyNoteDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle invalid date format at type level', () => {
      // Type system allows any string, validation happens elsewhere
      const input: CreatePageInput = {
        title: 'Daily Note',
        dailyNoteDate: '02/05/2026',
      };

      expect(input.dailyNoteDate).toBe('02/05/2026');
    });
  });

  describe('CreateBlockInput', () => {
    it('should create input with required fields', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'Block content',
      };

      expect(input.pageId).toBeDefined();
      expect(input.content).toBe('Block content');
      expect(input.parentId).toBeUndefined();
      expect(input.contentType).toBeUndefined();
      expect(input.order).toBeUndefined();
    });

    it('should create input with all fields', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        parentId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        content: 'Child block content',
        contentType: 'text',
        order: 'a0',
      };

      expect(input.pageId).toBeDefined();
      expect(input.parentId).toBeDefined();
      expect(input.content).toBe('Child block content');
      expect(input.contentType).toBe('text');
      expect(input.order).toBe('a0');
    });

    it('should support text content type', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'Text content',
        contentType: 'text',
      };

      expect(input.contentType).toBe('text');
    });

    it('should support heading content type', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'Heading content',
        contentType: 'heading',
      };

      expect(input.contentType).toBe('heading');
    });

    it('should support code content type', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'const x = 42;',
        contentType: 'code',
      };

      expect(input.contentType).toBe('code');
    });

    it('should support todo content type', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'TODO: Complete task',
        contentType: 'todo',
      };

      expect(input.contentType).toBe('todo');
    });

    it('should support query content type', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: '?[page] := *page[page_id, title]',
        contentType: 'query',
      };

      expect(input.contentType).toBe('query');
    });

    it('should handle empty content', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: '',
      };

      expect(input.content).toBe('');
    });

    it('should handle multiline content', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'Line 1\nLine 2\nLine 3',
      };

      expect(input.content).toContain('\n');
      expect(input.content.split('\n')).toHaveLength(3);
    });

    it('should handle content with unicode', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'Content with 日本語 and émojis 🎉',
      };

      expect(input.content).toContain('日本語');
      expect(input.content).toContain('🎉');
    });

    it('should handle fractional order', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'Block with order',
        order: 'a0V',
      };

      expect(input.order).toBe('a0V');
    });

    it('should create root block without parentId', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'Root block',
      };

      expect(input.parentId).toBeUndefined();
    });

    it('should create child block with parentId', () => {
      const input: CreateBlockInput = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        parentId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        content: 'Child block',
      };

      expect(input.parentId).toBe('01HQRV3K2GQWZ3ZQZQZQZQZQZR');
    });
  });

  describe('UpdateBlockInput', () => {
    it('should create input with no fields (empty update)', () => {
      const input: UpdateBlockInput = {};

      expect(Object.keys(input)).toHaveLength(0);
    });

    it('should update only content', () => {
      const input: UpdateBlockInput = {
        content: 'Updated content',
      };

      expect(input.content).toBe('Updated content');
      expect(input.parentId).toBeUndefined();
      expect(input.order).toBeUndefined();
      expect(input.isCollapsed).toBeUndefined();
    });

    it('should update only parentId', () => {
      const input: UpdateBlockInput = {
        parentId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
      };

      expect(input.parentId).toBe('01HQRV3K2GQWZ3ZQZQZQZQZQZR');
    });

    it('should set parentId to null (move to root)', () => {
      const input: UpdateBlockInput = {
        parentId: null,
      };

      expect(input.parentId).toBeNull();
    });

    it('should update only order', () => {
      const input: UpdateBlockInput = {
        order: 'a1',
      };

      expect(input.order).toBe('a1');
    });

    it('should update only isCollapsed', () => {
      const input: UpdateBlockInput = {
        isCollapsed: true,
      };

      expect(input.isCollapsed).toBe(true);
    });

    it('should update multiple fields', () => {
      const input: UpdateBlockInput = {
        content: 'New content',
        isCollapsed: true,
        order: 'a2',
      };

      expect(input.content).toBe('New content');
      expect(input.isCollapsed).toBe(true);
      expect(input.order).toBe('a2');
    });

    it('should update all fields', () => {
      const input: UpdateBlockInput = {
        content: 'Complete update',
        parentId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        order: 'a3',
        isCollapsed: false,
      };

      expect(input.content).toBe('Complete update');
      expect(input.parentId).toBeDefined();
      expect(input.order).toBe('a3');
      expect(input.isCollapsed).toBe(false);
    });

    it('should handle empty content update', () => {
      const input: UpdateBlockInput = {
        content: '',
      };

      expect(input.content).toBe('');
    });

    it('should handle multiline content update', () => {
      const input: UpdateBlockInput = {
        content: 'Line 1\nLine 2',
      };

      expect(input.content).toContain('\n');
    });

    it('should toggle collapse state', () => {
      const input: UpdateBlockInput = {
        isCollapsed: true,
      };

      expect(input.isCollapsed).toBe(true);
    });

    it('should move block to different parent', () => {
      const input: UpdateBlockInput = {
        parentId: '01HQRV3K2GQWZ3ZQZQZQZQZQZS',
      };

      expect(input.parentId).toBe('01HQRV3K2GQWZ3ZQZQZQZQZQZS');
    });

    it('should reorder block', () => {
      const input: UpdateBlockInput = {
        order: 'a0V',
      };

      expect(input.order).toBe('a0V');
    });

    it('should move and reorder in one update', () => {
      const input: UpdateBlockInput = {
        parentId: '01HQRV3K2GQWZ3ZQZQZQZQZQZS',
        order: 'a1V',
      };

      expect(input.parentId).toBeDefined();
      expect(input.order).toBe('a1V');
    });

    it('should handle all optional fields as undefined', () => {
      const input: UpdateBlockInput = {
        content: undefined,
        parentId: undefined,
        order: undefined,
        isCollapsed: undefined,
      };

      expect(input.content).toBeUndefined();
      expect(input.parentId).toBeUndefined();
      expect(input.order).toBeUndefined();
      expect(input.isCollapsed).toBeUndefined();
    });
  });
});
