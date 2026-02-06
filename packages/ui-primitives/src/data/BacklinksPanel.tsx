/**
 * BacklinksPanel - Display linked and unlinked references to a block or page
 *
 * Shows a collapsible panel with two sections:
 * - Linked References: Explicit backlinks from other blocks/pages
 * - Unlinked References: Mentions of the page title without explicit linking
 *
 * References are grouped by source page for easier navigation.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/accordion/
 */

import {
  type CSSProperties,
  type KeyboardEvent,
  forwardRef,
  memo,
  useState,
  useCallback,
} from 'react';
import type { BlockId, PageId, Block, Page } from '@double-bind/types';

export interface LinkedRef {
  /** The block containing the backlink */
  block: Block;
  /** The page containing the block */
  page: Page;
}

export interface UnlinkedRef {
  /** The content excerpt containing the unlinked mention */
  content: string;
  /** The page containing the unlinked mention */
  page: Page;
}

export interface BacklinksPanelProps {
  /** Block ID being referenced (optional) */
  blockId?: BlockId;
  /** Page ID being referenced (optional) */
  pageId?: PageId;
  /** Array of linked references (explicit backlinks) */
  linkedRefs: LinkedRef[];
  /** Array of unlinked references (mentions without links) */
  unlinkedRefs?: UnlinkedRef[];
  /** Callback when user navigates to a reference */
  onNavigate: (pageId: PageId, blockId?: BlockId) => void;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Initial expanded state for linked refs section */
  defaultLinkedExpanded?: boolean;
  /** Initial expanded state for unlinked refs section */
  defaultUnlinkedExpanded?: boolean;
}

// Inline styles for the component (no external CSS dependencies)
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    color: 'inherit',
  } satisfies CSSProperties,

  section: {
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '6px',
    overflow: 'hidden',
  } satisfies CSSProperties,

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    userSelect: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 600,
    color: 'inherit',
    transition: 'background-color 0.15s ease',
  } satisfies CSSProperties,

  sectionHeaderHover: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  } satisfies CSSProperties,

  chevron: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderWidth: '4px 0 4px 6px',
    borderColor: 'transparent transparent transparent currentColor',
    opacity: 0.6,
    transition: 'transform 0.15s ease',
    flexShrink: 0,
  } satisfies CSSProperties,

  chevronExpanded: {
    transform: 'rotate(90deg)',
  } satisfies CSSProperties,

  chevronCollapsed: {
    transform: 'rotate(0deg)',
  } satisfies CSSProperties,

  count: {
    marginLeft: 'auto',
    padding: '2px 8px',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'inherit',
    opacity: 0.7,
  } satisfies CSSProperties,

  content: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  } satisfies CSSProperties,

  pageGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  } satisfies CSSProperties,

  pageTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: 'inherit',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    width: 'fit-content',
    transition: 'background-color 0.15s ease',
  } satisfies CSSProperties,

  pageTitleHover: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  } satisfies CSSProperties,

  pageIcon: {
    opacity: 0.5,
  } satisfies CSSProperties,

  blockList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    marginLeft: '8px',
    paddingLeft: '12px',
    borderLeft: '2px solid rgba(0, 0, 0, 0.1)',
  } satisfies CSSProperties,

  blockItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '6px 10px',
    margin: 0,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    fontFamily: 'inherit',
    fontSize: '13px',
    color: 'inherit',
    lineHeight: 1.5,
    transition: 'background-color 0.15s ease',
  } satisfies CSSProperties,

  blockItemHover: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  } satisfies CSSProperties,

  blockItemFocused: {
    outline: '2px solid rgba(0, 100, 200, 0.5)',
    outlineOffset: '-2px',
  } satisfies CSSProperties,

  bullet: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
    opacity: 0.4,
    flexShrink: 0,
    marginTop: '7px',
  } satisfies CSSProperties,

  blockContent: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } satisfies CSSProperties,

  emptyState: {
    padding: '16px',
    textAlign: 'center',
    color: 'inherit',
    opacity: 0.5,
    fontStyle: 'italic',
  } satisfies CSSProperties,
} as const;

/**
 * Group references by their source page
 */
