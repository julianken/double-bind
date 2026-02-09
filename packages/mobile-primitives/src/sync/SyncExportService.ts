/**
 * SyncExportService - Database export functionality for synchronization.
 *
 * Provides full and incremental export of database contents to facilitate
 * synchronization between devices. Exports include pages, blocks, links,
 * and metadata with HLC timestamps for version tracking.
 *
 * Key Features:
 * - Full database export (all non-deleted entities)
 * - Incremental export (changes since last sync using HLC timestamps)
 * - Sync metadata (device ID, timestamps, version)
 * - Type-safe export format with counts for validation
 *
 * Usage:
 * ```typescript
 * const service = new SyncExportService(graphDB, 'device-123');
 *
 * // Full export for initial sync
 * const fullExport = await service.exportFull();
 *
 * // Incremental export for subsequent syncs
 * const incrementalExport = await service.exportIncremental(lastSyncTimestamp);
 * ```
 */

import type { GraphDB, Page, Block, Link, BlockId, PageId, HLCString } from '@double-bind/types';
import { generateHLC, serializeHLC } from './hlc';

/**
 * Sync export package format.
 *
 * Contains all data needed for synchronization including entities,
 * metadata, and version tracking information.
 */
export interface SyncExportPackage {
  /** Package format version (semver) */
  version: string;

  /** ID of device that created this export */
  deviceId: string;

  /** HLC timestamp when export was created */
  exportedAt: HLCString;

  /** HLC timestamp of last sync (for incremental exports) */
  lastSyncAt?: HLCString;

  /** Exported entity data */
  data: {
    /** All exported pages */
    pages: Page[];

    /** All exported blocks */
    blocks: Block[];

    /** All exported links */
    links: Link[];
  };

  /** Export metadata for validation */
  metadata: {
    /** Number of pages in export */
    pageCount: number;

    /** Number of blocks in export */
    blockCount: number;

    /** Number of links in export */
    linkCount: number;

    /** Whether this is an incremental export */
    isIncremental: boolean;
  };
}

/**
 * Service for exporting database contents for synchronization.
 *
 * Handles both full and incremental exports with proper metadata
 * and timestamp tracking for conflict detection.
 */
export class SyncExportService {
  /** Current package format version */
  private static readonly PACKAGE_VERSION = '1.0.0';

  constructor(
    private readonly db: GraphDB,
    private readonly deviceId: string
  ) {}

