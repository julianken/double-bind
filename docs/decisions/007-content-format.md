# ADR-007: Plain Text with Lightweight Markers

## Status
Accepted

## Context

Block content needs a storage format. The format determines how `[[page links]]`, `((block refs))`, `#tags`, and text formatting are stored and parsed.

## Options Considered

### 1. Rich structured data (JSON AST)
- Store ProseMirror document JSON directly
- Pros: No parsing needed for rendering, exact editor state preserved
- Cons: Opaque to FTS, hard to query, large storage, locked to ProseMirror

### 2. Markdown
- Pros: Universal, human-readable, good tooling
- Cons: Ambiguous parsing (many dialects), complex to parse correctly, overkill for individual blocks

### 3. Plain text with lightweight markers
- Store: `This links to [[Page Name]] and refs ((block_id)) with #tag`
- Pros: Human-readable, FTS-friendly, simple to parse, portable
- Cons: Must define and parse custom markers, no rich formatting stored in content

## Decision

Plain text with lightweight markers.

## Consequences

- Blocks stored as plain strings, searchable by CozoDB's FTS
- Content parsing extracts `[[links]]`, `((refs))`, `#tags` at write time and stores them in dedicated relations
- ProseMirror renders markers as decorations (styled inline elements)
- Format is portable — export to markdown is trivial
- Rich formatting (bold, italic, code) uses standard markdown-style markers within the plain text

<!-- TODO: Define the exact marker syntax -->
<!-- TODO: Document the content parsing pipeline -->
<!-- TODO: Define how formatting markers (bold, italic) work -->
