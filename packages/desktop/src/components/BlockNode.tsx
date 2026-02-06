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

import { memo, useCallback } from 'react';
import type { Block, BlockId } from '@double-bind/types';
import { useCozoQuery } from '../hooks/useCozoQuery.js';
import { useAppStore } from '../stores/ui-store.js';

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

export interface BlockEditorProps {
  /**
   * The block ID being edited
   */
  blockId: BlockId;

  /**
   * Initial content to display in the editor
   */
  initialContent: string;
}

export interface StaticBlockContentProps {
  /**
   * The content to render (may contain markdown, links, etc.)
   */
  content: string;

  /**
   * Callback when the content area is clicked (to activate editing)
   */
  onClick?: () => void;
}

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
  const queryFn = useCallback(async (): Promise<Block | null> => {
    // TODO: Replace with real blockService.getById(blockId)
    // This is a placeholder that returns mock data for testing
    return {
      blockId,
      pageId: 'mock-page-id',
      parentId: null,
      content: 'Mock block content',
      contentType: 'text' as const,
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }, [blockId]);

  return useCozoQuery(['block', blockId], queryFn, { enabled: !!blockId });
}

/**
 * Hook to fetch children of a block.
 * Returns blocks ordered by their 'order' field.
 *
 * @param blockId - The parent block ID
 * @returns Query result with array of child blocks
 */
export function useBlockChildren(blockId: BlockId) {
  const queryFn = useCallback(async (): Promise<Block[]> => {
    // TODO: Replace with real blockService.getChildren(blockId)
    // This is a placeholder that returns empty array for testing
    return [];
  }, [blockId]);

  return useCozoQuery(['blocks', 'children', blockId], queryFn, { enabled: !!blockId });
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

/**
 * BlockEditor - ProseMirror-based rich text editor
 *
 * Rendered when a block is focused for editing.
 * Handles keyboard navigation, markdown shortcuts, etc.
 */
export function BlockEditor({ blockId, initialContent }: BlockEditorProps) {
  // TODO: Implement with ProseMirror (separate Linear issue)
  return (
    <div className="block-editor" data-block-id={blockId} data-testid="block-editor">
      <textarea defaultValue={initialContent} aria-label="Block editor" />
    </div>
  );
}

/**
 * StaticBlockContent - Read-only block content display
 *
 * Rendered when a block is not focused. Displays formatted content
 * with markdown rendering, [[links]], etc.
 */
export function StaticBlockContent({ content, onClick }: StaticBlockContentProps) {
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

  return (
    <div
      className="static-block-content"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      data-testid="static-block-content"
    >
      {content}
    </div>
  );
}

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
  const { data: block, isLoading: blockLoading, error: blockError } = useBlock(blockId);
  const { data: children, isLoading: childrenLoading } = useBlockChildren(blockId);

  // Get focused block from UI store
  const focusedBlockId = useAppStore((s) => s.focusedBlockId);
  const setFocusedBlock = useAppStore((s) => s.setFocusedBlock);

  const isEditing = focusedBlockId === blockId;
  const hasChildren = (children?.length ?? 0) > 0;

  // Handle activating this block for editing
  const handleActivate = useCallback(() => {
    setFocusedBlock(blockId);
  }, [blockId, setFocusedBlock]);

  // Handle collapse toggle (would dispatch to store/mutation)
  const handleToggleCollapse = useCallback(() => {
    // TODO: Implement collapse toggle mutation
    // For now, this is a placeholder
  }, []);

  // Loading state
  if (blockLoading || childrenLoading) {
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
            <BlockEditor blockId={blockId} initialContent={block.content} />
          ) : (
            <StaticBlockContent content={block.content} onClick={handleActivate} />
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
