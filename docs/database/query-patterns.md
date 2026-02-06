# Common Datalog Query Patterns

All queries use parameterized variables (`$param`). User data never enters the script string.

## Page Operations

### Get page by ID
```datalog
?[page_id, title, created_at, updated_at, daily_note_date] :=
    *pages{ page_id: $id, title, created_at, updated_at, daily_note_date, is_deleted: false }
```

### List all pages (non-deleted)
```datalog
?[page_id, title, updated_at] :=
    *pages{ page_id, title, updated_at, is_deleted: false }
:order -updated_at
:limit $limit
:offset $offset
```

### Create page
```datalog
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
    [$id, $title, $now, $now, false, $daily_date]
]
:put pages { page_id, title, created_at, updated_at, is_deleted, daily_note_date }
```

## Block Operations

### Get all blocks for a page (via index)
```datalog
?[block_id, content, parent_id, order, content_type, is_collapsed] :=
    *blocks_by_page{ page_id: $page_id, block_id },
    *blocks{ block_id, content, parent_id, order, content_type, is_collapsed, is_deleted: false }
:order order
```

### Get children of a block (via index)

For root-level children, pass `$parent_id = "__page:<page_id>"`. For children of a specific block, pass the block's ID directly.

```datalog
?[block_id, content, order, is_collapsed] :=
    *blocks_by_parent{ parent_id: $parent_id, block_id },
    *blocks{ block_id, content, order, is_collapsed, is_deleted: false }
:order order
```

### Get block by ID
```datalog
?[block_id, page_id, parent_id, content, order, content_type] :=
    *blocks{ block_id: $id, page_id, parent_id, content, order, content_type, is_deleted: false }
```

### Create block (with index maintenance)

Root-level blocks (no parent) use the sentinel key `"__page:<page_id>"` in `blocks_by_parent` because CozoDB composite keys cannot contain null values. The application layer computes the parent key before passing it as a parameter.

```typescript
// Application layer computes the parent key:
const parentKey = parentId ?? `__page:${pageId}`;
// Then passes parentKey as $parent_key param
```

```datalog
{
    ?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
        [$id, $page_id, $parent_id, $content, $content_type, $order, false, false, $now, $now]
    ]
    :put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }

    ?[page_id, block_id] <- [[$page_id, $id]]
    :put blocks_by_page { page_id, block_id }

    # $parent_key is either the parent block_id or "__page:<page_id>" for root blocks
    ?[parent_id, block_id] <- [[$parent_key, $id]]
    :put blocks_by_parent { parent_id, block_id }
}
```

### Update block content
```datalog
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks{ block_id: $id, page_id, parent_id, content_type, order, is_collapsed, is_deleted, created_at },
    content = $new_content,
    updated_at = $now
:put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }
```

## Reference and Link Queries

### Get backlinks for a block
```datalog
?[source_block_id, content, page_id] :=
    *block_refs{ target_block_id: $target, source_block_id },
    *blocks{ block_id: source_block_id, content, page_id, is_deleted: false }
```

### Get backlinks for a page (all blocks linking to this page)
```datalog
?[source_id, context_block_id, content] :=
    *links{ target_id: $page_id, source_id, context_block_id },
    *blocks{ block_id: context_block_id, content, is_deleted: false }
```

## Graph Queries

### Recursive tree expansion (N levels deep)
```datalog
subtree[block_id, parent_id, content, order, 0] :=
    *blocks_by_parent{ parent_id: $root, block_id },
    *blocks{ block_id, parent_id, content, order, is_deleted: false }
subtree[block_id, parent_id, content, order, depth] :=
    subtree[parent_block, _, _, _, prev_depth],
    prev_depth < $max_depth,
    *blocks_by_parent{ parent_id: parent_block, block_id },
    *blocks{ block_id, parent_id, content, order, is_deleted: false },
    depth = prev_depth + 1

?[block_id, parent_id, content, order, depth] := subtree[block_id, parent_id, content, order, depth]
:order depth, order
```

### PageRank across page links
```datalog
rank[node, score] <~ PageRank(*links[source_id, target_id])
?[page_id, title, score] :=
    rank[page_id, score],
    *pages{ page_id, title, is_deleted: false }
```

