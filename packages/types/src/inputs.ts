// Input types for create/update operations
// Type aliases defined locally since domain.ts is in a separate PR (DBB-24)

type PageId = string;
type BlockId = string;
type BlockContentType = 'text' | 'heading' | 'code' | 'todo' | 'query';

/**
 * Input for creating a new page.
 */
export interface CreatePageInput {
  title: string;
  dailyNoteDate?: string;
}

/**
 * Input for creating a new block.
 */
export interface CreateBlockInput {
  pageId: PageId;
  parentId?: BlockId;
  content: string;
  contentType?: BlockContentType;
  order?: string;
}

/**
 * Input for updating an existing block.
 * All fields are optional to support partial updates.
 */
export interface UpdateBlockInput {
  content?: string;
  parentId?: BlockId | null;
  order?: string;
  isCollapsed?: boolean;
}