function groupByPage<T extends { page: Page }>(refs: T[]): Map<string, { page: Page; items: T[] }> {
  const groups = new Map<string, { page: Page; items: T[] }>();

  for (const ref of refs) {
    const existing = groups.get(ref.page.pageId);
    if (existing) {
      existing.items.push(ref);
    } else {
      groups.set(ref.page.pageId, { page: ref.page, items: [ref] });
    }
  }

  return groups;
}

interface SectionHeaderProps {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  testId: string;
}

const SectionHeader = memo(function SectionHeader({
  title,
  count,
  isExpanded,
  onToggle,
  testId,
}: SectionHeaderProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <button
      type="button"
      style={styles.sectionHeader}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      aria-expanded={isExpanded}
      data-testid={testId}
    >
      <span
        style={{
          ...styles.chevron,
          ...(isExpanded ? styles.chevronExpanded : styles.chevronCollapsed),
        }}
        aria-hidden="true"
      />
      <span>{title}</span>
      <span style={styles.count} data-testid={`${testId}-count`}>
        {count}
      </span>
    </button>
  );
});

interface BlockItemProps {
  block: Block;
  onNavigate: (pageId: PageId, blockId: BlockId) => void;
  index: number;
}

const BlockItem = memo(function BlockItem({ block, onNavigate, index }: BlockItemProps) {
  const handleClick = () => {
    onNavigate(block.pageId, block.blockId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onNavigate(block.pageId, block.blockId);
    }
  };

  return (
    <button
      type="button"
      style={styles.blockItem}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid={`block-item-${index}`}
      aria-label={`Navigate to block: ${block.content.slice(0, 50)}`}
    >
      <span style={styles.bullet} aria-hidden="true" />
      <span style={styles.blockContent}>{block.content}</span>
    </button>
  );
});

interface UnlinkedItemProps {
  content: string;
  page: Page;
  onNavigate: (pageId: PageId) => void;
  index: number;
}

const UnlinkedItem = memo(function UnlinkedItem({
  content,
  page,
  onNavigate,
  index,
}: UnlinkedItemProps) {
  const handleClick = () => {
    onNavigate(page.pageId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onNavigate(page.pageId);
    }
  };

  return (
    <button
      type="button"
      style={styles.blockItem}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid={`unlinked-item-${index}`}
      aria-label={`Navigate to page "${page.title}" containing: ${content.slice(0, 50)}`}
    >
      <span style={styles.bullet} aria-hidden="true" />
      <span style={styles.blockContent}>{content}</span>
    </button>
  );
});

interface PageGroupProps {
  page: Page;
  children: React.ReactNode;
  onNavigate: (pageId: PageId) => void;
  testId: string;
}

