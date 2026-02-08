/**
 * BlockNode - Memoized recursive tree node component
 *
 * Renders a single block in the outliner hierarchy. Uses React.memo
 * for performance - only re-renders when own content, children, or
 * collapsed state changes.
 *
 * Features:
 * - Conditional rendering: BlockEditor when focused, StaticBlockContent otherwise
 * - Recursive rendering for child blocks with proper indentation
 * - Accessibility: role="treeitem" with aria-expanded for collapsible nodes
 * - Performance: contentVisibility: 'auto' for viewport-based rendering
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 */

import { memo, useCallback, useMemo, useState, useEffect } from 'react';
import type { Block, BlockId, PageId } from '@double-bind/types';
import { parseContent } from '@double-bind/core';
import { InlineBlockRef, InlinePageLink } from '@double-bind/ui-primitives';
import { useCozoQuery, invalidateQueries } from '../hooks/useCozoQuery.js';
import { useAppStore } from '../stores/ui-store.js';
import { useServices } from '../providers/ServiceProvider.js';
import { BlockEditor as RealBlockEditor } from '../editor/BlockEditor.js';

// ============================================================================
// Types
// ============================================================================

export interface BlockNodeProps {
  /**
   * The unique identifier of the block to render
   */
  blockId: BlockId;

  /**
   * Nesting depth for visual indentation (0 = root level)
   * @default 0
   */
  depth?: number;
}

export interface BulletHandleProps {
  /**
   * Whether the block's children are collapsed
   */
  isCollapsed: boolean;

  /**
   * Whether this block has any children
   */
  hasChildren: boolean;

  /**
   * Callback when the collapse toggle is clicked
   */
  onToggleCollapse?: () => void;
}

// BlockEditorProps is now defined in '../editor/BlockEditor.tsx'
// We re-export it here for backward compatibility if needed
export type { BlockEditorProps } from '../editor/BlockEditor.js';

export interface StaticBlockContentProps {
  /**
   * The content to render (may contain markdown, links, etc.)
   */
  content: string;

  /**
   * Content type for special rendering (e.g., 'todo' for checkboxes)
   * @default 'text'
   */
  contentType?: Block['contentType'];

  /**
   * Callback when the content area is clicked (to activate editing)
   */
  onClick?: () => void;

  /**
   * Callback when a page link is clicked
   */
  onPageLinkClick?: (pageId: PageId) => void;

  /**
   * Callback when a block reference is clicked
   */
  onBlockRefClick?: (blockId: BlockId) => void;

  /**
   * Callback when hovering over a page link
   */
  onPageLinkHover?: (pageId: PageId | null) => void;

  /**
   * Callback when hovering over a block reference
   */
  onBlockRefHover?: (blockId: BlockId | null) => void;
}

/**
 * Represents a parsed segment of content for rendering
 */
export interface ContentSegment {
  type:
    | 'text'
    | 'bold'
    | 'italic'
    | 'code'
    | 'highlight'
    | 'strikethrough'
    | 'page-link'
    | 'block-ref'
    | 'tag';
  content: string;
  /** Start index in original content */
  start: number;
  /** End index in original content */
  end: number;
}

/**
 * CSS class names for StaticBlockContent (BEM-style)
 */
export const STATIC_BLOCK_CONTENT_CSS_CLASSES = {
  container: 'static-block-content',
  todo: 'static-block-content--todo',
  checkbox: 'static-block-content__checkbox',
  checkboxChecked: 'static-block-content__checkbox--checked',
  text: 'static-block-content__text',
  bold: 'static-block-content__bold',
  italic: 'static-block-content__italic',
  code: 'static-block-content__code',
  highlight: 'static-block-content__highlight',
  strikethrough: 'static-block-content__strikethrough',
  pageLink: 'static-block-content__page-link',
  blockRef: 'static-block-content__block-ref',
  tag: 'static-block-content__tag',
} as const;

// ============================================================================
// Mock Hooks (to be replaced with real implementations)
// ============================================================================

/**
 * Hook to fetch a single block by ID.
 * Uses useCozoQuery for reactive data fetching.
 *
 * @param blockId - The block ID to fetch
 * @returns Query result with block data
 */
