# Data Flow

## Write Path: User Types in a Block

```
1. User types in ProseMirror editor
2. ProseMirror updates its internal state (immediate, no DB call)
3. After 300ms debounce, onChange fires
4. BlockService.updateContent(blockId, newContent) called
5. Service parses content for [[links]], ((refs)), #tags
6. Service calls BlockRepository.update(block)
7. Repository constructs parameterized Datalog:
   - :put blocks { block_id: $id, content: $content, updated_at: $now }
   - :put blocks_by_page { page_id: $page_id, block_id: $id }
   - :put links { ... } (if new links found)
   - :put block_refs { ... } (if new refs found)
   - :put tags { ... } (if new tags found)
8. GraphDB.mutate(script, params) called
9. Tauri invoke('mutate', { script, params })
10. Rust shim: blocklist check → run_script(script, params, Mutable)
11. CozoDB executes atomically against RocksDB
12. Result returns up the stack
13. invalidateQueries() triggers useCozoQuery re-fetch (page blocks, backlinks)
```

## Read Path: User Opens a Page

```
1. User clicks page in sidebar (or navigates via [[link]])
2. useCozoQuery cache check — if data exists, render immediately
3. If missing/invalidated: PageService.getPageWithBlocks(pageId)
4. Service calls multiple repositories in parallel:
   a. PageRepository.getById(pageId)
   b. BlockRepository.getByPage(pageId) — uses blocks_by_page index
   c. LinkRepository.getInLinks(pageId)
5. Each repository calls GraphDB.query(script, params)
6. Tauri invoke('query', { script, params })
7. Rust shim: run_script(script, params, Immutable)  ← engine-enforced read-only
8. CozoDB executes against RocksDB
9. Results return, repositories parse into typed domain objects (Zod validation)
10. Service assembles PageWithBlocks object
11. useCozoQuery stores the result in Zustand query cache
12. React renders the page tree via ProseMirror
```

## Graph Algorithm Path

```
1. User opens graph view or requests "suggested links"
2. GraphService.getPageRank() or .getSuggestedLinks(pageId)
3. Service constructs CozoDB graph algorithm query:
   rank[node, score] <~ PageRank(*links[source_id, target_id])
4. GraphDB.query(script, params) — read-only, may take 1-5 seconds
5. Results cached in useCozoQuery (Zustand-backed, key-based invalidation)
6. Rendered in react-force-graph-2d or as suggestions panel
```

## Bulk Import Path

```
1. User selects "Import from Roam JSON" or "Import Markdown"
2. ImportExportService parses the file format in TypeScript
3. Constructs relation data as { relation_name: rows[][] }
4. GraphDB.importRelations(data)
5. Tauri invoke('import_relations', { data })
6. Rust shim: db.import_relations(data)  ← dedicated CozoDB API, not run_script
7. CozoDB bulk-inserts all data
8. invalidateQueries() triggers re-fetch of all active queries
```

## Search/FTS Path

```
1. User types in search bar (debounced 200ms)
2. PageService.searchPages(query) + BlockService (via repositories)
3. Repositories call GraphDB.query() with FTS syntax:
   ~blocks:fts{ block_id, content | query: $query, k: $limit, bind_score: score }
   ~pages:fts{ page_id, title | query: $query, k: $limit, bind_score: score }
4. Results merged, sorted by score, returned to UI
5. useCozoQuery caches with key ['search', query]
6. Navigating to a result invalidates nothing (read-only)
```

## Backup/Export Path

```
1. User triggers backup (menu or CLI)
2. ImportExportService.backup(path)
3. GraphDB.backup(path) → invoke('backup', { path })
4. Rust shim: db.backup_db(path) — RocksDB checkpoint to disk
5. Returns success/failure. No cache invalidation needed.
```

## Optimistic Updates

Not implemented in Phase 1. CozoDB queries are local (sub-millisecond), so the read-after-write latency is negligible. If needed later, Zustand makes optimistic updates straightforward: update the store immediately, then reconcile after the mutation completes.
