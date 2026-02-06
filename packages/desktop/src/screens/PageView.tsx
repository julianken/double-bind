/**
 * PageView - Main content view that displays a page's title and block tree.
 *
 * This is the primary screen for viewing and editing page content.
 * It fetches page metadata and blocks, organizes blocks into a tree
 * structure, and renders them recursively.
 *
 * Features:
 * - Page title display
 * - Recursive block tree rendering
 * - Collapsible BacklinksPanel (toggle with Ctrl+B / Cmd+B)
 * - Loading, error, and empty states
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 * @see docs/packages/desktop.md for screen routing
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import type { Block, BlockId, PageId } from '@double-bind/types';
import type { PageWithBlocks } from '@double-bind/core';
import { BacklinksPanel } from '@double-bind/ui-primitives';
import { useCozoQuery } from '../hooks/useCozoQuery.js';
import { useBacklinks } from '../hooks/useBacklinks.js';
import { useServices } from '../providers/ServiceProvider.js';
import { useAppStore } from '../stores/ui-store.js';

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

/**
 * Check if the current platform uses Cmd key (macOS) or Ctrl key (Windows/Linux)
 */
function isMacOS(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
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

/**
 * BacklinksSectionHeader - Collapsible header for the backlinks section.
 */
interface BacklinksSectionHeaderProps {
  isExpanded: boolean;
  onToggle: () => void;
  isLoading: boolean;
  count: number;
}

function BacklinksSectionHeader({
  isExpanded,
  onToggle,
  isLoading,
  count,
}: BacklinksSectionHeaderProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <button
      type="button"
      className="backlinks-section-header"
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      aria-expanded={isExpanded}
      data-testid="backlinks-section-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        width: '100%',
        border: 'none',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '14px',
        fontWeight: 600,
        color: 'inherit',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: '5px 0 5px 7px',
          borderColor: 'transparent transparent transparent currentColor',
          opacity: 0.6,
          transition: 'transform 0.15s ease',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
        aria-hidden="true"
      />
      <span>Backlinks</span>
      {isLoading ? (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '12px',
            opacity: 0.6,
          }}
        >
          Loading...
        </span>
      ) : (
        <span
          style={{
            marginLeft: 'auto',
            padding: '2px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 500,
            opacity: 0.7,
          }}
          data-testid="backlinks-count"
        >
          {count}
        </span>
      )}
    </button>
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
 * 5. Displays a collapsible BacklinksPanel at the bottom
 * 6. Handles loading and error states
 *
 * Keyboard shortcuts:
 * - Ctrl+B / Cmd+B: Toggle backlinks panel visibility
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
  const navigateToPage = useAppStore((state) => state.navigateToPage);

  // Backlinks panel expanded state (persisted in component state)
  const [backlinksExpanded, setBacklinksExpanded] = useState(true);

  // Query function - must be stable (wrapped in useCallback)
  const queryFn = useCallback(() => pageService.getPageWithBlocks(pageId), [pageService, pageId]);

  // Fetch page and blocks together
  const { data, isLoading, error } = useCozoQuery<PageWithBlocks>(
    ['page', 'withBlocks', pageId],
    queryFn,
    { enabled: !!pageId }
  );

  // Fetch backlinks for the page
  const { linkedRefs, unlinkedRefs, isLoading: backlinksLoading } = useBacklinks(pageId);

  // Build block tree from flat array
  const blockTree = useMemo(() => {
    if (!data?.blocks) return [];
    return buildBlockTree(data.blocks);
  }, [data?.blocks]);

  // Toggle backlinks panel
  const toggleBacklinks = useCallback(() => {
    setBacklinksExpanded((prev) => !prev);
  }, []);

  // Navigate to a page (and optionally scroll to a block)
  const handleNavigate = useCallback(
    (targetPageId: PageId, _targetBlockId?: BlockId) => {
      // Router expects path like "page/{id}", so prefix the raw page ID
      navigateToPage(`page/${targetPageId}`);
      // Note: Block scrolling would be handled by the target PageView
      // once we implement block-level navigation/focus
      // TODO: Implement block-level focus (DBB-XXX)
    },
    [navigateToPage]
  );

  // Keyboard shortcut: Ctrl+B / Cmd+B to toggle backlinks
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+B (Windows/Linux) or Cmd+B (macOS)
      const isModifierPressed = isMacOS() ? event.metaKey : event.ctrlKey;

      if (isModifierPressed && event.key.toLowerCase() === 'b') {
        // Don't trigger if user is typing in an input
        const target = event.target as HTMLElement;
        const isContentEditable =
          target.isContentEditable === true || target.getAttribute?.('contenteditable') === 'true';
        const isInputElement =
          target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || isContentEditable;

        if (!isInputElement) {
          event.preventDefault();
          toggleBacklinks();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleBacklinks]);

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
    <div
      className="page-view"
      data-testid="page-view"
      data-page-id={pageId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Page content area */}
      <div
        className="page-view-content"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
        }}
      >
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

      {/* Backlinks section - collapsible bottom panel */}
      <div
        className="backlinks-section"
        data-testid="backlinks-section"
        style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        }}
      >
        <BacklinksSectionHeader
          isExpanded={backlinksExpanded}
          onToggle={toggleBacklinks}
          isLoading={backlinksLoading}
          count={linkedRefs.length}
        />

        {backlinksExpanded && (
          <div
            className="backlinks-content"
            data-testid="backlinks-content"
            style={{
              maxHeight: '300px',
              overflow: 'auto',
              padding: '0 16px 16px',
            }}
          >
            <BacklinksPanel
              pageId={pageId}
              linkedRefs={linkedRefs}
              unlinkedRefs={unlinkedRefs}
              onNavigate={handleNavigate}
              defaultLinkedExpanded={true}
              defaultUnlinkedExpanded={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