const PageGroup = memo(function PageGroup({ page, children, onNavigate, testId }: PageGroupProps) {
  const handleClick = () => {
    onNavigate(page.pageId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onNavigate(page.pageId);
    }
  };

  return (
    <div
      style={styles.pageGroup}
      data-testid={testId}
      role="group"
      aria-label={`Page: ${page.title}`}
    >
      <button
        type="button"
        style={styles.pageTitle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-testid={`${testId}-title`}
      >
        <span style={styles.pageIcon} aria-hidden="true">
          📄
        </span>
        <span>{page.title}</span>
      </button>
      <div style={styles.blockList} role="list">
        {children}
      </div>
    </div>
  );
});

/**
 * BacklinksPanel component for displaying linked and unlinked references.
 *
 * @example
 * ```tsx
 * // Basic usage with linked references
 * <BacklinksPanel
 *   pageId="page-123"
 *   linkedRefs={[
 *     { block: { blockId: 'b1', content: 'See [[My Page]]', ... }, page: { title: 'Notes', ... } },
 *   ]}
 *   onNavigate={(pageId, blockId) => router.push(`/page/${pageId}#${blockId}`)}
 * />
 *
 * // With unlinked references
 * <BacklinksPanel
 *   pageId="page-123"
 *   linkedRefs={linkedRefs}
 *   unlinkedRefs={[
 *     { content: 'My Page is mentioned here...', page: { title: 'Other Notes', ... } },
 *   ]}
 *   onNavigate={handleNavigate}
 * />
 * ```
 */
export const BacklinksPanel = memo(
  forwardRef<HTMLDivElement, BacklinksPanelProps>(function BacklinksPanel(
    {
      blockId,
      pageId,
      linkedRefs,
      unlinkedRefs = [],
      onNavigate,
      className,
      defaultLinkedExpanded = true,
      defaultUnlinkedExpanded = false,
    },
    ref
  ) {
    const [linkedExpanded, setLinkedExpanded] = useState(defaultLinkedExpanded);
    const [unlinkedExpanded, setUnlinkedExpanded] = useState(defaultUnlinkedExpanded);

    const toggleLinked = useCallback(() => {
      setLinkedExpanded((prev) => !prev);
    }, []);

    const toggleUnlinked = useCallback(() => {
      setUnlinkedExpanded((prev) => !prev);
    }, []);

    const handleNavigateToPage = useCallback(
      (targetPageId: PageId) => {
        onNavigate(targetPageId);
      },
      [onNavigate]
    );

    const handleNavigateToBlock = useCallback(
      (targetPageId: PageId, targetBlockId: BlockId) => {
        onNavigate(targetPageId, targetBlockId);
      },
      [onNavigate]
    );

    const linkedGroups = groupByPage(linkedRefs);
    const unlinkedGroups = groupByPage(unlinkedRefs);

    const hasLinked = linkedRefs.length > 0;
    const hasUnlinked = unlinkedRefs.length > 0;
    const isEmpty = !hasLinked && !hasUnlinked;

    let blockIndex = 0;
    let unlinkedIndex = 0;

    return (
      <div
        ref={ref}
        className={className}
        style={styles.container}
        data-testid="backlinks-panel"
        data-block-id={blockId}
        data-page-id={pageId}
        role="region"
        aria-label="Backlinks panel"
      >
        {isEmpty ? (
          <div style={styles.emptyState} data-testid="empty-state">
            No references found
          </div>
        ) : (
          <>
            {/* Linked References Section */}
            <div style={styles.section} data-testid="linked-section">
              <SectionHeader
                title="Linked References"
                count={linkedRefs.length}
                isExpanded={linkedExpanded}
                onToggle={toggleLinked}
                testId="linked-header"
              />
              {linkedExpanded && (
                <div style={styles.content} data-testid="linked-content" role="list">
                  {hasLinked ? (
                    Array.from(linkedGroups.entries()).map(([groupPageId, { page, items }]) => (
                      <PageGroup
                        key={groupPageId}
                        page={page}
                        onNavigate={handleNavigateToPage}
                        testId={`page-group-${groupPageId}`}
                      >
                        {items.map((item) => {
                          const idx = blockIndex++;
                          return (
                            <BlockItem
                              key={item.block.blockId}
                              block={item.block}
                              onNavigate={handleNavigateToBlock}
                              index={idx}
                            />
                          );
                        })}
                      </PageGroup>
                    ))
                  ) : (
                    <div style={styles.emptyState} data-testid="linked-empty">
                      No linked references
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Unlinked References Section */}
            {(hasUnlinked || unlinkedRefs !== undefined) && (
              <div style={styles.section} data-testid="unlinked-section">
                <SectionHeader
                  title="Unlinked References"
                  count={unlinkedRefs.length}
                  isExpanded={unlinkedExpanded}
                  onToggle={toggleUnlinked}
                  testId="unlinked-header"
                />
                {unlinkedExpanded && (
                  <div style={styles.content} data-testid="unlinked-content" role="list">
                    {hasUnlinked ? (
                      Array.from(unlinkedGroups.entries()).map(([groupPageId, { page, items }]) => (
                        <PageGroup
                          key={groupPageId}
                          page={page}
                          onNavigate={handleNavigateToPage}
                          testId={`unlinked-page-group-${groupPageId}`}
                        >
                          {items.map((item) => {
                            const idx = unlinkedIndex++;
                            return (
                              <UnlinkedItem
                                key={`${page.pageId}-${idx}`}
                                content={item.content}
                                page={page}
                                onNavigate={handleNavigateToPage}
                                index={idx}
                              />
                            );
                          })}
                        </PageGroup>
                      ))
                    ) : (
                      <div style={styles.emptyState} data-testid="unlinked-empty">
                        No unlinked references
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  })
);
