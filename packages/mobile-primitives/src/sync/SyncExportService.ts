/**
 * SyncExportService - Exports database state for synchronization.
 *
 * Provides two modes:
 * 1. Full export: All pages, blocks, and links (initial sync)
 * 2. Incremental export: Only changes since last sync (using HLC timestamps)
 *
 * The export format is a portable JSON package that can be transmitted
 * over network or stored as a file.
 */

import type { GraphDB, Page, Block, Link } from '@double-bind/types';
import { generateHLC, serializeHLC } from './hlc.js';

// ============================================================================
// Export Types
// ============================================================================

/**
 * Sync export package containing database snapshot.
 */
export interface SyncExportPackage {
  /** Export format version (semantic versioning) */
  version: string;

  /** Device/node ID that created this export */
  deviceId: string;

  /** HLC timestamp when export was created */
  exportedAt: string;

  /** HLC timestamp of last sync (for incremental exports) */
  lastSyncAt?: string;

  /** Exported data */
  data: {
    pages: Page[];
    blocks: Block[];
    links: Link[];
  };

  /** Export metadata */
  metadata: {
    pageCount: number;
    blockCount: number;
    linkCount: number;
    isIncremental: boolean;
  };
}

/**
 * Options for creating an export.
 */
export interface ExportOptions {
  /** Device/node ID for this instance */
  deviceId: string;

  /** Last sync timestamp (for incremental export). If omitted, performs full export. */
  lastSyncAt?: string;

  /** Include deleted items in export (default: false) */
  includeDeleted?: boolean;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Service for exporting database state for sync.
 */
export class SyncExportService {
  /** Export format version */
  private static readonly EXPORT_VERSION = '1.0.0';

  constructor(private readonly db: GraphDB) {}

  /**
   * Export database state for synchronization.
   *
   * Creates either a full or incremental export based on options.
   * Full export includes all data; incremental export only includes
   * changes since lastSyncAt timestamp.
   *
   * @param options - Export configuration
   * @returns Export package ready for transmission
   */
  async export(options: ExportOptions): Promise<SyncExportPackage> {
    const { deviceId, lastSyncAt, includeDeleted = false } = options;

    // Generate export timestamp
    const exportedAtHLC = generateHLC(deviceId);
    const exportedAt = serializeHLC(exportedAtHLC);

    // Determine if this is incremental or full export
    const isIncremental = !!lastSyncAt;

    // Export data based on mode
    const pages = isIncremental
      ? await this.exportPagesIncremental(lastSyncAt, includeDeleted)
      : await this.exportPagesFull(includeDeleted);

    const blocks = isIncremental
      ? await this.exportBlocksIncremental(lastSyncAt, includeDeleted)
      : await this.exportBlocksFull(includeDeleted);

    const links = isIncremental
      ? await this.exportLinksIncremental(lastSyncAt)
      : await this.exportLinksFull();

    // Build export package
    const exportPackage: SyncExportPackage = {
      version: SyncExportService.EXPORT_VERSION,
      deviceId,
      exportedAt,
      lastSyncAt,
      data: {
        pages,
        blocks,
        links,
      },
      metadata: {
        pageCount: pages.length,
        blockCount: blocks.length,
        linkCount: links.length,
        isIncremental,
      },
    };

    return exportPackage;
  }

  /**
   * Export all pages (full export).
   *
   * @param includeDeleted - Whether to include deleted pages
   * @returns Array of all pages
   */
  private async exportPagesFull(includeDeleted: boolean): Promise<Page[]> {
    const script = includeDeleted
      ? `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date }
:order page_id
`.trim()
      : `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    is_deleted == false
:order page_id
`.trim();

    const result = await this.db.query(script);
    return result.rows.map((row) => this.parsePageRow(row as unknown[]));
  }

  /**
   * Export pages changed since lastSyncAt (incremental export).
   *
   * @param lastSyncAt - HLC timestamp of last sync
   * @param includeDeleted - Whether to include deleted pages
   * @returns Array of changed pages
   */
  private async exportPagesIncremental(
    lastSyncAt: string,
    includeDeleted: boolean
  ): Promise<Page[]> {
    // Extract physical timestamp from HLC string (format: physical-logical-nodeId)
    const lastSyncTimestamp = this.extractPhysicalTime(lastSyncAt);

    const script = includeDeleted
      ? `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    updated_at > $last_sync
:order page_id
`.trim()
      : `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    updated_at > $last_sync,
    is_deleted == false
:order page_id
`.trim();

    const result = await this.db.query(script, { last_sync: lastSyncTimestamp });
    return result.rows.map((row) => this.parsePageRow(row as unknown[]));
  }