  /**
   * Export all non-deleted entities from the database.
   *
   * Used for initial synchronization or when a full sync is required.
   * Includes all pages, blocks, and links that are not marked as deleted.
   *
   * @returns Complete export package with all entities
   */
  async exportFull(): Promise<SyncExportPackage> {
    // Generate export timestamp
    const exportTimestamp = serializeHLC(generateHLC(this.deviceId));

    // Query all non-deleted pages
    const pagesScript = `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    is_deleted == false
:order -updated_at
    `.trim();

    const pagesResult = await this.db.query(pagesScript);
    const pages = pagesResult.rows.map((row) => this.parsePageRow(row as unknown[]));

    // Query all non-deleted blocks
    const blocksScript = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    is_deleted == false
:order -updated_at
    `.trim();

    const blocksResult = await this.db.query(blocksScript);
    const blocks = blocksResult.rows.map((row) => this.parseBlockRow(row as unknown[]));

    // Query all links
    const linksScript = `
?[source_id, target_id, link_type, created_at, context_block_id] :=
    *links{ source_id, target_id, link_type, created_at, context_block_id }
:order -created_at
    `.trim();

    const linksResult = await this.db.query(linksScript);
    const links = linksResult.rows.map((row) => this.parseLinkRow(row as unknown[]));

    return {
      version: SyncExportService.PACKAGE_VERSION,
      deviceId: this.deviceId,
      exportedAt: exportTimestamp,
      data: {
        pages,
        blocks,
        links,
      },
      metadata: {
        pageCount: pages.length,
        blockCount: blocks.length,
        linkCount: links.length,
        isIncremental: false,
      },
    };
  }

  /**
   * Export entities that changed since the last sync.
   *
   * Used for efficient subsequent synchronizations. Only includes entities
   * with updatedAt/createdAt timestamps newer than lastSyncAt.
   *
   * Note: This implementation uses physical timestamps (updatedAt/createdAt)
   * for filtering. In a full HLC-based system, entities would have HLC
   * version fields for more precise causal ordering.
   *
   * @param lastSyncAt - HLC timestamp of last successful sync
   * @returns Export package with only changed entities
   * @throws Error if lastSyncAt has invalid HLC format
   */
  async exportIncremental(lastSyncAt: HLCString): Promise<SyncExportPackage> {
    // Parse lastSyncAt to get physical timestamp for comparison (validates format)
    const lastSyncTimestamp = this.parseHLCPhysicalTime(lastSyncAt);

    // Generate export timestamp
    const exportTimestamp = serializeHLC(generateHLC(this.deviceId));

    // Query pages updated since last sync
    const pagesScript = `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    updated_at > $last_sync
:order -updated_at
    `.trim();

    const pagesResult = await this.db.query(pagesScript, {
      last_sync: lastSyncTimestamp,
    });
    const pages = pagesResult.rows.map((row) => this.parsePageRow(row as unknown[]));

    // Query blocks updated since last sync
    const blocksScript = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    updated_at > $last_sync
:order -updated_at
    `.trim();

    const blocksResult = await this.db.query(blocksScript, {
      last_sync: lastSyncTimestamp,
    });
    const blocks = blocksResult.rows.map((row) => this.parseBlockRow(row as unknown[]));

    // Query links created since last sync
    const linksScript = `
?[source_id, target_id, link_type, created_at, context_block_id] :=
    *links{ source_id, target_id, link_type, created_at, context_block_id },
    created_at > $last_sync
:order -created_at
    `.trim();

    const linksResult = await this.db.query(linksScript, {
      last_sync: lastSyncTimestamp,
    });
    const links = linksResult.rows.map((row) => this.parseLinkRow(row as unknown[]));

    return {
      version: SyncExportService.PACKAGE_VERSION,
      deviceId: this.deviceId,
      exportedAt: exportTimestamp,
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
        isIncremental: true,
      },
    };
  }

  /**
   * Get device ID used by this export service.
   *
   * @returns Device ID string
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Parse database row into Page object.
   *
   * @param row - Database row from pages relation
   * @returns Parsed Page object
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
      pageId: pageId as PageId,
      title,
      createdAt,
      updatedAt,
      isDeleted,
      dailyNoteDate,
    };
  }

  /**
   * Parse database row into Block object.
   *
   * @param row - Database row from blocks relation
   * @returns Parsed Block object
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
      blockId: blockId as BlockId,
      pageId: pageId as PageId,
      parentId: parentId as BlockId | null,
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
   * Parse database row into Link object.
   *
   * @param row - Database row from links relation
   * @returns Parsed Link object
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
      sourceId: sourceId as PageId,
      targetId: targetId as PageId,
      linkType,
      createdAt,
      contextBlockId: contextBlockId as BlockId | null,
    };
  }

  /**
   * Parse physical time from HLC string.
   *
   * HLC format: `physical-logical-nodeId`
   * Example: `1707456123456-0-device123`
   *
   * @param hlcString - Serialized HLC timestamp
   * @returns Physical timestamp in milliseconds
   * @throws Error if HLC format is invalid
   */
  private parseHLCPhysicalTime(hlcString: HLCString): number {
    const parts = hlcString.split('-');
    if (parts.length < 3) {
      throw new Error(`Invalid HLC string format: ${hlcString}`);
    }

    const physical = parseInt(parts[0]!, 10);
    const logical = parseInt(parts[1]!, 10);

    if (isNaN(physical) || isNaN(logical)) {
      throw new Error(`Invalid HLC string format: ${hlcString}`);
    }

    return physical;
  }
}
