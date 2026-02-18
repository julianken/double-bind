/**
 * HoverPreview - Page-level singleton for hover preview overlays.
 *
 * Listens for `hover-preview-open` / `hover-preview-close` CustomEvents
 * dispatched by:
 *   - The ProseMirror `hover-preview` plugin (DBB-447) when hovering [[wikilinks]]
 *   - SourceListRow (sidebar) onMouseEnter/onMouseLeave handlers
 *
 * Uses the useHoverPreview hook (150ms open debounce, immediate close) and
 * renders a HoverPreviewCard at the reported screen coordinates.
 *
 * Event contract (dispatched on `window`):
 *   hover-preview-open  → CustomEvent<{ pageId: PageId; x: number; y: number }>
 *   hover-preview-close → CustomEvent<{ pageId?: PageId }>
 *
 * @see packages/desktop/src/hooks/useHoverPreview.ts
 * @see packages/desktop/src/hooks/usePagePreview.ts
 * @see packages/desktop/src/components/HoverPreviewCard.tsx
 */

import { memo } from 'react';
import type { PageId } from '@double-bind/types';
import { useHoverPreview } from '../hooks/useHoverPreview.js';
import { HoverPreviewCard } from './HoverPreviewCard.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Props accepted by HoverPreview. Normally used without any props as a
 * page-level singleton (self-managing via CustomEvents). Pass `testPageId`
 * and `testPosition` to override state in unit tests.
 */
export interface HoverPreviewProps {
  /** Force-open with this pageId (testing only) */
  testPageId?: string;
  /** Force position (testing only) */
  testPosition?: { x: number; y: number };
}

// ============================================================================
// HoverPreview Component
// ============================================================================

/**
 * HoverPreview — singleton overlay that renders HoverPreviewCard when a user
 * hovers over a page link in the editor or sidebar.
 *
 * Mount once near the root of the app tree (PageView already does this).
 * The component has no visible output when not active.
 */
export const HoverPreview = memo(function HoverPreview({
  testPageId,
  testPosition,
}: HoverPreviewProps) {
  const { isVisible, position, pageId } = useHoverPreview();

  // Allow test overrides
  const activePageId = testPageId ?? (isVisible ? pageId : null);
  const activePosition = testPosition ?? position;

  if (!activePageId) {
    return null;
  }

  return (
    <HoverPreviewCard
      pageId={activePageId as PageId}
      x={activePosition.x}
      y={activePosition.y}
    />
  );
});

HoverPreview.displayName = 'HoverPreview';
