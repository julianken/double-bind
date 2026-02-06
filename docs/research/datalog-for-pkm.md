# Contribution 1: Datalog as User-Facing Query Language for PKM

## Thesis

Datalog — a declarative logic programming language — can serve as a practical user-facing query language for personal knowledge management, offering expressive power over graph-structured notes that SQL cannot match, while remaining learnable through progressive disclosure from templates to visual builders to raw queries.

## Prior Art

### Existing Query Approaches in PKM Tools

| Tool | Query System | Limitations |
|------|-------------|-------------|
| Roam Research | Custom filter UI + basic queries | Limited to block-level filtering, no joins, no graph traversal |
| Logseq | Datalog (via DataScript/Datascript) | Exposes Datomic-style Datalog, but no progressive disclosure — users face raw syntax or nothing |
| Obsidian | Dataview plugin (custom query language) | SQL-like, page-level only, no recursive graph queries |
| Notion | Database filters | Flat table queries, no graph awareness |
| Athens Research | Datalog (DataScript) | Similar to Logseq, project discontinued |

### Key Insight

Logseq proves Datalog can work in PKM. But Logseq's implementation is binary: you either write raw Datomic-style Datalog or you use basic filters. There's no middle ground. Most users never write Datalog queries.

## Technical Approach

### Progressive Disclosure (3 Levels)

#### Level 1: Query Templates

Pre-built queries with fill-in-the-blank parameters:

```
"Find pages tagged with [___] modified in the last [___] days"
↓ generates
?[page_id, title] :=
  *tags{ entity_id: page_id, tag: $tag },
  *pages{ page_id, title, updated_at, is_deleted: false },
  updated_at > $cutoff
```

Users select from a library of templates. No syntax knowledge needed.

#### Level 2: Visual Query Builder

Drag-and-drop query construction:

```
┌─────────────────────────────────────┐
│ Find: [Pages ▼]                     │
│ Where:                              │
│   [title ▼] [contains ▼] [___]     │
│   AND                               │
│   [has tag ▼] [equals ▼] [___]     │
│ Show: [title] [created_at]          │
│ Sort by: [created_at ▼] [desc ▼]   │
│                                     │
│ [Preview CozoScript] [Run Query]    │
└─────────────────────────────────────┘
```

The visual builder generates valid CozoScript visible to the user. Users can inspect the generated query and learn the syntax.

#### Level 3: Raw CozoScript Editor

Full Datalog editor with:
- Syntax highlighting
- Autocomplete (relation names, column names)
- Inline documentation
- Error messages with suggestions
- Query explain visualization

### What Datalog Enables That SQL Cannot

| Capability | Datalog | SQL |
|-----------|---------|-----|
| Recursive graph traversal | Native (rules) | Requires CTEs (verbose, hard to read) |
| Pattern matching on graph | Natural | Requires multiple JOINs |
| Built-in graph algorithms | `<~ PageRank(...)` | External library or UDF |
| Rule composition | Rules reference rules | Subqueries/views (less composable) |
| Bidirectional links | One rule | UNION of two JOINs |

Example: "Find all pages reachable within 3 hops from my current page"

```datalog
reachable[target, 1] := *links{ source_id: $start, target_id: target }
reachable[target, n+1] := reachable[mid, n], n < 3, *links{ source_id: mid, target_id: target }
?[page_id, title, hops] := reachable[page_id, hops], *pages{ page_id, title }
```

The SQL equivalent would require a recursive CTE that's much harder to read and modify.

### Saved Queries as Dynamic Views

Users can save queries and pin them to the sidebar. These become live views that update as the knowledge base changes:

- "Orphan pages" (pages with no inlinks)
- "Recent meeting notes" (tagged #meeting, last 7 days)
- "Bridge pages" (high betweenness centrality)
- "Reading list" (tagged #toread, not tagged #done)

## Evaluation Criteria

1. **Expressiveness**: Can users answer questions about their notes that other tools cannot?
   - Graph traversal queries (multi-hop)
   - Aggregate queries (most-linked pages, tag frequency)
   - Algorithm queries (PageRank, clusters)

2. **Learnability**: Can non-technical users start with templates and progress to raw Datalog?
   - Measure: time to first successful custom query
   - Measure: progression through levels (what % reach Level 3?)

3. **Performance**: Are queries fast enough for interactive use?
   - Target: <100ms for typical queries on 10,000-page knowledge base
   - Target: <1s for graph algorithm queries

4. **Utility**: Do saved queries actually help users manage knowledge?
   - Qualitative: do users create and use saved queries?
   - Qualitative: do users discover unexpected connections?

## Differences from Logseq's Approach

| Aspect | Logseq | Double-Bind |
|--------|--------|-------------|
| Datalog dialect | Datomic-style (entity-attribute-value) | CozoScript (relation-based) |
| Progressive disclosure | None (raw syntax only) | Templates → Visual builder → Raw |
| Graph algorithms | None built-in | CozoDB built-in (PageRank, etc.) |
| Query results | Inline in page | Dedicated query view with tables/graphs |
| Saved queries | Basic | First-class feature, sidebar-pinnable |
| FTS integration | Separate search | Unified with Datalog (`~relation:fts`) |

## Open Questions

<!-- TODO: Design the template library (which queries are most useful?) -->
<!-- TODO: Design the visual query builder UI -->
<!-- TODO: Define the CozoScript subset exposed at Level 2 -->
<!-- TODO: Define error message mapping (CozoDB errors → user-friendly messages) -->
<!-- TODO: Evaluate whether a Datalog tutorial system (interactive lessons) is worth building -->
<!-- TODO: Study Logseq's query usage patterns (what queries do power users write?) -->
<!-- TODO: Define query sharing/export format -->
