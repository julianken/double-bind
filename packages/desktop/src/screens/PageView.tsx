/**
 * PageView - Main content view that displays a page's title and block tree.
 *
 * This is the primary screen for viewing and editing page content.
 * It fetches page metadata and blocks, organizes blocks into a tree
 * structure, and renders them recursively.
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 * @see docs/packages/desktop.md for screen routing
 */

import { useCallback, useMemo } from 'react';
import type { Block, BlockId, PageId } from '@double-bind/types';
import type { PageWithBlocks } from '@double-bind/core';
import { useCozoQuery } from '../hooks/useCozoQuery.js';
import { useServices } from '../providers/ServiceProvider.js';

// ============================================================================
// Types
// ============================================================================

export interface PageViewProps {
  /**
   * The ID of the page to display.
   * Received from the Zustand-based router.
   */
  pageId: PageId;
}

/**
 * Internal tree node representation for organizing blocks hierarchically.
 */
interface BlockTreeNode {
  block: Block;
  children: BlockTreeNode[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Organize flat blocks array into a tree structure based on parent_id.
 *
 * @param blocks - Flat array of blocks for a page
 * @returns Array of root-level BlockTreeNodes with nested children
 */
function buildBlockTree(blocks: Block[]): BlockTreeNode[] {
  // Create a map for quick lookup by blockId
  const blockMap = new Map<BlockId, BlockTreeNode>();

  // Initialize tree nodes for each block
  for (const block of blocks) {
    blockMap.set(block.blockId, { block, children: [] });
  }

  // Build the tree by linking children to parents
  const rootNodes: BlockTreeNode[] = [];

  for (const block of blocks) {
    const node = blockMap.get(block.blockId);
    if (!node) continue;

    if (block.parentId === null) {
      // Root-level block
      rootNodes.push(node);
    } else {
      // Child block - add to parent's children
      const parentNode = blockMap.get(block.parentId);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Orphan block (parent not found) - treat as root
        rootNodes.push(node);
      }
    }
  }

  // Sort children by order key at each level
  const sortByOrder = (nodes: BlockTreeNode[]) => {
    nodes.sort((a, b) => a.block.order.localeCompare(b.block.order));
    for (const node of nodes) {
      sortByOrder(node.children);
    }
  };
  sortByOrder(rootNodes);

  return rootNodes;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * PageTitle - Renders the page title header.
 *
 * This is a stub component that will be enhanced in future tickets
 * to support inline editing.
 */
interface PageTitleProps {
  title: string;
}

export function PageTitle({ title }: PageTitleProps) {
  return (
    <h1 className="page-title" data-testid="page-title">
      {title}
    </h1>
  );
}

/**
 * BlockNode - Recursively renders a block and its children.
 *
 * This is a stub component that renders block content as plain text.
 * It will be enhanced in future tickets to support ProseMirror editing.
 */
interface BlockNodeProps {
  node: BlockTreeNode;
  depth?: number;
}

export function BlockNode({ node, depth = 0 }: BlockNodeProps) {
  const { block, children } = node;
  const hasChildren = children.length > 0;

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? !block.isCollapsed : undefined}
      data-testid={`block-${block.blockId}`}
      data-block-id={block.blockId}
      data-depth={depth}
      className="block-node"
    >
      <div className="block-content">
        <span className="block-bullet" aria-hidden="true">
          {hasChildren ? (block.isCollapsed ? '\u25B6' : '\u25BC') : '\u2022'}
        </span>
        <span className="block-text" data-testid={`block-content-${block.blockId}`}>
          {block.content}
        </span>
      </div>
      {hasChildren && !block.isCollapsed && (
        <ul role="group" className="block-children">
          {children.map((child) => (
            <BlockNode key={child.block.blockId} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * LoadingState - Shown while page data is being fetched.
 */
function LoadingState() {
  return (
    <div className="page-view-loading" data-testid="page-view-loading" role="status">
      <p>Loading page...</p>
    </div>
  );
}

/**
 * ErrorState - Shown when page fetch fails.
 * The ErrorBoundary at the content level catches thrown errors,
 * but this component handles expected errors from the query result.
 */
interface ErrorStateProps {
  error: Error;
}

function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="page-view-error" data-testid="page-view-error" role="alert">
      <h2>Failed to load page</h2>
      <p>{error.message}</p>
    </div>
  );
}

/**
 * EmptyState - Shown when page has no blocks.
 */
function EmptyState() {
  return (
    <div className="page-view-empty" data-testid="page-view-empty">
      <p>This page has no content yet. Start typing to add a block.</p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * PageView - Displays a page's title and recursive block tree.
 *
 * This component:
 * 1. Receives pageId from the Zustand-based router
 * 2. Fetches page metadata and blocks using useCozoQuery hooks
 * 3. Organizes blocks into a tree structure by parent_id
 * 4. Renders PageTitle and BlockNode components
 * 5. Handles loading and error states
 *
 * Error handling:
 * - Query errors are displayed inline via ErrorState
 * - Render errors are caught by the Content ErrorBoundary (parent)
 *
 * @example
 * ```tsx
 * // In Router component
 * <PageView pageId="page-abc-123" />
 * ```
 */
export function PageView({ pageId }: PageViewProps) {
  const { pageService } = useServices();

  // Query function - must be stable (wrapped in useCallback)
  const queryFn = useCallback(() => pageService.getPageWithBlocks(pageId), [pageService, pageId]);

  // Fetch page and blocks together
  const { data, isLoading, error } = useCozoQuery<PageWithBlocks>(
    ['page', 'withBlocks', pageId],
    queryFn,
    { enabled: !!pageId }
  );

  // Build block tree from flat array
  const blockTree = useMemo(() => {
    if (!data?.blocks) return [];
    return buildBlockTree(data.blocks);
  }, [data?.blocks]);

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} />;
  }

  // No data (shouldn't happen if enabled is correct, but handle defensively)
  if (!data) {
    return <ErrorState error={new Error('Page not found')} />;
  }

  const { page, blocks } = data;

  return (
    <div className="page-view" data-testid="page-view" data-page-id={pageId}>
      <PageTitle title={page.title} />

      {blocks.length === 0 ? (
        <EmptyState />
      ) : (
        <ul role="tree" className="block-tree" data-testid="block-tree">
          {blockTree.map((node) => (
            <BlockNode key={node.block.blockId} node={node} />
          ))}
        </ul>
      )}
    </div>
  );
}
