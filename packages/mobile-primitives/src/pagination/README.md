# Pagination

Cursor-based pagination utilities for efficient query result handling in mobile applications.

## Features

- **Cursor-based pagination**: Memory-efficient incremental loading
- **Configurable page size**: Customize page size with safety limits
- **React hooks**: Easy integration with React/React Native components
- **Infinite scroll**: Automatic loading on scroll with `useInfiniteScroll`
- **CozoDB query helpers**: Build paginated Datalog queries
- **Error handling**: Built-in retry and error state management

## Quick Start

### Basic Usage with usePaginatedQuery

```typescript
import { usePaginatedQuery } from '@double-bind/mobile-primitives/pagination';

function PageList() {
  const query = usePaginatedQuery(
    async ({ pageSize, cursor }) => {
      // Fetch a page of results
      const result = await pageRepository.getAll({
        limit: pageSize,
        offset: cursor ? parseInt(cursor) : 0
      });

      return {
        items: result,
        nextCursor: result.length === pageSize ? String(result.length) : null,
        hasMore: result.length === pageSize,
        pageSize,
        totalCount: null
      };
    },
    { pageSize: 20 }
  );

  return (
    <View>
      {query.items.map(item => (
        <Text key={item.id}>{item.title}</Text>
      ))}
      {query.loading && <ActivityIndicator />}
      {query.hasMore && (
        <Button onPress={() => query.fetchNextPage()} title="Load More" />
      )}
    </View>
  );
}
```

### Infinite Scroll (Web)

```typescript
import { usePaginatedQuery, useInfiniteScroll } from '@double-bind/mobile-primitives/pagination';

function InfinitePageList() {
  const query = usePaginatedQuery(fetcher);
  const scrollRef = useInfiniteScroll(query, {
    threshold: 0.8, // Load when 80% scrolled
    enabled: true
  });

  return (
    <div ref={scrollRef} style={{ height: '400px', overflow: 'auto' }}>
      {query.items.map(item => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  );
}
```

### Infinite Scroll (React Native)

```typescript
import { usePaginatedQuery, useScrollMonitor } from '@double-bind/mobile-primitives/pagination';
import { ScrollView } from 'react-native';

function InfinitePageList() {
  const query = usePaginatedQuery(fetcher);
  const handleScroll = useScrollMonitor(query, { threshold: 0.8 });

  return (
    <ScrollView onScroll={handleScroll} scrollEventThrottle={400}>
      {query.items.map(item => (
        <Text key={item.id}>{item.title}</Text>
      ))}
      {query.loading && <ActivityIndicator />}
    </ScrollView>
  );
}
```

### CozoDB Query Helpers

```typescript
import {
  buildPaginatedQuery,
  extractPaginatedResult,
  createPageFetcher
} from '@double-bind/mobile-primitives/pagination';

// Build a paginated Datalog query
const query = buildPaginatedQuery({
  baseQuery: `
    ?[page_id, title, updated_at] :=
      *pages{ page_id, title, updated_at, is_deleted },
      is_deleted == false
  `,
  cursorColumn: 'updated_at',
  sortOrder: 'desc',
  pageSize: 20,
  cursor: lastCursor
});

// Execute and extract results
const result = await db.query(query, { cursor: lastCursor });
const paginated = extractPaginatedResult(result.rows, 2, 20);

// Or create a reusable fetcher
const fetcher = createPageFetcher(
  (options) => buildPaginatedQuery({
    baseQuery: '...',
    cursorColumn: 'updated_at',
    ...options
  }),
  (query, params) => db.query(query, params),
  2 // cursor column index
);
```

## API Reference

### usePaginatedQuery

```typescript
function usePaginatedQuery<T>(
  fetcher: PageFetcher<T>,
  options?: PaginationOptions
): PaginatedQuery<T>
```

**Options:**
- `pageSize` (number): Items per page (default: 20)
- `cursor` (string): Initial cursor position

**Returns:**
- `items` (T[]): All loaded items
- `loading` (boolean): Whether currently fetching
- `error` (Error | null): Last fetch error
- `hasMore` (boolean): Whether more pages available
- `cursor` (string | null): Current cursor
- `loadedCount` (number): Total items loaded
- `isInitialLoad` (boolean): Whether this is the first load
- `fetchNextPage()`: Load next page
- `reset()`: Reset to first page
- `refresh()`: Re-fetch from start
- `retry()`: Retry after error

### buildPaginatedQuery

```typescript
function buildPaginatedQuery(options: BuildPaginatedQueryOptions): string
```

Builds a CozoDB Datalog query with cursor-based pagination.

**Options:**
- `baseQuery` (string): Base Datalog query without pagination
- `cursorColumn` (string): Column name for cursor
- `sortOrder` ('asc' | 'desc'): Sort direction (default: 'desc')
- `pageSize` (number): Page size (default: 20, max: 100)
- `cursor` (string): Cursor value for next page

### extractPaginatedResult

```typescript
function extractPaginatedResult<T>(
  rows: unknown[][],
  cursorColumnIndex: number,
  pageSize: number
): PaginatedResult<T>
```

Extracts pagination information from query results.

## Performance Considerations

- **Memory efficiency**: Only loads what's displayed, not entire dataset
- **Cursor vs offset**: Cursor-based pagination is more efficient for large datasets
- **Page size limits**: Max 100 items per page to prevent memory issues
- **Scroll throttling**: Use `scrollEventThrottle={400}` on React Native ScrollViews

## Examples

See the test files for comprehensive examples:
- `test/pagination/queryHelpers.test.ts` - CozoDB query helpers
- `test/pagination/usePaginatedQuery.test.ts` - React hook usage
