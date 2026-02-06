/**
 * Components - Reusable React components
 *
 * Barrel export for all desktop application components.
 */

export { Router } from './Router.js';
export type { Route, RouteComponentProps, RouterProps } from './Router.js';

export {
  ErrorBoundary,
  type ErrorBoundaryProps,
  type ErrorBoundaryState,
} from './ErrorBoundary.js';

export {
  BlockNode,
  BulletHandle,
  BlockEditor,
  StaticBlockContent,
  STATIC_BLOCK_CONTENT_CSS_CLASSES,
  useBlock,
  useBlockChildren,
  type BlockNodeProps,
  type BulletHandleProps,
  type BlockEditorProps,
  type StaticBlockContentProps,
  type ContentSegment,
} from './BlockNode.js';

export { PageList, PageListItem } from './PageList.js';
export type { PageListProps, PageListItemProps } from './PageList.js';

export { PageTitle, type PageTitleProps } from './PageTitle.js';

export { NewPageButton, type NewPageButtonProps } from './NewPageButton.js';

export { SplitPane, type SplitPaneProps } from './SplitPane.js';
