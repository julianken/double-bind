/**
 * VisualQueryBuilder - Form-based UI for constructing queries without writing code.
 *
 * This component implements Level 2 of the progressive disclosure query system
 * (CS Contribution #1). Users can:
 * - Select relations (pages, blocks, links, tags)
 * - Add filter rows with field/operator/value
 * - Combine conditions with AND/OR logic
 * - Preview generated CozoScript in real-time
 *
 * The builder outputs a QueryAST that can be transpiled to CozoScript.
 *
 * @see docs/database/progressive-disclosure.md
 */

import { useCallback, useMemo, useState, useId, memo, useEffect, useRef } from 'react';
import type {
  QueryAST,
  QueryType,
  QueryableRelation,
  Filter,
  FilterOperator,
  FilterGroupOperator,
  FilterValue,
  CompiledQuery,
} from '@double-bind/query-lang';
import {
  RELATION_COLUMNS,
  DEFAULT_PROJECTIONS,
  transpileToCozo,
  isQueryableRelation,
} from '@double-bind/query-lang';

// ============================================================================
// Types
// ============================================================================

/**
 * A filter row in the visual builder UI
 */
export interface FilterRow {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

/**
 * A group of filters with a logical operator
 */
export interface FilterGroupRow {
  id: string;
  operator: FilterGroupOperator;
  filters: FilterRow[];
}

export interface VisualQueryBuilderProps {
  /** Initial QueryAST to populate the builder (optional) */
  initialAST?: QueryAST;

  /** Callback when the query changes (valid or invalid) */
  onChange?: (ast: QueryAST | null, compiled: CompiledQuery | null, error: string | null) => void;

  /** Callback when user submits the query */
  onSubmit?: (ast: QueryAST, compiled: CompiledQuery) => void;

  /** Whether to show the CozoScript preview */
  showPreview?: boolean;

  /** Whether to show the submit button */
  showSubmitButton?: boolean;

  /** Custom class name for styling */
  className?: string;

