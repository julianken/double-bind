/**
 * NewPageButton - Button component for creating new pages
 *
 * A simple button that triggers page creation via the useCreatePage hook.
 * Designed to be placed in the sidebar for easy access.
 *
 * Features:
 * - Calls pageService.createPage when clicked
 * - Shows loading state during creation
 * - Displays error message if creation fails
 * - Disabled while creation is in progress
 */

import { useCreatePage } from '../hooks/useCreatePage.js';

/**
 * Props for NewPageButton component.
 */
export interface NewPageButtonProps {
  /** Optional CSS class name for styling */
  className?: string;
  /** Optional custom button text. Defaults to "New Page". */
  label?: string;
  /** Optional callback after successful page creation */
  onSuccess?: () => void;
  /** Optional callback on creation error */
  onError?: (error: Error) => void;
}

/**
 * Button component for creating new pages.
 *
 * Integrates with useCreatePage hook to handle page creation,
 * navigation, and cache invalidation.
 *
 * @example
 * ```tsx
 * function Sidebar() {
 *   return (
 *     <div className="sidebar">
 *       <NewPageButton className="sidebar-button" />
 *       <PageList />
 *     </div>
 *   );
 * }
 * ```
 */
export function NewPageButton({
  className,
  label = 'New Page',
  onSuccess,
  onError,
}: NewPageButtonProps) {
  const { createPage, isCreating } = useCreatePage();

  const handleClick = async () => {
    const result = await createPage();

    if (result.page) {
      onSuccess?.();
    } else if (result.error) {
      onError?.(result.error);
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={isCreating}
      aria-busy={isCreating}
      data-testid="new-page-button"
    >
      {isCreating ? 'Creating...' : label}
    </button>
  );
}