export function useBlock(blockId: BlockId) {
  const services = useSafeServices();

  const queryFn = useCallback(async (): Promise<Block | null> => {
    if (!services?.blockService) {
      return null;
    }
    return services.blockService.getById(blockId);
  }, [blockId, services]);

  return useCozoQuery(['block', blockId], queryFn, { enabled: !!blockId && !!services });
}

/**
 * Hook to fetch children of a block.
 * Returns blocks ordered by their 'order' field.
 *
 * @param blockId - The parent block ID
 * @param pageId - The page ID (required to construct parent key)
 * @returns Query result with array of child blocks
 */
export function useBlockChildren(blockId: BlockId, pageId: PageId | undefined) {
  const services = useSafeServices();

  const queryFn = useCallback(async (): Promise<Block[]> => {
    if (!services?.blockService || !pageId) {
      return [];
    }
    return services.blockService.getChildren(blockId, pageId);
  }, [blockId, pageId, services]);

  return useCozoQuery(['blocks', 'children', blockId], queryFn, { enabled: !!blockId && !!pageId && !!services });
}

// ============================================================================
// Subcomponents (placeholders for separate Linear issues)
// ============================================================================

/**
 * BulletHandle - The collapse/expand bullet indicator
 *
 * Displays a bullet point that can be clicked to collapse/expand children.
 * Shows different visual states based on whether children exist and
 * whether the node is collapsed.
 */
export function BulletHandle({ isCollapsed, hasChildren, onToggleCollapse }: BulletHandleProps) {
  const handleClick = useCallback(() => {
    onToggleCollapse?.();
  }, [onToggleCollapse]);

  return (
    <button
      type="button"
      className="bullet-handle"
      onClick={handleClick}
      aria-label={hasChildren ? (isCollapsed ? 'Expand' : 'Collapse') : 'Bullet'}
      aria-expanded={hasChildren ? !isCollapsed : undefined}
      data-has-children={hasChildren}
      data-collapsed={isCollapsed}
    >
      <span className="bullet-icon">{hasChildren ? (isCollapsed ? '>' : 'v') : '-'}</span>
    </button>
  );
}

// BlockEditor is now imported from '../editor/BlockEditor.js'
// The stub has been replaced with the real ProseMirror implementation

// ============================================================================
// Content Parsing Helpers
// ============================================================================

/**
 * Parse content into segments for rendering.
 * Handles page links, block refs, tags, and inline formatting.
 *
 * @param content - Raw block content string
 * @returns Array of segments with type and position info
 */
function parseContentToSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const parsed = parseContent(content);

  // Collect all special segments (links, refs, tags)
  const specialSegments: ContentSegment[] = [];

  // Add page links
  for (const link of parsed.pageLinks) {
    specialSegments.push({
      type: 'page-link',
      content: link.title,
      start: link.startIndex,
      end: link.endIndex,
    });
  }

  // Add block references
  for (const ref of parsed.blockRefs) {
    specialSegments.push({
      type: 'block-ref',
      content: ref.blockId,
      start: ref.startIndex,
      end: ref.endIndex,
    });
  }

  // Add tags - need to find positions in content
  const tagPattern = /#(?:\[\[([^\]]+)\]\]|([\w][\w-]*))/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagPattern.exec(content)) !== null) {
    const tagContent = tagMatch[1] || tagMatch[2];
    if (tagContent) {
      specialSegments.push({
        type: 'tag',
        content: tagContent,
        start: tagMatch.index,
        end: tagMatch.index + tagMatch[0].length,
      });
    }
  }

  // Sort special segments by start position
  specialSegments.sort((a, b) => a.start - b.start);

  // Process content, splitting around special segments
  let currentIndex = 0;

  for (const special of specialSegments) {
    // Add text before this special segment (with inline formatting)
    if (special.start > currentIndex) {
      const textBefore = content.slice(currentIndex, special.start);
      segments.push(...parseInlineFormatting(textBefore, currentIndex));
    }

    // Add the special segment
    segments.push(special);
    currentIndex = special.end;
  }

  // Add remaining text after last special segment
  if (currentIndex < content.length) {
    const textAfter = content.slice(currentIndex);
    segments.push(...parseInlineFormatting(textAfter, currentIndex));
  }

  // If no segments were added, return the whole content as text
  if (segments.length === 0 && content.length > 0) {
    segments.push(...parseInlineFormatting(content, 0));
  }

  return segments;
}