  /**
   * Export all blocks (full export).
   *
   * @param includeDeleted - Whether to include deleted blocks
   * @returns Array of all blocks
   */
  private async exportBlocksFull(includeDeleted: boolean): Promise<Block[]> {
    const script = includeDeleted
      ? `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }
:order block_id
`.trim()
      : `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    is_deleted == false
:order block_id
`.trim();

    const result = await this.db.query(script);
    return result.rows.map((row) => this.parseBlockRow(row as unknown[]));
  }

  /**
   * Export blocks changed since lastSyncAt (incremental export).
   *
   * @param lastSyncAt - HLC timestamp of last sync
   * @param includeDeleted - Whether to include deleted blocks
   * @returns Array of changed blocks
   */
  private async exportBlocksIncremental(
    lastSyncAt: string,
    includeDeleted: boolean
  ): Promise<Block[]> {
    const lastSyncTimestamp = this.extractPhysicalTime(lastSyncAt);

    const script = includeDeleted
      ? `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    updated_at > $last_sync
:order block_id
`.trim()
      : `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    updated_at > $last_sync,
    is_deleted == false
:order block_id
`.trim();

    const result = await this.db.query(script, { last_sync: lastSyncTimestamp });
    return result.rows.map((row) => this.parseBlockRow(row as unknown[]));
  }

  /**
   * Export all links (full export).
   *
   * @returns Array of all links
   */
  private async exportLinksFull(): Promise<Link[]> {
    const script = `
?[source_id, target_id, link_type, created_at, context_block_id] :=
    *links{ source_id, target_id, link_type, created_at, context_block_id }
:order source_id, target_id
`.trim();

    const result = await this.db.query(script);
    return result.rows.map((row) => this.parseLinkRow(row as unknown[]));
  }

  /**
   * Export links created since lastSyncAt (incremental export).
   *
   * Note: Links don't have updated_at, so we use created_at for filtering.
   * This means link updates (if any) won't be captured. The sync implementation
   * should treat links as immutable (delete + recreate for updates).
   *
   * @param lastSyncAt - HLC timestamp of last sync
   * @returns Array of new links
   */
  private async exportLinksIncremental(lastSyncAt: string): Promise<Link[]> {
    const lastSyncTimestamp = this.extractPhysicalTime(lastSyncAt);

    const script = `
?[source_id, target_id, link_type, created_at, context_block_id] :=
    *links{ source_id, target_id, link_type, created_at, context_block_id },
    created_at > $last_sync
:order source_id, target_id
`.trim();

    const result = await this.db.query(script, { last_sync: lastSyncTimestamp });
    return result.rows.map((row) => this.parseLinkRow(row as unknown[]));
  }

  // ============================================================================
  // Row Parsers
  // ============================================================================

  /**
   * Parse page row from database result.
   */
  private parsePageRow(row: unknown[]): Page {
    const [pageId, title, createdAt, updatedAt, isDeleted, dailyNoteDate] = row as [
      string,
      string,
      number,
      number,
      boolean,
      string | null,
    ];

    return {
      pageId,
      title,
      createdAt,
      updatedAt,
      isDeleted,
      dailyNoteDate,
    };
  }

  /**
   * Parse block row from database result.
   */
  private parseBlockRow(row: unknown[]): Block {
    const [
      blockId,
      pageId,
      parentId,
      content,
      contentType,
      order,
      isCollapsed,
      isDeleted,
      createdAt,
      updatedAt,
    ] = row as [
      string,
      string,
      string | null,
      string,
      'text' | 'heading' | 'code' | 'todo' | 'query',
      string,
      boolean,
      boolean,
      number,
      number,
    ];

    return {
      blockId,
      pageId,
      parentId,
      content,
      contentType,
      order,
      isCollapsed,
      isDeleted,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Parse link row from database result.
   */
  private parseLinkRow(row: unknown[]): Link {
    const [sourceId, targetId, linkType, createdAt, contextBlockId] = row as [
      string,
      string,
      'reference' | 'embed' | 'tag',
      number,
      string | null,
    ];

    return {
      sourceId,
      targetId,
      linkType,
      createdAt,
      contextBlockId,
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Extract physical timestamp from HLC string.
   *
   * HLC format: `physical-logical-nodeId`
   * Example: `1707456123456-0-device123` -> 1707456123456
   *
   * @param hlcString - Serialized HLC timestamp
   * @returns Physical timestamp in milliseconds
   */
  private extractPhysicalTime(hlcString: string): number {
    const parts = hlcString.split('-');
    if (parts.length < 3) {
      throw new Error(`Invalid HLC string format: ${hlcString}`);
    }

    const physical = parseInt(parts[0], 10);
    if (isNaN(physical)) {
      throw new Error(`Invalid HLC string format: ${hlcString}`);
    }

    return physical;
  }
}
