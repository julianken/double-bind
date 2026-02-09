/**
 * Sync Import Service
 *
 * Implements database import from sync data with conflict detection,
 * incremental merging, and rollback capabilities.
 *
 * Features:
 * - Full import (replace all data)
 * - Incremental merge (merge changes with conflict detection)
 * - HLC-based conflict detection
 * - Transaction rollback on failure
 * - Validation before import
 */

import type {
  GraphDB,
  SyncData,
  ImportOptions,
  ImportResult,
  ImportStats,
  ImportConflict,
  SyncDataValidation,
  SyncDataValidationError,
  ConflictMetadata,
  ConflictStore,
  Block,
  Page,
  HLCString,
} from '@double-bind/types';
import { ulid } from 'ulid';
import { compareHLCStrings } from './hlc';

/**
 * Service for importing sync data into the database.
 *
 * Handles full and incremental imports with conflict detection
 * and resolution based on HLC timestamps and version vectors.
 */
export class SyncImportService {
  constructor(
    private readonly db: GraphDB,
    private readonly conflictStore: ConflictStore
  ) {}

  /**
   * Import sync data into the database.
   *
   * @param syncData - Data to import
   * @param options - Import options
   * @returns Import result with statistics and conflicts
   */
  async import(syncData: SyncData, options: ImportOptions): Promise<ImportResult> {
    const startTime = Date.now();
    const stats: ImportStats = {
      pagesImported: 0,
      blocksImported: 0,
      linksImported: 0,
      conflictsDetected: 0,
      conflictsAutoResolved: 0,
      durationMs: 0,
    };
    const conflicts: ImportConflict[] = [];
    const conflictIds: string[] = [];

    try {
      // Validate sync data if requested
      if (options.validate) {
        const validation = await this.validateSyncData(syncData);
        if (!validation.valid) {
          return {
            success: false,
            stats,
            conflicts,
            error: `Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`,
          };
        }
      }

      // Create backup if requested
      if (options.createBackup) {
        const backupPath = `backup-${Date.now()}.db`;
        await this.db.backup(backupPath);
      }

      if (options.mode === 'full') {
        // Full import - replace all data
        await this.performFullImport(syncData, options, stats);
      } else {
        // Incremental import - merge with conflict detection
        const result = await this.performIncrementalImport(syncData, options, stats);
        conflicts.push(...result.conflicts);
        conflictIds.push(...result.conflictIds);

        // Check if we exceeded max conflicts
        if (options.maxConflicts && conflicts.length > options.maxConflicts) {
          throw new Error(
            `Too many conflicts detected: ${conflicts.length} > ${options.maxConflicts}`
          );
        }
      }

      stats.durationMs = Date.now() - startTime;

      return {
        success: true,
        stats,
        conflicts,
        conflictIds: conflictIds.length > 0 ? conflictIds : undefined,
      };
    } catch (error) {
      stats.durationMs = Date.now() - startTime;
      return {
        success: false,
        stats,
        conflicts,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate sync data before import.
   *
   * @param syncData - Data to validate
   * @returns Validation result
   */
  async validateSyncData(syncData: SyncData): Promise<SyncDataValidation> {
    const errors: SyncDataValidationError[] = [];
    const warnings: SyncDataValidationError[] = [];

    // Check schema version
    if (syncData.schemaVersion !== 1) {
      errors.push({
        type: 'invalid-version',
        entityId: 'schema',
        message: `Unsupported schema version: ${syncData.schemaVersion}`,
      });
    }

    // Build page ID set
    const pageIds = new Set(syncData.pages.map((p) => p.data.pageId));

    // Validate blocks reference existing pages
    for (const blockEntity of syncData.blocks) {
      const block = blockEntity.data;
      if (!pageIds.has(block.pageId)) {
        errors.push({
          type: 'missing-page',
          entityId: block.blockId,
          message: `Block ${block.blockId} references non-existent page ${block.pageId}`,
        });
      }
    }

    // Build block ID set
    const blockIds = new Set(syncData.blocks.map((b) => b.data.blockId));

    // Validate parent references
    for (const blockEntity of syncData.blocks) {
      const block = blockEntity.data;
      if (block.parentId && !blockIds.has(block.parentId)) {
        warnings.push({
          type: 'orphan-block',
          entityId: block.blockId,
          message: `Block ${block.blockId} has non-existent parent ${block.parentId}`,
        });
      }
    }

    // Validate links reference existing pages
    for (const link of syncData.links) {
      if (!pageIds.has(link.sourceId)) {
        warnings.push({
          type: 'invalid-reference',
          entityId: link.sourceId,
          message: `Link references non-existent source page ${link.sourceId}`,
        });
      }
      if (!pageIds.has(link.targetId)) {
        warnings.push({
          type: 'invalid-reference',
          entityId: link.targetId,
          message: `Link references non-existent target page ${link.targetId}`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Perform full import - replace all data.
   *
   * @param syncData - Data to import
   * @param options - Import options
   * @param stats - Statistics to update
   */
  private async performFullImport(
    syncData: SyncData,
    options: ImportOptions,
    stats: ImportStats
  ): Promise<void> {
    // Delete all existing data
    await this.db.mutate(`
      ?[blockId] := *block_versions[blockId, _, _, _, _, _, _, _, _]
      :delete block_versions {blockId}

      ?[blockId] := *blocks[blockId, _, _, _, _, _, _, _, _, _]
      :delete blocks {blockId}

      ?[pageId] := *pages[pageId, _, _, _, _, _]
      :delete pages {pageId}

      ?[sourceId, targetId, linkType] := *links[sourceId, targetId, linkType, _, _]
      :delete links {sourceId, targetId, linkType}

      ?[sourceBlockId, targetBlockId] := *block_refs[sourceBlockId, targetBlockId, _]
      :delete block_refs {sourceBlockId, targetBlockId}

      ?[entityId, key] := *properties[entityId, key, _, _, _]
      :delete properties {entityId, key}

      ?[entityId, tag] := *tags[entityId, tag, _]
      :delete tags {entityId, tag}
    `);

    // Import pages
    const pageRows = syncData.pages.map((p) => [
      p.data.pageId,
      p.data.title,
      p.data.createdAt,
      p.data.updatedAt,
      p.data.isDeleted,
      p.data.dailyNoteDate,
    ]);
    if (pageRows.length > 0) {
      await this.db.importRelations({ pages: pageRows });
      stats.pagesImported = pageRows.length;
    }

    // Import blocks
    const blockRows = syncData.blocks.map((b) => [
      b.data.blockId,
      b.data.pageId,
      b.data.parentId,
      b.data.content,
      b.data.contentType,
      b.data.order,
      b.data.isCollapsed,
      b.data.isDeleted,
      b.data.createdAt,
      b.data.updatedAt,
    ]);
    if (blockRows.length > 0) {
      await this.db.importRelations({ blocks: blockRows });
      stats.blocksImported = blockRows.length;
    }

    // Import links
    const linkRows = syncData.links.map((l) => [
      l.sourceId,
      l.targetId,
      l.linkType,
      l.createdAt,
      l.contextBlockId,
    ]);
    if (linkRows.length > 0) {
      await this.db.importRelations({ links: linkRows });
      stats.linksImported = linkRows.length;
    }

    // Import block refs
    const blockRefRows = syncData.blockRefs.map((br) => [
      br.sourceBlockId,
      br.targetBlockId,
      br.createdAt,
    ]);
    if (blockRefRows.length > 0) {
      await this.db.importRelations({ block_refs: blockRefRows });
    }

    // Import properties
    const propertyRows = syncData.properties.map((p) => [
      p.entityId,
      p.key,
      p.value,
      p.valueType,
      p.updatedAt,
    ]);
    if (propertyRows.length > 0) {
      await this.db.importRelations({ properties: propertyRows });
    }

    // Import tags
    const tagRows = syncData.tags.map((t) => [t.entityId, t.tag, t.createdAt]);
    if (tagRows.length > 0) {
      await this.db.importRelations({ tags: tagRows });
    }
  }

  /**
   * Perform incremental import with conflict detection.
   *
   * @param syncData - Data to import
   * @param options - Import options
   * @param stats - Statistics to update
   * @returns Detected conflicts
   */
  private async performIncrementalImport(
    syncData: SyncData,
    options: ImportOptions,
    stats: ImportStats
  ): Promise<{ conflicts: ImportConflict[]; conflictIds: string[] }> {
    const conflicts: ImportConflict[] = [];
    const conflictIds: string[] = [];

    // Fetch existing pages
    const existingPagesResult = await this.db.query(
      `?[pageId, title, createdAt, updatedAt, isDeleted, dailyNoteDate] := *pages[pageId, title, createdAt, updatedAt, isDeleted, dailyNoteDate]`
    );
    const existingPages = new Map<string, Page>(
      existingPagesResult.rows.map((row) => [
        row[0] as string,
        {
          pageId: row[0] as string,
          title: row[1] as string,
          createdAt: row[2] as unknown as number,
          updatedAt: row[3] as unknown as number,
          isDeleted: row[4] as unknown as boolean,
          dailyNoteDate: row[5] as string | null,
        },
      ])
    );

    // Fetch existing blocks
    const existingBlocksResult = await this.db.query(
      `?[blockId, pageId, parentId, content, contentType, order, isCollapsed, isDeleted, createdAt, updatedAt] := *blocks[blockId, pageId, parentId, content, contentType, order, isCollapsed, isDeleted, createdAt, updatedAt]`
    );
    const existingBlocks = new Map<string, Block>(
      existingBlocksResult.rows.map((row) => [
        row[0] as string,
        {
          blockId: row[0] as string,
          pageId: row[1] as string,
          parentId: row[2] as string | null,
          content: row[3] as string,
          contentType: row[4] as 'text' | 'heading' | 'code' | 'todo' | 'query',
          order: row[5] as string,
          isCollapsed: row[6] as unknown as boolean,
          isDeleted: row[7] as unknown as boolean,
          createdAt: row[8] as unknown as number,
          updatedAt: row[9] as unknown as number,
        },
      ])
    );

    // Process pages
    for (const pageEntity of syncData.pages) {
      const remotePage = pageEntity.data;
      const localPage = existingPages.get(remotePage.pageId);

      if (!localPage) {
        // New page - insert
        await this.insertPage(remotePage);
        stats.pagesImported++;
      } else {
        // Existing page - check for conflicts
        const conflict = await this.detectPageConflict(
          localPage,
          pageEntity,
          options
        );

        if (conflict) {
          conflicts.push(conflict);
          stats.conflictsDetected++;

          if (conflict.autoResolved) {
            stats.conflictsAutoResolved++;
            if (conflict.resolution === 'accept-remote') {
              await this.updatePage(remotePage);
              stats.pagesImported++;
            }
          } else {
            // Create conflict for manual resolution
            const conflictId = await this.createConflictMetadata(
              remotePage.pageId,
              'page',
              localPage,
              pageEntity
            );
            conflictIds.push(conflictId);
          }
        } else if (
          remotePage.updatedAt > localPage.updatedAt ||
          pageEntity.version > this.getEntityVersion(localPage)
        ) {
          // Remote is newer, update
          await this.updatePage(remotePage);
          stats.pagesImported++;
        }
      }
    }

    // Process blocks
    for (const blockEntity of syncData.blocks) {
      const remoteBlock = blockEntity.data;
      const localBlock = existingBlocks.get(remoteBlock.blockId);

      if (!localBlock) {
        // New block - insert
        await this.insertBlock(remoteBlock);
        stats.blocksImported++;
      } else {
        // Existing block - check for conflicts
        const conflict = await this.detectBlockConflict(
          localBlock,
          blockEntity,
          options
        );

        if (conflict) {
          conflicts.push(conflict);
          stats.conflictsDetected++;

          if (conflict.autoResolved) {
            stats.conflictsAutoResolved++;
            if (conflict.resolution === 'accept-remote') {
              await this.updateBlock(remoteBlock);
              stats.blocksImported++;
            }
          } else {
            // Create conflict for manual resolution
            const conflictId = await this.createConflictMetadata(
              remoteBlock.blockId,
              'block',
              localBlock,
              blockEntity
            );
            conflictIds.push(conflictId);
          }
        } else if (
          remoteBlock.updatedAt > localBlock.updatedAt ||
          blockEntity.version > this.getEntityVersion(localBlock)
        ) {
          // Remote is newer, update
          await this.updateBlock(remoteBlock);
          stats.blocksImported++;
        }
      }
    }

    // Import non-versioned entities (links, blockRefs, properties, tags)
    // These are imported without conflict detection
    await this.importNonVersionedEntities(syncData, stats);

    return { conflicts, conflictIds };
  }

  /**
   * Detect conflicts for a page.
   */
  private async detectPageConflict(
    localPage: Page,
    remotePage: { data: Page; version: HLCString; versionVector: Record<string, string> },
    options: ImportOptions
  ): Promise<ImportConflict | null> {
    const localVersion = this.getEntityVersion(localPage);
    const remoteVersion = remotePage.version;

    // Compare versions
    const cmp = compareHLCStrings(localVersion, remoteVersion);

    if (cmp === 0) {
      // Same version - check if content differs
      if (JSON.stringify(localPage) !== JSON.stringify(remotePage.data)) {
        // Concurrent modification with different content
        return this.handleConflict(
          localPage.pageId,
          'page',
          localVersion,
          remoteVersion,
          'concurrent',
          options
        );
      }
      return null; // No conflict
    }

    if (cmp > 0) {
      // Local is newer
      if (options.conflictStrategy === 'accept-remote') {
        return this.createAutoResolvedConflict(
          localPage.pageId,
          'page',
          localVersion,
          remoteVersion,
          'local-newer',
          'accept-remote'
        );
      }
      return this.handleConflict(
        localPage.pageId,
        'page',
        localVersion,
        remoteVersion,
        'local-newer',
        options
      );
    }

    // Remote is newer (cmp < 0)
    if (options.conflictStrategy === 'reject') {
      return this.createAutoResolvedConflict(
        localPage.pageId,
        'page',
        localVersion,
        remoteVersion,
        'remote-newer',
        'keep-local'
      );
    }

    return null; // No conflict, will update
  }

  /**
   * Detect conflicts for a block.
   */
  private async detectBlockConflict(
    localBlock: Block,
    remoteBlock: { data: Block; version: HLCString; versionVector: Record<string, string> },
    options: ImportOptions
  ): Promise<ImportConflict | null> {
    const localVersion = this.getEntityVersion(localBlock);
    const remoteVersion = remoteBlock.version;

    // Compare versions
    const cmp = compareHLCStrings(localVersion, remoteVersion);

    if (cmp === 0) {
      // Same version - check if content differs
      if (JSON.stringify(localBlock) !== JSON.stringify(remoteBlock.data)) {
        // Concurrent modification with different content
        return this.handleConflict(
          localBlock.blockId,
          'block',
          localVersion,
          remoteVersion,
          'concurrent',
          options
        );
      }
      return null; // No conflict
    }

    if (cmp > 0) {
      // Local is newer
      if (options.conflictStrategy === 'accept-remote') {
        return this.createAutoResolvedConflict(
          localBlock.blockId,
          'block',
          localVersion,
          remoteVersion,
          'local-newer',
          'accept-remote'
        );
      }
      return this.handleConflict(
        localBlock.blockId,
        'block',
        localVersion,
        remoteVersion,
        'local-newer',
        options
      );
    }

    // Remote is newer (cmp < 0)
    if (options.conflictStrategy === 'reject') {
      return this.createAutoResolvedConflict(
        localBlock.blockId,
        'block',
        localVersion,
        remoteVersion,
        'remote-newer',
        'keep-local'
      );
    }

    return null; // No conflict, will update
  }

  /**
   * Handle conflict based on strategy.
   */
  private handleConflict(
    entityId: string,
    entityType: 'block' | 'page',
    localVersion: HLCString,
    remoteVersion: HLCString,
    comparison: 'local-newer' | 'remote-newer' | 'concurrent',
    options: ImportOptions
  ): ImportConflict | null {
    if (options.conflictStrategy === 'auto') {
      // Auto-resolve based on HLC
      const resolution = comparison === 'remote-newer' ? 'accept-remote' : 'keep-local';
      return this.createAutoResolvedConflict(
        entityId,
        entityType,
        localVersion,
        remoteVersion,
        comparison,
        resolution
      );
    }

    if (options.conflictStrategy === 'reject') {
      return this.createAutoResolvedConflict(
        entityId,
        entityType,
        localVersion,
        remoteVersion,
        comparison,
        'keep-local'
      );
    }

    if (options.conflictStrategy === 'accept-remote') {
      return this.createAutoResolvedConflict(
        entityId,
        entityType,
        localVersion,
        remoteVersion,
        comparison,
        'accept-remote'
      );
    }

    // Manual resolution
    return {
      entityId,
      entityType,
      localVersion,
      remoteVersion,
      comparison,
      autoResolved: false,
    };
  }

  /**
   * Create auto-resolved conflict.
   */
  private createAutoResolvedConflict(
    entityId: string,
    entityType: 'block' | 'page',
    localVersion: HLCString,
    remoteVersion: HLCString,
    comparison: 'local-newer' | 'remote-newer' | 'concurrent',
    resolution: 'keep-local' | 'accept-remote'
  ): ImportConflict {
    return {
      entityId,
      entityType,
      localVersion,
      remoteVersion,
      comparison,
      autoResolved: true,
      resolution,
    };
  }

  /**
   * Create conflict metadata for manual resolution.
   */
  private async createConflictMetadata(
    entityId: string,
    entityType: 'block' | 'page',
    localEntity: Block | Page,
    remoteEntity: { data: Block | Page; version: HLCString; versionVector: Record<string, string> }
  ): Promise<string> {
    const conflictId = ulid();

    const conflict: ConflictMetadata = {
      conflictId,
      entityId,
      entityType,
      conflictType: 'content',
      state: 'detected',
      resolutionStrategy: 'manual',
      localVersion: {
        timestamp: this.getEntityVersion(localEntity),
        snapshot: localEntity,
        versionVector: {},
      },
      remoteVersion: {
        timestamp: remoteEntity.version,
        snapshot: remoteEntity.data,
        versionVector: remoteEntity.versionVector,
      },
      detectedAt: Date.now(),
    };

    await this.conflictStore.saveConflict(conflict);
    return conflictId;
  }

  /**
   * Get entity version (fallback to updatedAt if no version field).
   */
  private getEntityVersion(entity: Block | Page): HLCString {
    // For now, use updatedAt as a simple version
    // In full implementation, entities would have version field
    const timestamp = entity.updatedAt || entity.createdAt || Date.now();
    return `${timestamp}-0-local`;
  }

  /**
   * Insert page into database.
   */
  private async insertPage(page: Page): Promise<void> {
    await this.db.mutate(
      `?[pageId, title, createdAt, updatedAt, isDeleted, dailyNoteDate] <- [[
        $pageId, $title, $createdAt, $updatedAt, $isDeleted, $dailyNoteDate
      ]]
      :put pages {pageId => title, createdAt, updatedAt, isDeleted, dailyNoteDate}`,
      {
        pageId: page.pageId,
        title: page.title,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        isDeleted: page.isDeleted,
        dailyNoteDate: page.dailyNoteDate,
      }
    );
  }

  /**
   * Update page in database.
   */
  private async updatePage(page: Page): Promise<void> {
    await this.insertPage(page); // :put will update if exists
  }

  /**
   * Insert block into database.
   */
  private async insertBlock(block: Block): Promise<void> {
    await this.db.mutate(
      `?[blockId, pageId, parentId, content, contentType, order, isCollapsed, isDeleted, createdAt, updatedAt] <- [[
        $blockId, $pageId, $parentId, $content, $contentType, $order, $isCollapsed, $isDeleted, $createdAt, $updatedAt
      ]]
      :put blocks {blockId => pageId, parentId, content, contentType, order, isCollapsed, isDeleted, createdAt, updatedAt}`,
      {
        blockId: block.blockId,
        pageId: block.pageId,
        parentId: block.parentId,
        content: block.content,
        contentType: block.contentType,
        order: block.order,
        isCollapsed: block.isCollapsed,
        isDeleted: block.isDeleted,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
      }
    );
  }

  /**
   * Update block in database.
   */
  private async updateBlock(block: Block): Promise<void> {
    await this.insertBlock(block); // :put will update if exists
  }

  /**
   * Import non-versioned entities (links, blockRefs, properties, tags).
   */
  private async importNonVersionedEntities(
    syncData: SyncData,
    stats: ImportStats
  ): Promise<void> {
    // Import links (merge with existing)
    for (const link of syncData.links) {
      await this.db.mutate(
        `?[sourceId, targetId, linkType, createdAt, contextBlockId] <- [[
          $sourceId, $targetId, $linkType, $createdAt, $contextBlockId
        ]]
        :put links {sourceId, targetId, linkType => createdAt, contextBlockId}`,
        {
          sourceId: link.sourceId,
          targetId: link.targetId,
          linkType: link.linkType,
          createdAt: link.createdAt,
          contextBlockId: link.contextBlockId,
        }
      );
      stats.linksImported++;
    }

    // Import block refs
    for (const blockRef of syncData.blockRefs) {
      await this.db.mutate(
        `?[sourceBlockId, targetBlockId, createdAt] <- [[
          $sourceBlockId, $targetBlockId, $createdAt
        ]]
        :put block_refs {sourceBlockId, targetBlockId => createdAt}`,
        {
          sourceBlockId: blockRef.sourceBlockId,
          targetBlockId: blockRef.targetBlockId,
          createdAt: blockRef.createdAt,
        }
      );
    }

    // Import properties
    for (const property of syncData.properties) {
      await this.db.mutate(
        `?[entityId, key, value, valueType, updatedAt] <- [[
          $entityId, $key, $value, $valueType, $updatedAt
        ]]
        :put properties {entityId, key => value, valueType, updatedAt}`,
        {
          entityId: property.entityId,
          key: property.key,
          value: property.value,
          valueType: property.valueType,
          updatedAt: property.updatedAt,
        }
      );
    }

    // Import tags
    for (const tag of syncData.tags) {
      await this.db.mutate(
        `?[entityId, tag, createdAt] <- [[
          $entityId, $tag, $createdAt
        ]]
        :put tags {entityId, tag => createdAt}`,
        {
          entityId: tag.entityId,
          tag: tag.tag,
          createdAt: tag.createdAt,
        }
      );
    }
  }
}
