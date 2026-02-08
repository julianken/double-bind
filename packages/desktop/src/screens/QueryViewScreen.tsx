/**
 * QueryViewScreen - Full-featured Datalog query editor with visual builder mode.
 *
 * Features:
 * - Mode toggle between Visual Builder and Raw Datalog
 * - Split pane layout (editor on left, results on right)
 * - Execute button that runs queries through GraphDB
 * - Save/Load functionality for queries
 * - Query history panel
 *
 * Accessible via Ctrl+Q keyboard shortcut.
 */

import { useState, useCallback, useMemo, useContext } from 'react';
import type { SavedQuery, QueryResult } from '@double-bind/types';
import { SavedQueryType } from '@double-bind/types';
import type { CompiledQuery, QueryAST } from '@double-bind/query-lang';
import { transpileToCozo } from '@double-bind/query-lang';
import { VisualQueryBuilder } from '../components/VisualQueryBuilder.js';
import { CodeMirrorEditor } from '../components/CodeMirrorEditor.js';
import { QueryResultTable } from '../components/QueryResultTable.js';
import { SavedQueriesList } from '../components/SavedQueriesList.js';
import { QueryHistoryPanel } from '../components/QueryHistoryPanel.js';
import { ServiceContext } from '../providers/ServiceProvider.js';
import { useQueryHistoryStore } from '../stores/query-history-store.js';
import { useAppStore } from '../stores/ui-store.js';
import { invalidateQueries } from '../hooks/useCozoQuery.js';
import type { RouteComponentProps } from '../components/Router.js';
import type { NavigationTarget } from '../components/QueryResultTable.js';

// ============================================================================
// Types
// ============================================================================

/** Query editor mode */
type EditorMode = 'visual' | 'raw';

/** Panel visibility state */
type SidePanelView = 'saved' | 'history' | null;

/** Props for QueryViewScreen */
export type QueryViewScreenProps = RouteComponentProps;

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color, #e5e7eb)',
    backgroundColor: 'var(--bg-secondary, #f9fafb)',
    flexShrink: 0,
  },
  toolbarGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modeButton: (isActive: boolean) => ({
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid var(--border-color, #d1d5db)',
    backgroundColor: isActive ? 'var(--color-primary, #3b82f6)' : 'var(--bg-primary, white)',
    color: isActive ? 'white' : 'var(--text-primary, #374151)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
    transition: 'all 0.15s ease',
  }),
  executeButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--color-success, #22c55e)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  executeButtonDisabled: {
    backgroundColor: 'var(--color-muted, #9ca3af)',
    cursor: 'not-allowed',
  },
  saveButton: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid var(--border-color, #d1d5db)',
    backgroundColor: 'var(--bg-primary, white)',
    color: 'var(--text-primary, #374151)',
    cursor: 'pointer',
    fontSize: '13px',
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidePanel: {
    width: '280px',
    borderRight: '1px solid var(--border-color, #e5e7eb)',
    backgroundColor: 'var(--bg-secondary, #f9fafb)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    flexShrink: 0,
  },
  sidePanelTabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border-color, #e5e7eb)',
    flexShrink: 0,
  },
  sidePanelTab: (isActive: boolean) => ({
    flex: 1,
    padding: '10px 12px',
    border: 'none',
    backgroundColor: isActive ? 'var(--bg-primary, white)' : 'transparent',
    color: isActive ? 'var(--text-primary, #374151)' : 'var(--text-muted, #6b7280)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
    borderBottom: isActive ? '2px solid var(--color-primary, #3b82f6)' : '2px solid transparent',
  }),
  sidePanelContent: {
    flex: 1,
    overflow: 'auto',
  },
  editorPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    minWidth: 0,
  },
  editorContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  resultsPane: {
    width: '50%',
    borderLeft: '1px solid var(--border-color, #e5e7eb)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    flexShrink: 0,
    minWidth: '300px',
  },
  resultsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color, #e5e7eb)',
    backgroundColor: 'var(--bg-secondary, #f9fafb)',
    flexShrink: 0,
  },
  resultsTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary, #374151)',
  },
  resultsStats: {
    fontSize: '12px',
    color: 'var(--text-muted, #6b7280)',
  },
  resultsContent: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  errorMessage: {
    padding: '16px',
    backgroundColor: 'var(--color-error-bg, #fef2f2)',
    color: 'var(--color-error, #dc2626)',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted, #6b7280)',
    fontSize: '14px',
    textAlign: 'center' as const,
    padding: '24px',
  },
  saveModal: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  saveModalContent: {
    backgroundColor: 'var(--bg-primary, white)',
    borderRadius: '8px',
    padding: '24px',
    width: '400px',
    maxWidth: '90vw',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  saveModalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
    color: 'var(--text-primary, #374151)',
  },
  formGroup: {
    marginBottom: '16px',
  },
  formLabel: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary, #374151)',
  },
  formInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid var(--border-color, #d1d5db)',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  },
  formTextarea: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid var(--border-color, #d1d5db)',
    fontSize: '14px',
    resize: 'vertical' as const,
    minHeight: '60px',
    boxSizing: 'border-box' as const,
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '20px',
  },
  modalButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1px solid var(--border-color, #d1d5db)',
    backgroundColor: 'var(--bg-primary, white)',
    color: 'var(--text-primary, #374151)',
    cursor: 'pointer',
    fontSize: '14px',
  },
  modalButtonPrimary: {
    backgroundColor: 'var(--color-primary, #3b82f6)',
    color: 'white',
    border: 'none',
  },
};