  /** Accessible label for the form */
  'aria-label'?: string;
}

// ============================================================================
// Constants
// ============================================================================

const QUERYABLE_RELATIONS: { value: QueryableRelation; label: string }[] = [
  { value: 'pages', label: 'Pages' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'links', label: 'Links' },
  { value: 'tags', label: 'Tags' },
  { value: 'properties', label: 'Properties' },
  { value: 'block_refs', label: 'Block References' },
  { value: 'daily_notes', label: 'Daily Notes' },
];

const QUERY_TYPES: { value: QueryType; label: string }[] = [
  { value: 'find', label: 'Find' },
  { value: 'count', label: 'Count' },
  { value: 'graph', label: 'Graph' },
];

interface OperatorInfo {
  value: FilterOperator;
  label: string;
  requiresValue: boolean;
  valueType: 'string' | 'number' | 'boolean' | 'none';
}

const FILTER_OPERATORS: OperatorInfo[] = [
  { value: 'equals', label: 'equals', requiresValue: true, valueType: 'string' },
  { value: 'notEquals', label: 'not equals', requiresValue: true, valueType: 'string' },
  { value: 'contains', label: 'contains', requiresValue: true, valueType: 'string' },
  { value: 'startsWith', label: 'starts with', requiresValue: true, valueType: 'string' },
  { value: 'endsWith', label: 'ends with', requiresValue: true, valueType: 'string' },
  { value: 'greaterThan', label: 'greater than', requiresValue: true, valueType: 'number' },
  { value: 'lessThan', label: 'less than', requiresValue: true, valueType: 'number' },
  {
    value: 'greaterThanOrEqual',
    label: 'greater than or equal',
    requiresValue: true,
    valueType: 'number',
  },
  {
    value: 'lessThanOrEqual',
    label: 'less than or equal',
    requiresValue: true,
    valueType: 'number',
  },
  { value: 'isNull', label: 'is null', requiresValue: false, valueType: 'none' },
  { value: 'isNotNull', label: 'is not null', requiresValue: false, valueType: 'none' },
  { value: 'hasTag', label: 'has tag', requiresValue: true, valueType: 'string' },
  { value: 'linkedTo', label: 'links to', requiresValue: true, valueType: 'string' },
  { value: 'linkedFrom', label: 'linked from', requiresValue: true, valueType: 'string' },
  { value: 'hasProperty', label: 'has property', requiresValue: true, valueType: 'string' },
];

const GROUP_OPERATORS: { value: FilterGroupOperator; label: string }[] = [
  { value: 'and', label: 'AND' },
  { value: 'or', label: 'OR' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyFilter(): FilterRow {
  return {
    id: generateId(),
    field: '',
    operator: 'contains',
    value: '',
  };
}

function createEmptyFilterGroup(operator: FilterGroupOperator = 'and'): FilterGroupRow {
  return {
    id: generateId(),
    operator,
    filters: [createEmptyFilter()],
  };
}

function parseFilterValue(value: string, operator: FilterOperator): FilterValue {
  const operatorInfo = FILTER_OPERATORS.find((op) => op.value === operator);
  if (!operatorInfo?.requiresValue) {
    return null;
  }

  if (operatorInfo.valueType === 'number') {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : value;
  }

  if (operatorInfo.valueType === 'boolean') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    return value;
  }

  return value;
}

function filterRowToFilter(row: FilterRow): Filter | null {
  if (!row.field) return null;

  const operatorInfo = FILTER_OPERATORS.find((op) => op.value === row.operator);
  if (operatorInfo?.requiresValue && !row.value) return null;

  return {
    field: row.field,
    operator: row.operator,
    value: parseFilterValue(row.value, row.operator),
  };
}

function buildAST(
  queryType: QueryType,
  relation: QueryableRelation,
  filterGroups: FilterGroupRow[],
  limit?: number,
  offset?: number
): QueryAST | null {
  // Convert filter rows to Filter objects
  const filters: Filter[] = [];

  for (const group of filterGroups) {
    for (const row of group.filters) {
      const filter = filterRowToFilter(row);
      if (filter) {
        filters.push(filter);
      }
    }
  }

  // Get default projections for the relation
  const projections = [...(DEFAULT_PROJECTIONS[relation] ?? [])];

  const ast: QueryAST = {
    type: queryType,
    relation,
    filters,
    projections,
    metadata: {
      level: 2,
      createdAt: Date.now(),
    },
  };

  if (limit !== undefined && limit > 0) {
    ast.limit = limit;
  }

  if (offset !== undefined && offset > 0) {
    ast.offset = offset;
  }

  return ast;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface FilterRowEditorProps {
  row: FilterRow;
  relation: QueryableRelation;
  onUpdate: (id: string, updates: Partial<FilterRow>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

const FilterRowEditor = memo(function FilterRowEditor({
  row,
  relation,
  onUpdate,
  onRemove,
  canRemove,
}: FilterRowEditorProps) {
  const columns = RELATION_COLUMNS[relation] ?? [];
  const operatorInfo = FILTER_OPERATORS.find((op) => op.value === row.operator);
  const showValueInput = operatorInfo?.requiresValue ?? true;

  const handleFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdate(row.id, { field: e.target.value });
    },
    [row.id, onUpdate]
  );

  const handleOperatorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdate(row.id, { operator: e.target.value as FilterOperator });
    },
    [row.id, onUpdate]
  );

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(row.id, { value: e.target.value });
    },
    [row.id, onUpdate]
  );

  const handleRemove = useCallback(() => {
    onRemove(row.id);
  }, [row.id, onRemove]);

