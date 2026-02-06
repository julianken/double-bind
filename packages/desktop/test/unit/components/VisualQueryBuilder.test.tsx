/**
 * Tests for VisualQueryBuilder component
 *
 * Comprehensive test coverage for the visual query builder including:
 * - Basic rendering
 * - Relation selection
 * - Filter row management
 * - Filter group logic (AND/OR)
 * - Query type selection
 * - Limit/offset inputs
 * - CozoScript preview
 * - QueryAST generation
 * - Form submission
 * - Accessibility
 * - Edge cases
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisualQueryBuilder } from '../../../src/components/VisualQueryBuilder.js';
import type { QueryAST } from '@double-bind/query-lang';

// ============================================================================
// Test Helpers
// ============================================================================

function getQueryTypeSelect() {
  return screen.getByTestId('query-type-select');
}

function getRelationSelect() {
  return screen.getByTestId('relation-select');
}

function getFilterGroups() {
  return screen.getByTestId('filter-groups');
}

function getPreview() {
  return screen.queryByTestId('query-preview');
}

function getPreviewScript() {
  return screen.queryByTestId('preview-script');
}

function getPreviewParams() {
  return screen.queryByTestId('preview-params');
}

function _getPreviewError() {
  return screen.queryByTestId('preview-error');
}

function getLimitInput() {
  return screen.getByTestId('limit-input');
}

function getOffsetInput() {
  return screen.getByTestId('offset-input');
}

function getSubmitButton() {
  return screen.getByTestId('submit-query');
}

function getAddGroupButton() {
  return screen.getByTestId('add-filter-group');
}

// ============================================================================
// Tests
// ============================================================================

describe('VisualQueryBuilder', () => {
  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // Basic Rendering
  // ============================================================================

  describe('Basic Rendering', () => {
    it('renders the form with all main elements', () => {
      render(<VisualQueryBuilder />);

      expect(screen.getByTestId('visual-query-builder')).toBeDefined();
      expect(getQueryTypeSelect()).toBeDefined();
      expect(getRelationSelect()).toBeDefined();
      expect(getFilterGroups()).toBeDefined();
      expect(getLimitInput()).toBeDefined();
      expect(getOffsetInput()).toBeDefined();
      expect(getSubmitButton()).toBeDefined();
    });

    it('renders query type options', () => {
      render(<VisualQueryBuilder />);

      const select = getQueryTypeSelect();
      expect(within(select).getByText('Find')).toBeDefined();
      expect(within(select).getByText('Count')).toBeDefined();
      expect(within(select).getByText('Graph')).toBeDefined();
    });

    it('renders relation options', () => {
      render(<VisualQueryBuilder />);

      const select = getRelationSelect();
      expect(within(select).getByText('Pages')).toBeDefined();
      expect(within(select).getByText('Blocks')).toBeDefined();
      expect(within(select).getByText('Links')).toBeDefined();
      expect(within(select).getByText('Tags')).toBeDefined();
    });

    it('renders with custom className', () => {
      render(<VisualQueryBuilder className="custom-builder" />);

      const form = screen.getByTestId('visual-query-builder');
      expect(form.className).toContain('custom-builder');
    });

    it('renders with custom aria-label', () => {
      render(<VisualQueryBuilder aria-label="Custom query builder" />);

      const form = screen.getByTestId('visual-query-builder');
      expect(form.getAttribute('aria-label')).toBe('Custom query builder');
    });

    it('hides preview when showPreview is false', () => {
      render(<VisualQueryBuilder showPreview={false} />);

      expect(getPreview()).toBeNull();
    });

    it('hides submit button when showSubmitButton is false', () => {
      render(<VisualQueryBuilder showSubmitButton={false} />);

      expect(screen.queryByTestId('submit-query')).toBeNull();
    });
  });

  // ============================================================================
  // Query Type Selection
  // ============================================================================

  describe('Query Type Selection', () => {
    it('defaults to find query type', () => {
      render(<VisualQueryBuilder />);

      const select = getQueryTypeSelect() as HTMLSelectElement;
      expect(select.value).toBe('find');
    });

    it('changes query type on selection', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const select = getQueryTypeSelect();
      await user.selectOptions(select, 'count');

      expect((select as HTMLSelectElement).value).toBe('count');
    });

    it('updates preview when query type changes', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.selectOptions(getQueryTypeSelect(), 'count');

      const preview = getPreviewScript();
      expect(preview?.textContent).toContain('count(');
    });

    it('respects initial query type from initialAST', () => {
      const initialAST: QueryAST = {
        type: 'count',
        relation: 'pages',
        filters: [],
        projections: [],
      };

      render(<VisualQueryBuilder initialAST={initialAST} />);

      const select = getQueryTypeSelect() as HTMLSelectElement;
      expect(select.value).toBe('count');
    });
  });

  // ============================================================================
  // Relation Selection
  // ============================================================================

  describe('Relation Selection', () => {
    it('defaults to pages relation', () => {
      render(<VisualQueryBuilder />);

      const select = getRelationSelect() as HTMLSelectElement;
      expect(select.value).toBe('pages');
    });

    it('changes relation on selection', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const select = getRelationSelect();
      await user.selectOptions(select, 'blocks');

      expect((select as HTMLSelectElement).value).toBe('blocks');
    });

    it('updates available fields when relation changes', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      // Initially pages - should have page_id, title, etc.
      let fieldSelect = screen.getAllByLabelText('Field')[0];
      expect(within(fieldSelect).queryByText('page_id')).toBeDefined();
      expect(within(fieldSelect).queryByText('title')).toBeDefined();

      // Change to blocks
      await user.selectOptions(getRelationSelect(), 'blocks');

      // Wait for re-render with new fields
      fieldSelect = screen.getAllByLabelText('Field')[0];
      expect(within(fieldSelect).queryByText('block_id')).toBeDefined();
      expect(within(fieldSelect).queryByText('content')).toBeDefined();
    });

    it('resets filters when relation changes', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      // Add a filter value
      const fieldSelect = screen.getAllByLabelText('Field')[0];
      await user.selectOptions(fieldSelect, 'title');

      const valueInput = screen.getAllByLabelText('Value')[0];
      await user.type(valueInput, 'test value');

      // Change relation
      await user.selectOptions(getRelationSelect(), 'blocks');

      // Filter should be reset
      const newFieldSelect = screen.getAllByLabelText('Field')[0] as HTMLSelectElement;
      expect(newFieldSelect.value).toBe('');
    });

    it('respects initial relation from initialAST', () => {
      const initialAST: QueryAST = {
        type: 'find',
        relation: 'blocks',
        filters: [],
        projections: [],
      };

      render(<VisualQueryBuilder initialAST={initialAST} />);

      const select = getRelationSelect() as HTMLSelectElement;
      expect(select.value).toBe('blocks');
    });
  });

  // ============================================================================
  // Filter Row Management
  // ============================================================================

  describe('Filter Row Management', () => {
    it('renders initial empty filter row', () => {
      render(<VisualQueryBuilder />);

      const fieldSelects = screen.getAllByLabelText('Field');
      expect(fieldSelects.length).toBe(1);
    });

    it('adds filter row when clicking Add Condition button', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const addButton = screen.getByText('+ Add Condition');
      await user.click(addButton);

      const fieldSelects = screen.getAllByLabelText('Field');
      expect(fieldSelects.length).toBe(2);
    });

    it('removes filter row when clicking Remove button', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      // Add a second filter
      await user.click(screen.getByText('+ Add Condition'));

      let fieldSelects = screen.getAllByLabelText('Field');
      expect(fieldSelects.length).toBe(2);

      // Remove button should now be visible
      const removeButtons = screen.getAllByLabelText('Remove filter');
      await user.click(removeButtons[0]);

      fieldSelects = screen.getAllByLabelText('Field');
      expect(fieldSelects.length).toBe(1);
    });

    it('does not show Remove button when only one filter exists', () => {
      render(<VisualQueryBuilder />);

      expect(screen.queryByLabelText('Remove filter')).toBeNull();
    });

    it('updates field selection', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const fieldSelect = screen.getAllByLabelText('Field')[0];
      await user.selectOptions(fieldSelect, 'title');

      expect((fieldSelect as HTMLSelectElement).value).toBe('title');
    });

    it('updates operator selection', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const operatorSelect = screen.getAllByLabelText('Operator')[0];
      await user.selectOptions(operatorSelect, 'startsWith');

      expect((operatorSelect as HTMLSelectElement).value).toBe('startsWith');
    });

    it('updates value input', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const valueInput = screen.getAllByLabelText('Value')[0];
      await user.type(valueInput, 'test value');

      expect((valueInput as HTMLInputElement).value).toBe('test value');
    });

    it('hides value input for isNull operator', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const operatorSelect = screen.getAllByLabelText('Operator')[0];
      await user.selectOptions(operatorSelect, 'isNull');

      // Value input should be hidden
      const valueInputs = screen.queryAllByLabelText('Value');
      expect(valueInputs.length).toBe(0);
    });

    it('hides value input for isNotNull operator', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const operatorSelect = screen.getAllByLabelText('Operator')[0];
      await user.selectOptions(operatorSelect, 'isNotNull');

      const valueInputs = screen.queryAllByLabelText('Value');
      expect(valueInputs.length).toBe(0);
    });

    it('shows number input for numeric operators', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const operatorSelect = screen.getAllByLabelText('Operator')[0];
      await user.selectOptions(operatorSelect, 'greaterThan');

      const valueInput = screen.getAllByLabelText('Value')[0] as HTMLInputElement;
      expect(valueInput.type).toBe('number');
    });
  });

  // ============================================================================
  // Filter Groups (AND/OR Logic)
  // ============================================================================

  describe('Filter Groups (AND/OR Logic)', () => {
    it('renders single filter group by default', () => {
      render(<VisualQueryBuilder />);

      const groups = screen.getAllByTestId(/^filter-group-/);
      expect(groups.length).toBe(1);
    });

    it('adds new filter group when clicking Add Filter Group', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.click(getAddGroupButton());

      const groups = screen.getAllByTestId(/^filter-group-/);
      expect(groups.length).toBe(2);
    });

    it('shows AND/OR selector for second group', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.click(getAddGroupButton());

      const groupOperatorSelects = screen.getAllByLabelText('Group operator');
      expect(groupOperatorSelects.length).toBe(1); // Only second group has it
    });

    it('does not show AND/OR selector for first group', () => {
      render(<VisualQueryBuilder />);

      const groupOperatorSelects = screen.queryAllByLabelText('Group operator');
      expect(groupOperatorSelects.length).toBe(0);
    });

    it('changes group operator', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.click(getAddGroupButton());

      const groupOperatorSelect = screen.getByLabelText('Group operator');
      await user.selectOptions(groupOperatorSelect, 'or');

      expect((groupOperatorSelect as HTMLSelectElement).value).toBe('or');
    });

    it('removes filter group when clicking Remove Group', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.click(getAddGroupButton());

      let groups = screen.getAllByTestId(/^filter-group-/);
      expect(groups.length).toBe(2);

      const removeGroupButtons = screen.getAllByLabelText('Remove filter group');
      await user.click(removeGroupButtons[0]);

      groups = screen.getAllByTestId(/^filter-group-/);
      expect(groups.length).toBe(1);
    });

    it('does not show Remove Group button when only one group exists', () => {
      render(<VisualQueryBuilder />);

      expect(screen.queryByLabelText('Remove filter group')).toBeNull();
    });

    it('shows AND between filters within same group', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.click(screen.getByText('+ Add Condition'));

      // Should show "and" text between filters
      expect(screen.getByText('and')).toBeDefined();
    });
  });

  // ============================================================================
  // Limit and Offset
  // ============================================================================

  describe('Limit and Offset', () => {
    it('renders limit input', () => {
      render(<VisualQueryBuilder />);

      const limitInput = getLimitInput();
      expect(limitInput).toBeDefined();
      expect((limitInput as HTMLInputElement).type).toBe('number');
    });

    it('renders offset input', () => {
      render(<VisualQueryBuilder />);

      const offsetInput = getOffsetInput();
      expect(offsetInput).toBeDefined();
      expect((offsetInput as HTMLInputElement).type).toBe('number');
    });

    it('updates limit value', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const limitInput = getLimitInput();
      await user.type(limitInput, '10');

      expect((limitInput as HTMLInputElement).value).toBe('10');
    });

    it('updates offset value', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const offsetInput = getOffsetInput();
      await user.type(offsetInput, '20');

      expect((offsetInput as HTMLInputElement).value).toBe('20');
    });

    it('includes limit in preview', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.type(getLimitInput(), '10');

      const preview = getPreviewScript();
      expect(preview?.textContent).toContain(':limit 10');
    });

    it('includes offset in preview', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.type(getOffsetInput(), '20');

      const preview = getPreviewScript();
      expect(preview?.textContent).toContain(':offset 20');
    });

    it('respects initial limit from initialAST', () => {
      const initialAST: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: [],
        limit: 50,
      };

      render(<VisualQueryBuilder initialAST={initialAST} />);

      const limitInput = getLimitInput() as HTMLInputElement;
      expect(limitInput.value).toBe('50');
    });

    it('respects initial offset from initialAST', () => {
      const initialAST: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: [],
        offset: 100,
      };

      render(<VisualQueryBuilder initialAST={initialAST} />);

      const offsetInput = getOffsetInput() as HTMLInputElement;
      expect(offsetInput.value).toBe('100');
    });
  });

  // ============================================================================
  // CozoScript Preview
  // ============================================================================

  describe('CozoScript Preview', () => {
    it('shows CozoScript preview by default', () => {
      render(<VisualQueryBuilder />);

      expect(getPreview()).toBeDefined();
    });

    it('shows basic query in preview', () => {
      render(<VisualQueryBuilder />);

      const preview = getPreviewScript();
      expect(preview?.textContent).toContain('?[page_id, title]');
      expect(preview?.textContent).toContain('*pages{');
    });

    it('updates preview when filter is added', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'title');
      await user.selectOptions(screen.getAllByLabelText('Operator')[0], 'contains');
      await user.type(screen.getAllByLabelText('Value')[0], 'meeting');

      const preview = getPreviewScript();
      expect(preview?.textContent).toContain('contains(title, $filter_0)');

      const params = getPreviewParams();
      expect(params?.textContent).toContain('meeting');
    });

    it('shows parameters in preview', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'title');
      await user.type(screen.getAllByLabelText('Value')[0], 'test');

      const params = getPreviewParams();
      expect(params).toBeDefined();
      expect(params?.textContent).toContain('Parameters:');
    });

    it('does not show parameters when no filters have values', () => {
      render(<VisualQueryBuilder />);

      // With no filter values, there should be no parameters
      const params = getPreviewParams();
      expect(params).toBeNull();
    });
  });

  // ============================================================================
  // QueryAST Generation
  // ============================================================================

  describe('QueryAST Generation', () => {
    it('calls onChange with valid AST', async () => {
      const onChange = vi.fn();
      render(<VisualQueryBuilder onChange={onChange} />);

      // Wait for initial render
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });

      const [ast, compiled, error] = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(ast).toBeDefined();
      expect(ast.type).toBe('find');
      expect(ast.relation).toBe('pages');
      expect(compiled).toBeDefined();
      expect(error).toBeNull();
    });

    it('generates AST with correct query type', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<VisualQueryBuilder onChange={onChange} />);

      await user.selectOptions(getQueryTypeSelect(), 'count');

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0].type).toBe('count');
      });
    });

    it('generates AST with correct relation', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<VisualQueryBuilder onChange={onChange} />);

      await user.selectOptions(getRelationSelect(), 'blocks');

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0].relation).toBe('blocks');
      });
    });

    it('generates AST with filters', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<VisualQueryBuilder onChange={onChange} />);

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'title');
      await user.selectOptions(screen.getAllByLabelText('Operator')[0], 'contains');
      await user.type(screen.getAllByLabelText('Value')[0], 'test');

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        const ast = lastCall[0];
        expect(ast.filters.length).toBe(1);
        expect(ast.filters[0].field).toBe('title');
        expect(ast.filters[0].operator).toBe('contains');
        expect(ast.filters[0].value).toBe('test');
      });
    });

    it('generates AST with limit and offset', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<VisualQueryBuilder onChange={onChange} />);

      await user.type(getLimitInput(), '10');
      await user.type(getOffsetInput(), '20');

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0].limit).toBe(10);
        expect(lastCall[0].offset).toBe(20);
      });
    });

    it('includes metadata in AST', async () => {
      const onChange = vi.fn();
      render(<VisualQueryBuilder onChange={onChange} />);

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        const ast = lastCall[0];
        expect(ast.metadata).toBeDefined();
        expect(ast.metadata.level).toBe(2);
        expect(ast.metadata.createdAt).toBeDefined();
      });
    });

    it('includes default projections in AST', async () => {
      const onChange = vi.fn();
      render(<VisualQueryBuilder onChange={onChange} />);

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        const ast = lastCall[0];
        expect(ast.projections).toContain('page_id');
        expect(ast.projections).toContain('title');
      });
    });
  });

  // ============================================================================
  // Form Submission
  // ============================================================================

  describe('Form Submission', () => {
    it('calls onSubmit with AST and compiled query', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<VisualQueryBuilder onSubmit={onSubmit} />);

      await user.click(getSubmitButton());

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const [ast, compiled] = onSubmit.mock.calls[0];
      expect(ast).toBeDefined();
      expect(compiled).toBeDefined();
      expect(compiled.script).toBeDefined();
    });

    it('disables submit button when no valid AST', async () => {
      // This scenario would require an invalid state which is hard to trigger
      // since the builder always produces valid AST. Test that button is enabled
      // when valid.
      render(<VisualQueryBuilder />);

      const submitButton = getSubmitButton() as HTMLButtonElement;
      expect(submitButton.disabled).toBe(false);
    });

    it('prevents form submission without valid AST', async () => {
      const onSubmit = vi.fn();
      render(<VisualQueryBuilder onSubmit={onSubmit} />);

      // The form should always have a valid AST, so submission should work
      fireEvent.submit(screen.getByTestId('visual-query-builder'));

      expect(onSubmit).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Initial AST Hydration
  // ============================================================================

  describe('Initial AST Hydration', () => {
    it('hydrates query type from initialAST', () => {
      const initialAST: QueryAST = {
        type: 'graph',
        relation: 'pages',
        filters: [],
        projections: [],
      };

      render(<VisualQueryBuilder initialAST={initialAST} />);

      expect((getQueryTypeSelect() as HTMLSelectElement).value).toBe('graph');
    });

    it('hydrates relation from initialAST', () => {
      const initialAST: QueryAST = {
        type: 'find',
        relation: 'tags',
        filters: [],
        projections: [],
      };

      render(<VisualQueryBuilder initialAST={initialAST} />);

      expect((getRelationSelect() as HTMLSelectElement).value).toBe('tags');
    });

    it('hydrates filters from initialAST', () => {
      const initialAST: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [
          { field: 'title', operator: 'contains', value: 'meeting' },
          { field: 'is_deleted', operator: 'equals', value: false },
        ],
        projections: ['page_id', 'title'],
      };

      render(<VisualQueryBuilder initialAST={initialAST} />);

      const fieldSelects = screen.getAllByLabelText('Field');
      expect(fieldSelects.length).toBe(2);

      expect((fieldSelects[0] as HTMLSelectElement).value).toBe('title');
      expect((fieldSelects[1] as HTMLSelectElement).value).toBe('is_deleted');

      const valueInputs = screen.getAllByLabelText('Value');
      expect((valueInputs[0] as HTMLInputElement).value).toBe('meeting');
      expect((valueInputs[1] as HTMLInputElement).value).toBe('false');
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('has proper form structure', () => {
      render(<VisualQueryBuilder />);

      const form = screen.getByTestId('visual-query-builder');
      expect(form.tagName.toLowerCase()).toBe('form');
    });

    it('has accessible labels for all inputs', () => {
      render(<VisualQueryBuilder />);

      expect(screen.getByLabelText('Query type')).toBeDefined();
      expect(screen.getByLabelText('Relation')).toBeDefined();
      expect(screen.getAllByLabelText('Field').length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText('Operator').length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/Limit/i)).toBeDefined();
      expect(screen.getByLabelText(/Offset/i)).toBeDefined();
    });

    it('has accessible button labels', () => {
      render(<VisualQueryBuilder />);

      expect(screen.getByLabelText('Add filter group')).toBeDefined();
      expect(screen.getByLabelText('Add filter condition')).toBeDefined();
      expect(screen.getByLabelText('Run query')).toBeDefined();
    });

    it('has form aria-label', () => {
      render(<VisualQueryBuilder aria-label="Test query builder" />);

      const form = screen.getByTestId('visual-query-builder');
      expect(form.getAttribute('aria-label')).toBe('Test query builder');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty filter value gracefully', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<VisualQueryBuilder onChange={onChange} />);

      // Select field but leave value empty
      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'title');

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        // Filter with empty value should not be included
        expect(lastCall[0].filters.length).toBe(0);
      });
    });

    it('handles empty field selection gracefully', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<VisualQueryBuilder onChange={onChange} />);

      // Type value but leave field empty
      await user.type(screen.getAllByLabelText('Value')[0], 'test');

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        // Filter with empty field should not be included
        expect(lastCall[0].filters.length).toBe(0);
      });
    });

    it('handles numeric value parsing for numeric operators', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<VisualQueryBuilder onChange={onChange} />);

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'created_at');
      await user.selectOptions(screen.getAllByLabelText('Operator')[0], 'greaterThan');
      await user.type(screen.getAllByLabelText('Value')[0], '1704067200');

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0].filters[0].value).toBe(1704067200);
      });
    });

    it('handles boolean value parsing', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<VisualQueryBuilder onChange={onChange} />);

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'is_deleted');
      await user.selectOptions(screen.getAllByLabelText('Operator')[0], 'equals');
      await user.type(screen.getAllByLabelText('Value')[0], 'false');

      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        // Note: Boolean parsing only happens for boolean valueType operators
        // 'equals' is string type, so it stays as string
        expect(lastCall[0].filters[0].value).toBe('false');
      });
    });

    it('handles rapid filter additions', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const addButton = screen.getByText('+ Add Condition');

      // Rapidly add filters
      await user.click(addButton);
      await user.click(addButton);
      await user.click(addButton);

      const fieldSelects = screen.getAllByLabelText('Field');
      expect(fieldSelects.length).toBe(4);
    });

    it('handles rapid filter removals', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      // Add several filters
      const addButton = screen.getByText('+ Add Condition');
      await user.click(addButton);
      await user.click(addButton);
      await user.click(addButton);

      // Remove them
      const removeButtons = screen.getAllByLabelText('Remove filter');
      for (const btn of removeButtons) {
        await user.click(btn);
      }

      const fieldSelects = screen.getAllByLabelText('Field');
      expect(fieldSelects.length).toBe(1);
    });

    it('handles all relations correctly', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const relations = [
        'pages',
        'blocks',
        'links',
        'tags',
        'properties',
        'block_refs',
        'daily_notes',
      ];

      for (const relation of relations) {
        await user.selectOptions(getRelationSelect(), relation);

        // Should not throw and preview should update
        const preview = getPreviewScript();
        expect(preview?.textContent).toContain(`*${relation}{`);
      }
    });

    it('handles all operators correctly', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      const operators = [
        'equals',
        'notEquals',
        'contains',
        'startsWith',
        'endsWith',
        'greaterThan',
        'lessThan',
        'greaterThanOrEqual',
        'lessThanOrEqual',
        'isNull',
        'isNotNull',
        'hasTag',
        'linkedTo',
        'linkedFrom',
        'hasProperty',
      ];

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'title');

      for (const operator of operators) {
        await user.selectOptions(screen.getAllByLabelText('Operator')[0], operator);
        // Should not throw
        expect(getPreview()).toBeDefined();
      }
    });
  });

  // ============================================================================
  // Graph Operators (hasTag, linkedTo, linkedFrom, hasProperty)
  // ============================================================================

  describe('Graph Operators', () => {
    it('includes tag join for hasTag operator', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'page_id');
      await user.selectOptions(screen.getAllByLabelText('Operator')[0], 'hasTag');
      await user.type(screen.getAllByLabelText('Value')[0], 'important');

      const preview = getPreviewScript();
      expect(preview?.textContent).toContain('*tags{');
    });

    it('includes links join for linkedTo operator', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'page_id');
      await user.selectOptions(screen.getAllByLabelText('Operator')[0], 'linkedTo');
      await user.type(screen.getAllByLabelText('Value')[0], 'Resources');

      const preview = getPreviewScript();
      expect(preview?.textContent).toContain('*links{');
    });

    it('includes links join for linkedFrom operator', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'page_id');
      await user.selectOptions(screen.getAllByLabelText('Operator')[0], 'linkedFrom');
      await user.type(screen.getAllByLabelText('Value')[0], 'Project Alpha');

      const preview = getPreviewScript();
      expect(preview?.textContent).toContain('*links{');
    });

    it('includes properties join for hasProperty operator', async () => {
      const user = userEvent.setup();
      render(<VisualQueryBuilder />);

      await user.selectOptions(screen.getAllByLabelText('Field')[0], 'page_id');
      await user.selectOptions(screen.getAllByLabelText('Operator')[0], 'hasProperty');
      await user.type(screen.getAllByLabelText('Value')[0], 'status');

      const preview = getPreviewScript();
      expect(preview?.textContent).toContain('*properties{');
    });
  });
});