### 2-hop neighborhood from a page
```datalog
neighbor[target_id, 1] := *links{ source_id: $start, target_id }
neighbor[target_id, 2] := neighbor[mid, 1], *links{ source_id: mid, target_id }

?[page_id, title, hops] :=
    neighbor[page_id, hops],
    *pages{ page_id, title, is_deleted: false }
```

## Search

### Full-text search on blocks
```datalog
?[block_id, content, page_id, score] :=
    ~blocks:fts{ block_id, content | query: $query, k: $limit, bind_score: score },
    *blocks{ block_id, page_id, is_deleted: false }
:order -score
```

### Full-text search on page titles
```datalog
?[page_id, title, score] :=
    ~pages:fts{ page_id, title | query: $query, k: $limit, bind_score: score },
    *pages{ page_id, is_deleted: false }
:order -score
```

### Community detection (Louvain)
```datalog
community[node, group] <~ CommunityDetectionLouvain(*links[source_id, target_id])
?[page_id, title, community] :=
    community[page_id, community],
    *pages{ page_id, title, is_deleted: false }
```

### Link prediction (common neighbors)
```datalog
# Find pages that share many neighbors with the target page
shared[candidate, count(mid)] :=
    *links{ source_id: $page_id, target_id: mid },
    *links{ source_id: mid, target_id: candidate },
    candidate != $page_id,
    not *links{ source_id: $page_id, target_id: candidate }

?[page_id, title, shared_count] :=
    shared[page_id, shared_count],
    *pages{ page_id, title, is_deleted: false }
:order -shared_count
:limit $limit
```
## Tag Queries

### Get all entities with a specific tag
```datalog
?[entity_id] :=
    *tags{ entity_id, tag: $tag }
```

### Get pages by tag
```datalog
?[page_id, title] :=
    *tags{ entity_id: page_id, tag: $tag },
    *pages{ page_id, title, is_deleted: false }
```

## Daily Notes

### Get daily notes in a date range
```datalog
?[date, page_id, title] :=
    *daily_notes{ date, page_id },
    *pages{ page_id, title, is_deleted: false },
    date >= $start_date,
    date <= $end_date
:order date
```

### Get today's daily note
```datalog
?[page_id, title] :=
    *daily_notes{ date: $today, page_id },
    *pages{ page_id, title }
```

## Additional Operations

### Soft-delete a block
```datalog
{
    ?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
        *blocks{ block_id: $id, page_id, parent_id, content, content_type, order, is_collapsed, created_at },
        is_deleted = true,
        updated_at = $now
    :put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }
}
```

### Move a block (update parent + order + indexes)
```datalog
{
    # Update block's parent and order
    ?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
        *blocks{ block_id: $id, page_id, content, content_type, is_collapsed, is_deleted, created_at },
        parent_id = $new_parent_id,
        order = $new_order,
        updated_at = $now
    :put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }

    # Remove from old parent index
    ?[parent_id, block_id] <- [[$old_parent_key, $id]]
    :rm blocks_by_parent { parent_id, block_id }

    # Add to new parent index
    ?[parent_id, block_id] <- [[$new_parent_key, $id]]
    :put blocks_by_parent { parent_id, block_id }
}
```

### Get block history
```datalog
?[version, content, parent_id, order, is_collapsed, is_deleted, operation, timestamp] :=
    *block_history{ block_id: $id, version, content, parent_id, order, is_collapsed, is_deleted, operation, timestamp }
:order -version
:limit $limit
```

### Get outgoing links from a page
```datalog
?[target_id, title, link_type] :=
    *links{ source_id: $page_id, target_id, link_type },
    *pages{ page_id: target_id, title, is_deleted: false }
```

### Remove links originating from a block
```datalog
?[source_id, target_id, link_type] :=
    *links{ source_id, target_id, link_type, context_block_id: $block_id }
:rm links { source_id, target_id, link_type }
```

### Get all distinct tags
```datalog
?[tag, count(entity_id)] :=
    *tags{ entity_id, tag }
:order -count(entity_id)
```