// ============================================================================
// Save Query Modal Component
// ============================================================================

interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  initialName?: string;
  initialDescription?: string;
  isSaving: boolean;
}

function SaveQueryModal({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  initialDescription = '',
  isSaving,
}: SaveQueryModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (name.trim()) {
        onSave(name.trim(), description.trim());
      }
    },
    [name, description, onSave]
  );

  if (!isOpen) return null;

  return (
    <div style={styles.saveModal} onClick={onClose} data-testid="save-query-modal">
      <div
        style={styles.saveModalContent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="save-modal-title"
      >
        <h2 id="save-modal-title" style={styles.saveModalTitle}>
          Save Query
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label htmlFor="query-name" style={styles.formLabel}>
              Name *
            </label>
            <input
              id="query-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.formInput}
              placeholder="My Query"
              autoFocus
              required
              data-testid="save-query-name-input"
            />
          </div>
          <div style={styles.formGroup}>
            <label htmlFor="query-description" style={styles.formLabel}>
              Description
            </label>
            <textarea
              id="query-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={styles.formTextarea}
              placeholder="Optional description..."
              data-testid="save-query-description-input"
            />
          </div>
          <div style={styles.modalButtons}>
            <button
              type="button"
              onClick={onClose}
              style={styles.modalButton}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ ...styles.modalButton, ...styles.modalButtonPrimary }}
              disabled={!name.trim() || isSaving}
              data-testid="save-query-submit"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * QueryViewScreen - Full-featured query editor with visual and raw modes.
 */