/**
 * Parse inline formatting in a text segment.
 * Handles bold, italic, code, highlight, and strikethrough.
 *
 * @param text - Text to parse for inline formatting
 * @param offset - Offset in original content for position tracking
 * @returns Array of segments
 */
function parseInlineFormatting(text: string, offset: number): ContentSegment[] {
  const segments: ContentSegment[] = [];

  // Find all inline formatting matches
  interface FormattingMatch {
    type: ContentSegment['type'];
    content: string;
    start: number;
    end: number;
  }

  const matches: FormattingMatch[] = [];

  // Bold: **text**
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    if (match[1]) {
      matches.push({
        type: 'bold',
        content: match[1],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Italic: *text* or _text_ (single asterisks, not part of bold)
  const italicRegex = /(?<!\*)\*(?!\*)([^*\n]+?)\*(?!\*)|(?<!_)_([^_\n]+?)_(?!_)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    const italicContent = match[1] || match[2];
    if (italicContent) {
      matches.push({
        type: 'italic',
        content: italicContent,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Code: `text`
  const codeRegex = /`([^`]+)`/g;
  while ((match = codeRegex.exec(text)) !== null) {
    if (match[1]) {
      matches.push({
        type: 'code',
        content: match[1],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Highlight: ^^text^^
  const highlightRegex = /\^\^([^^]+)\^\^/g;
  while ((match = highlightRegex.exec(text)) !== null) {
    if (match[1]) {
      matches.push({
        type: 'highlight',
        content: match[1],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Strikethrough: ~~text~~
  const strikethroughRegex = /~~([^~]+)~~/g;
  while ((match = strikethroughRegex.exec(text)) !== null) {
    if (match[1]) {
      matches.push({
        type: 'strikethrough',
        content: match[1],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Filter out overlapping matches (keep first one)
  const filteredMatches: FormattingMatch[] = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filteredMatches.push(m);
      lastEnd = m.end;
    }
  }

  // Build segments from matches
  let currentIndex = 0;

  for (const m of filteredMatches) {
    // Add plain text before this match
    if (m.start > currentIndex) {
      const plainText = text.slice(currentIndex, m.start);
      if (plainText) {
        segments.push({
          type: 'text',
          content: plainText,
          start: offset + currentIndex,
          end: offset + m.start,
        });
      }
    }

    // Add the formatted segment
    segments.push({
      type: m.type,
      content: m.content,
      start: offset + m.start,
      end: offset + m.end,
    });

    currentIndex = m.end;
  }

  // Add remaining plain text
  if (currentIndex < text.length) {
    const remaining = text.slice(currentIndex);
    if (remaining) {
      segments.push({
        type: 'text',
        content: remaining,
        start: offset + currentIndex,
        end: offset + text.length,
      });
    }
  }

  // If no matches, return whole text as single segment
  if (segments.length === 0 && text) {
    segments.push({
      type: 'text',
      content: text,
      start: offset,
      end: offset + text.length,
    });
  }

  return segments;
}

/**
 * Check if a todo block is checked.
 * Supports formats: [x], [X], [done], [DONE]
 */
function isTodoChecked(content: string): boolean {
  const todoPattern = /^\s*\[([xX]|done|DONE)\]/;
  return todoPattern.test(content);
}

/**
 * Remove todo checkbox syntax from content.
 * Removes: [ ], [x], [X], [done], [DONE]
 */
function removeTodoSyntax(content: string): string {
  return content.replace(/^\s*\[[ xXdone]*\]\s*/, '');
}

/**
 * Props for inline reference segment rendering
 */
interface InlineSegmentRenderProps {
  segment: ContentSegment;
  index: number;
  onPageLinkClick?: (pageId: PageId) => void;
  onBlockRefClick?: (blockId: BlockId) => void;
  onPageLinkHover?: (pageId: PageId | null) => void;
  onBlockRefHover?: (blockId: BlockId | null) => void;
}

/**
 * Resolved page link data for rendering
 */
interface ResolvedPageLink {
  title: string;
  pageId: PageId | null;
  exists: boolean;
}

/**
 * Resolved block ref data for rendering
 */
interface ResolvedBlockRef {
  blockId: BlockId;
  content: string | null;
  exists: boolean;
}

/**
 * Hook to safely access services (returns null if not in provider)
 */
function useSafeServices() {
  try {
    return useServices();
  } catch {
    return null;
  }
}

/**
 * Hook to resolve page title to pageId
 */
function useResolvedPageLink(title: string): ResolvedPageLink {
  const services = useSafeServices();
  const [resolved, setResolved] = useState<ResolvedPageLink>({
    title,
    pageId: null,
    exists: false,
  });

  useEffect(() => {
    if (!services?.pageService) {
      // No service available - leave as unresolved
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        const page = await services!.pageService.getByTitle(title);
        if (!cancelled) {
          setResolved({
            title,
            pageId: page?.pageId ?? null,
            exists: !!page,
          });
        }
      } catch {
        if (!cancelled) {
          setResolved({ title, pageId: null, exists: false });
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [title, services]);

  return resolved;
}

/**
 * Hook to resolve block ref to its content
 */
function useResolvedBlockRef(blockId: BlockId): ResolvedBlockRef {
  const services = useSafeServices();
  const [resolved, setResolved] = useState<ResolvedBlockRef>({
    blockId,
    content: null,
    exists: false,
  });

  useEffect(() => {
    if (!services?.blockService) {
      // No service available - leave as unresolved
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        const block = await services!.blockService.getById(blockId);
        if (!cancelled) {
          setResolved({
            blockId,
            content: block?.content ?? null,
            exists: !!block && !block.isDeleted,
          });
        }
      } catch {
        if (!cancelled) {
          setResolved({ blockId, content: null, exists: false });
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [blockId, services]);

  return resolved;
}

/**
 * Component for rendering a page link segment with resolved data
 */
const PageLinkSegment = memo(function PageLinkSegment({
  title,
  onClick,
  onHover,
}: {
  title: string;
  onClick?: (pageId: PageId) => void;
  onHover?: (pageId: PageId | null) => void;
}) {
  const resolved = useResolvedPageLink(title);

  const handleClick = useCallback(
    (pageId: PageId) => {
      onClick?.(pageId);
    },
    [onClick]
  );

  const handleHover = useCallback(
    (pageId: PageId | null) => {
      onHover?.(pageId);
    },
    [onHover]
  );

  // If page exists and we have a pageId, render the interactive component
  if (resolved.pageId) {
    return (
      <InlinePageLink
        pageId={resolved.pageId}
        title={title}
        exists={resolved.exists}
        onClick={handleClick}
        onHover={onHover ? handleHover : undefined}
      />
    );
  }

  // Fallback for unresolved page (show as non-interactive for now)
  return (
    <InlinePageLink
      pageId={title as PageId} // Use title as fallback ID
      title={title}
      exists={false}
      onClick={handleClick}
      onHover={onHover ? handleHover : undefined}
    />
  );
});

/**
 * Component for rendering a block ref segment with resolved data
 */
const BlockRefSegment = memo(function BlockRefSegment({
  blockId,
  onClick,
  onHover,
}: {
  blockId: BlockId;
  onClick?: (blockId: BlockId) => void;
  onHover?: (blockId: BlockId | null) => void;
}) {
  const resolved = useResolvedBlockRef(blockId);

  const handleClick = useCallback(
    (id: BlockId) => {
      onClick?.(id);
    },
    [onClick]
  );

  const handleHover = useCallback(
    (id: BlockId | null) => {
      onHover?.(id);
    },
    [onHover]
  );

  // Truncate long content for display
  const displayContent = resolved.content
    ? resolved.content.length > 100
      ? `${resolved.content.slice(0, 100)}...`
      : resolved.content
    : undefined;

  return (
    <InlineBlockRef
      blockId={blockId}
      content={displayContent}
      exists={resolved.exists}
      onClick={handleClick}
      onHover={onHover ? handleHover : undefined}
    />
  );
});

/**
 * Render a single content segment with appropriate styling.
 * For page-link and block-ref types, uses interactive components.
 */
function RenderSegment({
  segment,
  index,
  onPageLinkClick,
  onBlockRefClick,
  onPageLinkHover,
  onBlockRefHover,
}: InlineSegmentRenderProps): React.ReactNode {
  const key = `${segment.type}-${segment.start}-${index}`;
  const CSS = STATIC_BLOCK_CONTENT_CSS_CLASSES;

  switch (segment.type) {
    case 'text':
      return <span key={key}>{segment.content}</span>;

    case 'bold':
      return (
        <strong key={key} className={CSS.bold}>
          {segment.content}
        </strong>
      );

    case 'italic':
      return (
        <em key={key} className={CSS.italic}>
          {segment.content}
        </em>
      );

    case 'code':
      return (
        <code key={key} className={CSS.code}>
          {segment.content}
        </code>
      );

    case 'highlight':
      return (
        <mark key={key} className={CSS.highlight}>
          {segment.content}
        </mark>
      );

    case 'strikethrough':
      return (
        <del key={key} className={CSS.strikethrough}>
          {segment.content}
        </del>
      );

    case 'page-link':
      return (
        <PageLinkSegment
          key={key}
          title={segment.content}
          onClick={onPageLinkClick}
          onHover={onPageLinkHover}
        />
      );

    case 'block-ref':
      return (
        <BlockRefSegment
          key={key}
          blockId={segment.content as BlockId}
          onClick={onBlockRefClick}
          onHover={onBlockRefHover}
        />
      );

    case 'tag':
      return (
        <span key={key} className={CSS.tag} data-tag={segment.content}>
          #{segment.content}
        </span>
      );

    default:
      return <span key={key}>{segment.content}</span>;
  }
}

// ============================================================================
// StaticBlockContent Component
// ============================================================================

/**
 * StaticBlockContent - Read-only block content display
 *
 * Rendered when a block is not focused. Displays formatted content
 * with inline formatting, [[page links]], ((block refs)), #tags, and
 * todo checkbox rendering.
 *
 * Features:
 * - Inline formatting: **bold**, *italic*, `code`, ^^highlight^^, ~~strikethrough~~
 * - Interactive [[page links]] that navigate to linked pages
 * - Interactive ((block refs)) that navigate to referenced blocks
 * - Checkbox visual for todo blocks
 * - Accessible click and keyboard handling
 * - Graceful handling of missing/deleted targets
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 */
export const StaticBlockContent = memo(function StaticBlockContent({
  content,
  contentType = 'text',
  onClick,
  onPageLinkClick,
  onBlockRefClick,
  onPageLinkHover,
  onBlockRefHover,
}: StaticBlockContentProps) {
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
    },
    [onClick]
  );

  const isTodo = contentType === 'todo';
  const isChecked = isTodo && isTodoChecked(content);
  const displayContent = isTodo ? removeTodoSyntax(content) : content;
  const segments = useMemo(() => parseContentToSegments(displayContent), [displayContent]);

  const CSS = STATIC_BLOCK_CONTENT_CSS_CLASSES;
  const containerClasses = [CSS.container, isTodo && CSS.todo].filter(Boolean).join(' ');

  return (
    <div
      className={containerClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      data-testid="static-block-content"
      aria-label={isTodo ? `Todo: ${displayContent}` : displayContent}
    >
      {isTodo && (
        <span
          className={`${CSS.checkbox} ${isChecked ? CSS.checkboxChecked : ''}`}
          aria-hidden="true"
        >
          {isChecked ? '\u2611' : '\u2610'}
        </span>
      )}
      <span className={CSS.text}>
        {segments.map((segment, index) => (
          <RenderSegment
            key={`${segment.type}-${segment.start}-${index}`}
            segment={segment}
            index={index}
            onPageLinkClick={onPageLinkClick}
            onBlockRefClick={onBlockRefClick}
            onPageLinkHover={onPageLinkHover}
            onBlockRefHover={onBlockRefHover}
          />
        ))}
      </span>
    </div>
  );
});

// ============================================================================
// BlockNode Component
// ============================================================================

/**
 * BlockNode - A single block in the outliner tree
 *
 * Memoized component that renders a block with:
 * - BulletHandle for collapse/expand
 * - BlockEditor (when focused) or StaticBlockContent (when not focused)
 * - Recursive children (when not collapsed)
 *
 * Performance optimizations:
 * - React.memo prevents re-renders unless props change
 * - contentVisibility: 'auto' enables browser viewport-based rendering
 * - containIntrinsicSize hints at minimum size for scroll calculations
 *
 * @example
 * ```tsx
 * <BlockNode blockId="01HQXYZ..." depth={0} />
 * ```
 */
function BlockNodeComponent({ blockId, depth = 0 }: BlockNodeProps) {
  const services = useSafeServices();
  const { data: block, isLoading: blockLoading, error: blockError } = useBlock(blockId);
  const { data: children, isLoading: childrenLoading } = useBlockChildren(blockId, block?.pageId);

  // Get focused block and navigation from UI store
  const focusedBlockId = useAppStore((s) => s.focusedBlockId);
  const setFocusedBlock = useAppStore((s) => s.setFocusedBlock);
  const navigateToPage = useAppStore((s) => s.navigateToPage);

  const isEditing = focusedBlockId === blockId;
  const hasChildren = (children?.length ?? 0) > 0;

  // Callback to focus a specific block (for editor integration)
  const focusBlock = useCallback(
    (targetBlockId: BlockId, _position?: 'start' | 'end') => {
      setFocusedBlock(targetBlockId);
      // Position handling would be done by the editor itself
    },
    [setFocusedBlock]
  );

  // Callback when blocks change (for query invalidation)
  const handleBlocksChanged = useCallback(() => {
    invalidateQueries(['blocks']);
    invalidateQueries(['block']);
  }, []);

  // Handle activating this block for editing
  const handleActivate = useCallback(() => {
    setFocusedBlock(blockId);
  }, [blockId, setFocusedBlock]);

  // Handle collapse toggle (would dispatch to store/mutation)
  const handleToggleCollapse = useCallback(() => {
    // TODO: Implement collapse toggle mutation
    // For now, this is a placeholder
  }, []);

  // Handle page link click - navigate to the linked page
  const handlePageLinkClick = useCallback(
    (pageId: PageId) => {
      navigateToPage('page/' + pageId);
    },
    [navigateToPage]
  );

  // Handle block ref click - navigate to the page containing the block
  // and potentially focus on the specific block
  const handleBlockRefClick = useCallback(
    (refBlockId: BlockId) => {
      // For now, we'll need to resolve the block's page first
      // This is handled by focusing on the block which will trigger
      // navigation if needed. For a full implementation, we'd need
      // to fetch the block's pageId and navigate there.
      setFocusedBlock(refBlockId);
    },
    [setFocusedBlock]
  );

  // Loading state - also show loading if block exists but content is not yet populated
  if (blockLoading || childrenLoading || (block && block.content === undefined)) {
    return (
      <li
        className="block-container block-loading"
        role="treeitem"
        aria-busy="true"
        data-testid="block-node-loading"
      >
        <div className="block-skeleton" />
      </li>
    );
  }

  // Error state
  if (blockError || !block) {
    return (
      <li className="block-container block-error" role="treeitem" data-testid="block-node-error">
        <div className="block-error-content">Failed to load block</div>
      </li>
    );
  }

  // Calculate indentation based on depth
  const indentStyle = {
    paddingLeft: `${depth * 24}px`,
    contentVisibility: 'auto' as const,
    containIntrinsicSize: 'auto 32px',
  };

  return (
    <li
      className="block-container"
      role="treeitem"
      aria-expanded={hasChildren ? !block.isCollapsed : undefined}
      aria-level={depth + 1}
      data-block-id={blockId}
      data-testid="block-node"
      style={indentStyle}
    >
      <div className="block-row">
        <BulletHandle
          isCollapsed={block.isCollapsed}
          hasChildren={hasChildren}
          onToggleCollapse={handleToggleCollapse}
        />
        <div className="block-content">
          {isEditing ? (
            <RealBlockEditor
              blockId={blockId}
              initialContent={block.content}
              blockService={services?.blockService}
              pageId={block.pageId}
              previousBlockId={null} // TODO: Calculate from siblings
              focusBlock={focusBlock}
              onBlocksChanged={handleBlocksChanged}
              autoFocus
            />
          ) : (
            <StaticBlockContent
              content={block.content}
              contentType={block.contentType}
              onClick={handleActivate}
              onPageLinkClick={handlePageLinkClick}
              onBlockRefClick={handleBlockRefClick}
            />
          )}
        </div>
      </div>

      {/* Render children recursively if not collapsed */}
      {!block.isCollapsed && hasChildren && children && (
        <ul className="block-children" role="group" data-testid="block-children">
          {children.map((child) => (
            <BlockNode key={child.blockId} blockId={child.blockId} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Memoized BlockNode component
 *
 * Only re-renders when:
 * - blockId changes
 * - depth changes
 *
 * Internal state changes (focus, collapse) are handled via Zustand
 * subscriptions which trigger re-renders only for affected nodes.
 */
export const BlockNode = memo(BlockNodeComponent);
BlockNode.displayName = 'BlockNode';