### Add/remove a tag
```datalog
# Add tag
?[entity_id, tag, created_at] <- [[$entity_id, $tag, $now]]
:put tags { entity_id, tag, created_at }

# Remove tag
?[entity_id, tag] <- [[$entity_id, $tag]]
:rm tags { entity_id, tag }
```

### Set a property
```datalog
?[entity_id, key, value, value_type, updated_at] <- [[$entity_id, $key, $value, $value_type, $now]]
:put properties { entity_id, key, value, value_type, updated_at }
```

### Record block history snapshot
```datalog
?[block_id, version, content, parent_id, order, is_collapsed, is_deleted, operation, timestamp] <- [
    [$block_id, $version, $content, $parent_id, $order, $is_collapsed, $is_deleted, $operation, $now]
]
:put block_history { block_id, version, content, parent_id, order, is_collapsed, is_deleted, operation, timestamp }
```

## Repository ↔ Query Pattern Mapping

Each repository method maps to one or more query patterns defined above.

### PageRepository

| Method | Query Pattern | Section |
|--------|--------------|---------|
| `getById(pageId)` | Get page by ID | Page Operations |
| `getAll(options?)` | List all pages (non-deleted) | Page Operations |
| `search(query)` | Full-text search on page titles | Search |
| `create(input)` | Create page | Page Operations |
| `update(pageId, input)` | *Update page* (analogous to update block content) | — |
| `softDelete(pageId)` | *Soft-delete page* (analogous to soft-delete block) | — |
| `getByDailyNoteDate(date)` | Get today's daily note | Daily Notes |
| `getOrCreateDailyNote(date)` | Get today's daily note + Create page (conditional) | Daily Notes + Page Operations |

### BlockRepository

| Method | Query Pattern | Section |
|--------|--------------|---------|
| `getById(blockId)` | Get block by ID | Block Operations |
| `getByPage(pageId)` | Get all blocks for a page (via index) | Block Operations |
| `getChildren(parentKey)` | Get children of a block (via index) | Block Operations |
| `create(input)` | Create block (with index maintenance) | Block Operations |
| `update(blockId, input)` | Update block content | Block Operations |
| `softDelete(blockId)` | Soft-delete a block | Additional Operations |
| `move(blockId, ...)` | Move a block (update parent + order + indexes) | Additional Operations |
| `search(query)` | Full-text search on blocks | Search |
| `getHistory(blockId)` | Get block history | Additional Operations |

### LinkRepository

| Method | Query Pattern | Section |
|--------|--------------|---------|
| `getOutLinks(pageId)` | Get outgoing links from a page | Additional Operations |
| `getInLinks(pageId)` | Get backlinks for a page | Reference and Link Queries |
| `getBlockBacklinks(blockId)` | Get backlinks for a block | Reference and Link Queries |
| `createLink(link)` | *Put into links relation* | — |
| `createBlockRef(ref)` | *Put into block_refs relation* | — |
| `removeLinksFromBlock(blockId)` | Remove links originating from a block | Additional Operations |

### TagRepository

| Method | Query Pattern | Section |
|--------|--------------|---------|
| `getByEntity(entityId)` | *Filter tags by entity_id* | Tag Queries |
| `getByTag(tag)` | Get all entities with a specific tag | Tag Queries |
| `getAllTags()` | Get all distinct tags | Additional Operations |
| `addTag(entityId, tag)` | Add tag | Additional Operations |
| `removeTag(entityId, tag)` | Remove tag | Additional Operations |

### PropertyRepository

| Method | Query Pattern | Section |
|--------|--------------|---------|
| `getByEntity(entityId)` | *Filter properties by entity_id* | — |
| `set(entityId, key, value)` | Set a property | Additional Operations |
| `remove(entityId, key)` | *Rm from properties relation* | — |

*Italicized* entries follow the same patterns as documented queries but with different relation/column names. They are trivial `:put` / `:rm` / filter operations.

## Query Syntax Notes

All queries target CozoDB 0.7 syntax. Key patterns:
- `*relation{ key: $param }` for parameterized lookups
- `:=` for Horn clause rules, `<~` for algorithm invocations
- `~relation:fts{ ... }` for full-text search
- `{ }` braces group multiple statements into a single atomic transaction