export function QueryViewScreen(_props: QueryViewScreenProps): React.ReactElement {
  const services = useContext(ServiceContext);
  const navigateToPage = useAppStore((state) => state.navigateToPage);
  const addQueryToHistory = useQueryHistoryStore((state) => state.addQuery);

  // Editor state
  const [editorMode, setEditorMode] = useState<EditorMode>('visual');
  const [rawQuery, setRawQuery] = useState('?[page_id, title] := *pages{ page_id, title, is_deleted: false }');
  const [visualAST, setVisualAST] = useState<QueryAST | null>(null);
  const [visualCompiled, setVisualCompiled] = useState<CompiledQuery | null>(null);

  // Query results state
  const [results, setResults] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Side panel state
  const [sidePanelView, setSidePanelView] = useState<SidePanelView>('saved');

  // Save modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);

  // Get the current query script based on mode
  const currentQueryScript = useMemo(() => {
    if (editorMode === 'raw') {
      return rawQuery;
    }
    return visualCompiled?.script ?? '';
  }, [editorMode, rawQuery, visualCompiled]);

  // Handle query execution
  const executeQuery = useCallback(async () => {
    if (!services?.graphDB || !currentQueryScript.trim()) {
      return;
    }

    setIsExecuting(true);
    setExecutionError(null);
    setResults(null);

    const startTime = performance.now();

    try {
      const result = await services.graphDB.query(currentQueryScript);
      const duration = performance.now() - startTime;
      setExecutionTime(duration);
      setResults(result);

      // Add to history
      addQueryToHistory(currentQueryScript, duration, {
        success: true,
        rowCount: result.rows.length,
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      setExecutionError(errorMessage);
      setExecutionTime(duration);

      // Add to history with error
      addQueryToHistory(currentQueryScript, duration, {
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [services?.graphDB, currentQueryScript, addQueryToHistory]);

  // Handle visual builder changes
  const handleVisualBuilderChange = useCallback(
    (ast: QueryAST | null, compiled: CompiledQuery | null, error: string | null) => {
      setVisualAST(ast);
      setVisualCompiled(compiled);
      if (error) {
        setExecutionError(error);
      }
    },
    []
  );

  // Handle visual builder submit
  const handleVisualBuilderSubmit = useCallback(
    (_ast: QueryAST, compiled: CompiledQuery) => {
      // Update the raw query with the compiled script
      setRawQuery(compiled.script);
      // Execute the query
      executeQuery();
    },
    [executeQuery]
  );

  // Handle selecting a saved query
  const handleSelectSavedQuery = useCallback((query: SavedQuery) => {
    setSelectedQueryId(query.id);

    // Load the query into the appropriate editor
    if (query.type === SavedQueryType.VISUAL) {
      // For visual queries, we store the definition as JSON QueryAST
      try {
        const ast = JSON.parse(query.definition) as QueryAST;
        setVisualAST(ast);
        setVisualCompiled(transpileToCozo(ast));
        setEditorMode('visual');
      } catch {
        // If parsing fails, load as raw
        setRawQuery(query.definition);
        setEditorMode('raw');
      }
    } else {
      // Template and raw queries go to raw editor
      setRawQuery(query.definition);
      setEditorMode('raw');
    }
  }, []);

  // Handle selecting a query from history
  const handleSelectFromHistory = useCallback((script: string) => {
    setRawQuery(script);
    setEditorMode('raw');
    setSidePanelView(null); // Close side panel or keep it open based on preference
  }, []);

  // Handle saving a query
  const handleSaveQuery = useCallback(
    async (name: string, description: string) => {
      if (!services?.savedQueryService) return;

      setIsSaving(true);
      try {
        const definition =
          editorMode === 'visual' && visualAST
            ? JSON.stringify(visualAST)
            : rawQuery;

        const type =
          editorMode === 'visual'
            ? SavedQueryType.VISUAL
            : SavedQueryType.RAW;

        await services.savedQueryService.create({
          name,
          type,
          definition,
          description: description || null,
        });

        // Invalidate saved queries cache
        invalidateQueries(['savedQueries']);

        setSaveModalOpen(false);
      } catch (error) {
        setExecutionError(
          error instanceof Error ? error.message : 'Failed to save query'
        );
      } finally {
        setIsSaving(false);
      }
    },
    [services?.savedQueryService, editorMode, visualAST, rawQuery]
  );

  // Handle navigation from result table
  const handleNavigate = useCallback(
    (target: NavigationTarget) => {
      if (target.type === 'page') {
        navigateToPage('page/' + target.id);
      }
      // For blocks, we could navigate to the page containing the block
      // This would require fetching the block to get its pageId
    },
    [navigateToPage]
  );

  // Convert results to table format
  const tableData = useMemo(() => {
    if (!results) return [];

    return results.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      results.headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
  }, [results]);

  // ============================================================================
  // Render: Placeholder when no services
  // ============================================================================

  if (!services) {
    return (
      <div
        className="view query-view"
        data-testid="query-view"
        style={styles.container}
        role="main"
        aria-label="Query editor"
      >
        <div style={styles.emptyState}>
          <p>Query editor is not available in this context.</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Main View
  // ============================================================================

  return (
    <div
      className="view query-view"
      data-testid="query-view"
      style={styles.container}
      role="main"
      aria-label="Query editor"
    >
      {/* Toolbar */}
      <div style={styles.toolbar} data-testid="query-toolbar">
        {/* Mode toggle */}
        <div style={styles.toolbarGroup}>
          <button
            style={styles.modeButton(editorMode === 'visual')}
            onClick={() => setEditorMode('visual')}
            data-testid="mode-visual"
            aria-pressed={editorMode === 'visual'}
          >
            Visual Builder
          </button>
          <button
            style={styles.modeButton(editorMode === 'raw')}
            onClick={() => setEditorMode('raw')}
            data-testid="mode-raw"
            aria-pressed={editorMode === 'raw'}
          >
            Raw Datalog
          </button>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        <div style={styles.toolbarGroup}>
          <button
            style={styles.saveButton}
            onClick={() => setSaveModalOpen(true)}
            disabled={!currentQueryScript.trim()}
            data-testid="save-query-button"
          >
            Save Query
          </button>
          <button
            style={{
              ...styles.executeButton,
              ...(isExecuting || !currentQueryScript.trim()
                ? styles.executeButtonDisabled
                : {}),
            }}
            onClick={executeQuery}
            disabled={isExecuting || !currentQueryScript.trim()}
            data-testid="execute-query"
          >
            {isExecuting ? 'Running...' : 'Run Query'}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div style={styles.mainContent}>
        {/* Side panel (saved queries / history) */}
        <div style={styles.sidePanel} data-testid="query-side-panel">
          <div style={styles.sidePanelTabs}>
            <button
              style={styles.sidePanelTab(sidePanelView === 'saved')}
              onClick={() => setSidePanelView('saved')}
              data-testid="tab-saved"
            >
              Saved
            </button>
            <button
              style={styles.sidePanelTab(sidePanelView === 'history')}
              onClick={() => setSidePanelView('history')}
              data-testid="tab-history"
            >
              History
            </button>
          </div>
          <div style={styles.sidePanelContent}>
            {sidePanelView === 'saved' && (
              <SavedQueriesList
                onSelect={handleSelectSavedQuery}
                selectedId={selectedQueryId ?? undefined}
              />
            )}
            {sidePanelView === 'history' && (
              <QueryHistoryPanel onSelectQuery={handleSelectFromHistory} />
            )}
          </div>
        </div>

        {/* Editor pane */}
        <div style={styles.editorPane} data-testid="query-editor-pane">
          <div style={styles.editorContainer}>
            {editorMode === 'visual' ? (
              <VisualQueryBuilder
                initialAST={visualAST ?? undefined}
                onChange={handleVisualBuilderChange}
                onSubmit={handleVisualBuilderSubmit}
                showPreview={true}
                showSubmitButton={false}
              />
            ) : (
              <CodeMirrorEditor
                value={rawQuery}
                onChange={setRawQuery}
                placeholder="Enter your CozoScript query..."
                minHeight="200px"
                maxHeight="100%"
                testId="raw-query-editor"
              />
            )}
          </div>
        </div>

        {/* Results pane */}
        <div style={styles.resultsPane} data-testid="query-results-pane">
          <div style={styles.resultsHeader}>
            <span style={styles.resultsTitle}>Results</span>
            {results && (
              <span style={styles.resultsStats}>
                {results.rows.length} row{results.rows.length !== 1 ? 's' : ''}
                {executionTime !== null && ` in ${executionTime.toFixed(1)}ms`}
              </span>
            )}
          </div>
          <div style={styles.resultsContent}>
            {executionError ? (
              <div style={styles.errorMessage} data-testid="query-error">
                {executionError}
              </div>
            ) : results ? (
              <QueryResultTable
                data={tableData}
                headers={results.headers}
                onNavigate={handleNavigate}
                maxHeight={600}
              />
            ) : (
              <div style={styles.emptyState}>
                <p>Run a query to see results here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Query Modal */}
      <SaveQueryModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSaveQuery}
        isSaving={isSaving}
      />
    </div>
  );
}

export default QueryViewScreen;