  return (
    <div
      className="filter-row"
      data-testid={`filter-row-${row.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
      }}
    >
      <select
        value={row.field}
        onChange={handleFieldChange}
        aria-label="Field"
        data-testid={`filter-field-${row.id}`}
        style={{
          padding: '6px 8px',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          minWidth: '140px',
        }}
      >
        <option value="">Select field...</option>
        {columns.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      </select>

      <select
        value={row.operator}
        onChange={handleOperatorChange}
        aria-label="Operator"
        data-testid={`filter-operator-${row.id}`}
        style={{
          padding: '6px 8px',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          minWidth: '140px',
        }}
      >
        {FILTER_OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {showValueInput && (
        <input
          type={operatorInfo?.valueType === 'number' ? 'number' : 'text'}
          value={row.value}
          onChange={handleValueChange}
          placeholder="Value..."
          aria-label="Value"
          data-testid={`filter-value-${row.id}`}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            flex: 1,
            minWidth: '120px',
          }}
        />
      )}

      {canRemove && (
        <button
          type="button"
          onClick={handleRemove}
          aria-label="Remove filter"
          data-testid={`filter-remove-${row.id}`}
          style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
});

interface FilterGroupEditorProps {
  group: FilterGroupRow;
  relation: QueryableRelation;
  onUpdateOperator: (id: string, operator: FilterGroupOperator) => void;
  onUpdateFilter: (groupId: string, filterId: string, updates: Partial<FilterRow>) => void;
  onRemoveFilter: (groupId: string, filterId: string) => void;
  onAddFilter: (groupId: string) => void;
  onRemoveGroup: (id: string) => void;
  canRemoveGroup: boolean;
  groupIndex: number;
}

const FilterGroupEditor = memo(function FilterGroupEditor({
  group,
  relation,
  onUpdateOperator,
  onUpdateFilter,
  onRemoveFilter,
  onAddFilter,
  onRemoveGroup,
  canRemoveGroup,
  groupIndex,
}: FilterGroupEditorProps) {
  const handleOperatorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdateOperator(group.id, e.target.value as FilterGroupOperator);
    },
    [group.id, onUpdateOperator]
  );

  const handleAddFilter = useCallback(() => {
    onAddFilter(group.id);
  }, [group.id, onAddFilter]);

  const handleRemoveGroup = useCallback(() => {
    onRemoveGroup(group.id);
  }, [group.id, onRemoveGroup]);

  const handleUpdateFilter = useCallback(
    (filterId: string, updates: Partial<FilterRow>) => {
      onUpdateFilter(group.id, filterId, updates);
    },
    [group.id, onUpdateFilter]
  );

  const handleRemoveFilter = useCallback(
    (filterId: string) => {
      onRemoveFilter(group.id, filterId);
    },
    [group.id, onRemoveFilter]
  );

  return (
    <div
      className="filter-group"
      data-testid={`filter-group-${group.id}`}
      style={{
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        marginBottom: '12px',
      }}
    >
      <div
        className="filter-group-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        {groupIndex > 0 && (
          <select
            value={group.operator}
            onChange={handleOperatorChange}
            aria-label="Group operator"
            data-testid={`group-operator-${group.id}`}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontWeight: 600,
            }}
          >
            {GROUP_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        )}
        <span
          style={{
            fontWeight: 600,
            color: '#374151',
          }}
        >
          {groupIndex === 0 ? 'Where' : ''}
        </span>
        {canRemoveGroup && (
          <button
            type="button"
            onClick={handleRemoveGroup}
            aria-label="Remove filter group"
            data-testid={`group-remove-${group.id}`}
            style={{
              marginLeft: 'auto',
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Remove Group
          </button>
        )}
      </div>

      <div className="filter-group-filters">
        {group.filters.map((filterRow, filterIndex) => (
          <div key={filterRow.id}>
            {filterIndex > 0 && (
              <div
                style={{
                  paddingLeft: '12px',
                  color: '#6b7280',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {group.operator}
              </div>
            )}
            <FilterRowEditor
              row={filterRow}
              relation={relation}
              onUpdate={handleUpdateFilter}
              onRemove={handleRemoveFilter}
              canRemove={group.filters.length > 1}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddFilter}
        aria-label="Add filter condition"
        data-testid={`group-add-filter-${group.id}`}
        style={{
          marginTop: '8px',
          padding: '6px 12px',
          borderRadius: '4px',
          border: '1px dashed #9ca3af',
          backgroundColor: 'transparent',
          color: '#6b7280',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        + Add Condition
      </button>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export function VisualQueryBuilder({
  initialAST,
  onChange,
  onSubmit,
  showPreview = true,
  showSubmitButton = true,
  className,
  'aria-label': ariaLabel = 'Visual query builder',
}: VisualQueryBuilderProps) {
  const formId = useId();

  // State
  const [queryType, setQueryType] = useState<QueryType>(initialAST?.type ?? 'find');
  const [relation, setRelation] = useState<QueryableRelation>(
    isQueryableRelation(initialAST?.relation) ? initialAST.relation : 'pages'
  );
  const [filterGroups, setFilterGroups] = useState<FilterGroupRow[]>(() => {
    if (initialAST?.filters && initialAST.filters.length > 0) {
      return [
        {
          id: generateId(),
          operator: 'and',
          filters: initialAST.filters.map((f) => ({
            id: generateId(),
            field: f.field,
            operator: f.operator,
            value: String(f.value ?? ''),
          })),
        },
      ];
    }
    return [createEmptyFilterGroup()];
  });
  const [limit, setLimit] = useState<string>(initialAST?.limit?.toString() ?? '');
  const [offset, setOffset] = useState<string>(initialAST?.offset?.toString() ?? '');

  // Build AST and compile to CozoScript
  const { ast, compiled, error } = useMemo(() => {
    try {
      const newAST = buildAST(
        queryType,
        relation,
        filterGroups,
        limit ? parseInt(limit, 10) : undefined,
        offset ? parseInt(offset, 10) : undefined
      );

      if (!newAST) {
        return { ast: null, compiled: null, error: 'Invalid query configuration' };
      }

      const compiledQuery = transpileToCozo(newAST);
      return { ast: newAST, compiled: compiledQuery, error: null };
    } catch (err) {
      return {
        ast: null,
        compiled: null,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, [queryType, relation, filterGroups, limit, offset]);

  // Notify parent of changes
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (onChangeRef.current) {
      onChangeRef.current(ast, compiled, error);
    }
  }, [ast, compiled, error]);

  // Handlers
  const handleQueryTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setQueryType(e.target.value as QueryType);
  }, []);

  const handleRelationChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRelation = e.target.value as QueryableRelation;
    setRelation(newRelation);
    // Reset filter fields when relation changes
    setFilterGroups([createEmptyFilterGroup()]);
  }, []);

  const handleLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLimit(e.target.value);
  }, []);

  const handleOffsetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOffset(e.target.value);
  }, []);

  const handleUpdateGroupOperator = useCallback(
    (groupId: string, operator: FilterGroupOperator) => {
      setFilterGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, operator } : g)));
    },
    []
  );

  const handleUpdateFilter = useCallback(
    (groupId: string, filterId: string, updates: Partial<FilterRow>) => {
      setFilterGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                filters: g.filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
              }
            : g
        )
      );
    },
    []
  );

  const handleRemoveFilter = useCallback((groupId: string, filterId: string) => {
    setFilterGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              filters: g.filters.filter((f) => f.id !== filterId),
            }
          : g
      )
    );
  }, []);

  const handleAddFilter = useCallback((groupId: string) => {
    setFilterGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              filters: [...g.filters, createEmptyFilter()],
            }
          : g
      )
    );
  }, []);

  const handleRemoveGroup = useCallback((groupId: string) => {
    setFilterGroups((prev) => prev.filter((g) => g.id !== groupId));
  }, []);

  const handleAddGroup = useCallback(() => {
    setFilterGroups((prev) => [...prev, createEmptyFilterGroup('and')]);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (ast && compiled && onSubmit) {
        onSubmit(ast, compiled);
      }
    },
    [ast, compiled, onSubmit]
  );

  return (
    <form
      id={formId}
      className={`visual-query-builder ${className ?? ''}`}
      onSubmit={handleSubmit}
      aria-label={ariaLabel}
      data-testid="visual-query-builder"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    >
      {/* Query Type and Relation Row */}
      <div
        className="query-type-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <select
          value={queryType}
          onChange={handleQueryTypeChange}
          aria-label="Query type"
          data-testid="query-type-select"
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {QUERY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <select
          value={relation}
          onChange={handleRelationChange}
          aria-label="Relation"
          data-testid="relation-select"
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
          }}
        >
          {QUERYABLE_RELATIONS.map((rel) => (
            <option key={rel.value} value={rel.value}>
              {rel.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filter Groups */}
      <div className="filter-groups" data-testid="filter-groups">
        {filterGroups.map((group, index) => (
          <FilterGroupEditor
            key={group.id}
            group={group}
            relation={relation}
            groupIndex={index}
            onUpdateOperator={handleUpdateGroupOperator}
            onUpdateFilter={handleUpdateFilter}
            onRemoveFilter={handleRemoveFilter}
            onAddFilter={handleAddFilter}
            onRemoveGroup={handleRemoveGroup}
            canRemoveGroup={filterGroups.length > 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddGroup}
        aria-label="Add filter group"
        data-testid="add-filter-group"
        style={{
          padding: '8px 16px',
          borderRadius: '4px',
          border: '1px dashed #6b7280',
          backgroundColor: 'transparent',
          color: '#6b7280',
          cursor: 'pointer',
          fontSize: '14px',
          alignSelf: 'flex-start',
        }}
      >
        + Add Filter Group
      </button>

      {/* Limit and Offset */}
      <div
        className="pagination-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor={`${formId}-limit`} style={{ fontSize: '14px', color: '#374151' }}>
            Limit:
          </label>
          <input
            id={`${formId}-limit`}
            type="number"
            value={limit}
            onChange={handleLimitChange}
            placeholder="No limit"
            min={0}
            data-testid="limit-input"
            style={{
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              width: '80px',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor={`${formId}-offset`} style={{ fontSize: '14px', color: '#374151' }}>
            Offset:
          </label>
          <input
            id={`${formId}-offset`}
            type="number"
            value={offset}
            onChange={handleOffsetChange}
            placeholder="0"
            min={0}
            data-testid="offset-input"
            style={{
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              width: '80px',
            }}
          />
        </div>
      </div>

      {/* CozoScript Preview */}
      {showPreview && (
        <div
          className="query-preview"
          data-testid="query-preview"
          style={{
            padding: '12px',
            backgroundColor: '#1f2937',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#f3f4f6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: '200px',
            overflow: 'auto',
          }}
        >
          {error ? (
            <span style={{ color: '#fca5a5' }} data-testid="preview-error">
              Error: {error}
            </span>
          ) : compiled ? (
            <>
              <div data-testid="preview-script">{compiled.script}</div>
              {Object.keys(compiled.params).length > 0 && (
                <div style={{ marginTop: '8px', color: '#9ca3af' }} data-testid="preview-params">
                  Parameters: {JSON.stringify(compiled.params, null, 2)}
                </div>
              )}
            </>
          ) : (
            <span style={{ color: '#9ca3af' }}>No query</span>
          )}
        </div>
      )}

      {/* Submit Button */}
      {showSubmitButton && (
        <button
          type="submit"
          disabled={!ast || !!error}
          aria-label="Run query"
          data-testid="submit-query"
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: ast && !error ? '#3b82f6' : '#9ca3af',
            color: '#fff',
            cursor: ast && !error ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 600,
            alignSelf: 'flex-end',
          }}
        >
          Run Query
        </button>
      )}
    </form>
  );
}

export default VisualQueryBuilder;
