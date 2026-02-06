import { describe, it, expect } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { InputRule } from 'prosemirror-inputrules';
import {
  createInputRulesPlugin,
  headingRule,
  bulletRule,
  todoUncheckedRule,
  todoCheckedRule,
  codeBlockRule,
} from '../../../../src/editor/plugins/input-rules.js';

/**
 * Test schema that includes all the node types needed for input rules.
 * This is a minimal schema for testing purposes.
 */
const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },

    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    },

    heading: {
      attrs: { level: { default: 1 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
      ],
      toDOM(node) {
        return [`h${node.attrs.level}`, 0];
      },
    },

    bullet_item: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'li.bullet' }],
      toDOM() {
        return ['li', { class: 'bullet' }, 0];
      },
    },

    todo_item: {
      attrs: { checked: { default: false } },
      content: 'inline*',
      group: 'block',
      parseDOM: [
        {
          tag: 'li.todo',
          getAttrs(dom: HTMLElement) {
            return { checked: dom.dataset.checked === 'true' };
          },
        },
      ],
      toDOM(node) {
        return ['li', { class: 'todo', 'data-checked': String(node.attrs.checked) }, 0];
      },
    },

    codeBlock: {
      attrs: { language: { default: '' } },
      content: 'text*',
      marks: '',
      group: 'block',
      code: true,
      defining: true,
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM(node) {
        return ['pre', { 'data-language': node.attrs.language }, ['code', 0]];
      },
    },

    text: { group: 'inline' },
  },
});

/**
 * Helper to create an editor state with specific text content
 */
function createStateWithText(text: string): EditorState {
  const textNode = text ? testSchema.text(text) : null;
  const doc = testSchema.node('doc', null, [
    testSchema.node('paragraph', null, textNode ? [textNode] : []),
  ]);

  return EditorState.create({
    doc,
    selection: TextSelection.atEnd(doc),
  });
}

/**
 * Helper to apply an input rule to a state.
 * This simulates typing the last character of a pattern.
 *
 * Input rules work by checking if the text before the cursor (plus the newly
 * typed character) matches the rule's pattern. This helper:
 * 1. Creates a state where the pattern (minus the last char) is already typed
 * 2. Simulates typing the last character
 * 3. Checks if the rule's handler returns a transaction
 *
 * @param rule - The input rule to test
 * @param state - The editor state (should have text matching pattern minus last char)
 * @param lastChar - The last character being "typed"
 * @returns The resulting state after applying the rule, or null if rule didn't match
 */
function applyInputRule(rule: InputRule, state: EditorState, lastChar: string): EditorState | null {
  const { $from } = state.selection;

  // Get the text before the cursor in the current text block
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');

  // The full text that the rule will try to match (existing text + new char)
  const fullText = textBefore + lastChar;

  // Try to match the rule's pattern against the full text
  const matchResult = rule.match.exec(fullText);

  if (!matchResult) {
    return null;
  }

  // Calculate positions correctly:
  // - matchEnd is the end position of the match, which is where the cursor is after
  //   the new character is "typed". This should be $from.pos + 1 (after the lastChar)
  // - matchStart is the start of the entire matched text within the document
  //
  // The handler expects positions in document coordinates.
  // $from.start() gives us the start of the parent node's content.
  // matchResult.index gives us where the match starts within the text.

  const contentStart = $from.start(); // Start position of the paragraph content
  const matchStart = contentStart + matchResult.index;
  const matchEnd = contentStart + fullText.length; // End position after lastChar

  // Call the rule's handler to get a transaction
  // The handler receives: state, match, start position, end position
  const tr = rule.handler(state, matchResult, matchStart, matchEnd);

  if (!tr) {
    return null;
  }

  return state.apply(tr);
}

// ============================================================================
// createInputRulesPlugin Tests
// ============================================================================

describe('createInputRulesPlugin', () => {
  it('creates a plugin with default configuration', () => {
    const plugin = createInputRulesPlugin(testSchema);
    expect(plugin).toBeDefined();
    expect(plugin.spec).toBeDefined();
  });

  it('creates a plugin with custom configuration', () => {
    const plugin = createInputRulesPlugin(testSchema, {
      headings: false,
      bullets: true,
      todos: false,
      codeBlocks: false,
    });
    expect(plugin).toBeDefined();
  });

  it('handles schema without expected node types gracefully', () => {
    const minimalSchema = new Schema({
      nodes: {
        doc: { content: 'text*' },
        text: {},
      },
    });

    // Should not throw even when node types are missing
    const plugin = createInputRulesPlugin(minimalSchema);
    expect(plugin).toBeDefined();
  });
});

// ============================================================================
// Heading Rule Tests
// ============================================================================

describe('headingRule', () => {
  const rule = headingRule(testSchema.nodes.heading);

  it('converts "# " to heading level 1', () => {
    // State has "#" already typed, we simulate typing " "
    const state = createStateWithText('#');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('heading');
    expect(firstNode?.attrs.level).toBe(1);
  });

  it('converts "## " to heading level 2', () => {
    const state = createStateWithText('##');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('heading');
    expect(firstNode?.attrs.level).toBe(2);
  });

  it('converts "### " to heading level 3', () => {
    const state = createStateWithText('###');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('heading');
    expect(firstNode?.attrs.level).toBe(3);
  });

  it('does not convert "#### " when maxLevel is 3 (default)', () => {
    const state = createStateWithText('####');
    const result = applyInputRule(rule, state, ' ');

    // Rule should not match since it only handles 1-3 hashes
    expect(result).toBeNull();
  });

  it('respects custom maxHeadingLevel', () => {
    const rule2 = headingRule(testSchema.nodes.heading, 2);

    // "## " should work
    const state1 = createStateWithText('##');
    const result1 = applyInputRule(rule2, state1, ' ');
    expect(result1).not.toBeNull();
    expect(result1!.doc.firstChild?.attrs.level).toBe(2);

    // "### " should NOT work when maxLevel is 2
    const state2 = createStateWithText('###');
    const result2 = applyInputRule(rule2, state2, ' ');
    expect(result2).toBeNull();
  });

  it('does not convert when text exists before the hashes', () => {
    const state = createStateWithText('text #');
    const result = applyInputRule(rule, state, ' ');

    // Rule requires hashes at the start of the block
    expect(result).toBeNull();
  });

  it('rule pattern matches correctly', () => {
    // Test the regex directly
    expect(rule.match.test('# ')).toBe(true);
    expect(rule.match.test('## ')).toBe(true);
    expect(rule.match.test('### ')).toBe(true);
    expect(rule.match.test('#### ')).toBe(false);
    expect(rule.match.test('text # ')).toBe(false);
  });
});

// ============================================================================
// Bullet Rule Tests
// ============================================================================

describe('bulletRule', () => {
  const rule = bulletRule(testSchema.nodes.bullet_item);

  it('converts "- " to bullet item', () => {
    const state = createStateWithText('-');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('bullet_item');
  });

  it('converts "* " to bullet item', () => {
    const state = createStateWithText('*');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('bullet_item');
  });

  it('does not convert when text exists before the marker', () => {
    const state = createStateWithText('text -');
    const result = applyInputRule(rule, state, ' ');

    expect(result).toBeNull();
  });

  it('does not convert "+ " (only - and * are supported)', () => {
    const state = createStateWithText('+');
    const result = applyInputRule(rule, state, ' ');

    expect(result).toBeNull();
  });

  it('rule pattern matches correctly', () => {
    expect(rule.match.test('- ')).toBe(true);
    expect(rule.match.test('* ')).toBe(true);
    expect(rule.match.test('+ ')).toBe(false);
    expect(rule.match.test('text - ')).toBe(false);
  });
});

// ============================================================================
// Todo Rule Tests
// ============================================================================

describe('todoUncheckedRule', () => {
  const rule = todoUncheckedRule(testSchema.nodes.todo_item);

  it('converts "[] " to unchecked todo item', () => {
    const state = createStateWithText('[]');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('todo_item');
    expect(firstNode?.attrs.checked).toBe(false);
  });

  it('converts "[ ] " to unchecked todo item', () => {
    const state = createStateWithText('[ ]');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('todo_item');
    expect(firstNode?.attrs.checked).toBe(false);
  });

  it('does not convert when text exists before the brackets', () => {
    const state = createStateWithText('text []');
    const result = applyInputRule(rule, state, ' ');

    expect(result).toBeNull();
  });

  it('rule pattern matches correctly', () => {
    expect(rule.match.test('[] ')).toBe(true);
    expect(rule.match.test('[ ] ')).toBe(true);
    expect(rule.match.test('[x] ')).toBe(false);
    expect(rule.match.test('text [] ')).toBe(false);
  });
});

describe('todoCheckedRule', () => {
  const rule = todoCheckedRule(testSchema.nodes.todo_item);

  it('converts "[x] " to checked todo item', () => {
    const state = createStateWithText('[x]');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('todo_item');
    expect(firstNode?.attrs.checked).toBe(true);
  });

  it('converts "[X] " (uppercase) to checked todo item', () => {
    const state = createStateWithText('[X]');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('todo_item');
    expect(firstNode?.attrs.checked).toBe(true);
  });

  it('does not convert when text exists before the brackets', () => {
    const state = createStateWithText('text [x]');
    const result = applyInputRule(rule, state, ' ');

    expect(result).toBeNull();
  });

  it('rule pattern matches correctly', () => {
    expect(rule.match.test('[x] ')).toBe(true);
    expect(rule.match.test('[X] ')).toBe(true);
    expect(rule.match.test('[] ')).toBe(false);
    expect(rule.match.test('[ ] ')).toBe(false);
    expect(rule.match.test('text [x] ')).toBe(false);
  });
});

// ============================================================================
// Code Block Rule Tests
// ============================================================================

describe('codeBlockRule', () => {
  const rule = codeBlockRule(testSchema.nodes.codeBlock);

  it('converts "```" to code block', () => {
    const state = createStateWithText('``');
    const result = applyInputRule(rule, state, '`');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('codeBlock');
    expect(firstNode?.attrs.language).toBe('');
  });

  it('converts "```js" to code block with language', () => {
    const state = createStateWithText('```j');
    const result = applyInputRule(rule, state, 's');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('codeBlock');
    expect(firstNode?.attrs.language).toBe('js');
  });

  it('converts "```typescript" to code block with language', () => {
    const state = createStateWithText('```typescrip');
    const result = applyInputRule(rule, state, 't');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('codeBlock');
    expect(firstNode?.attrs.language).toBe('typescript');
  });

  it('does not convert when text exists before the backticks', () => {
    const state = createStateWithText('text ``');
    const result = applyInputRule(rule, state, '`');

    expect(result).toBeNull();
  });

  it('rule pattern matches correctly', () => {
    expect(rule.match.test('```')).toBe(true);
    expect(rule.match.test('```js')).toBe(true);
    expect(rule.match.test('```typescript')).toBe(true);
    expect(rule.match.test('```python')).toBe(true);
    expect(rule.match.test('text ```')).toBe(false);
    // The pattern requires end-of-string match ($ at the end)
    expect(rule.match.test('```js ')).toBe(false);
  });
});

// ============================================================================
// Individual Rule Function Tests
// ============================================================================

describe('Individual Rule Functions', () => {
  it('headingRule creates a valid InputRule', () => {
    const rule = headingRule(testSchema.nodes.heading);
    expect(rule).toBeDefined();
    expect(rule.match).toBeInstanceOf(RegExp);
    expect(typeof rule.handler).toBe('function');
  });

  it('bulletRule creates a valid InputRule', () => {
    const rule = bulletRule(testSchema.nodes.bullet_item);
    expect(rule).toBeDefined();
    expect(rule.match).toBeInstanceOf(RegExp);
    expect(typeof rule.handler).toBe('function');
  });

  it('todoUncheckedRule creates a valid InputRule', () => {
    const rule = todoUncheckedRule(testSchema.nodes.todo_item);
    expect(rule).toBeDefined();
    expect(rule.match).toBeInstanceOf(RegExp);
    expect(typeof rule.handler).toBe('function');
  });

  it('todoCheckedRule creates a valid InputRule', () => {
    const rule = todoCheckedRule(testSchema.nodes.todo_item);
    expect(rule).toBeDefined();
    expect(rule.match).toBeInstanceOf(RegExp);
    expect(typeof rule.handler).toBe('function');
  });

  it('codeBlockRule creates a valid InputRule', () => {
    const rule = codeBlockRule(testSchema.nodes.codeBlock);
    expect(rule).toBeDefined();
    expect(rule.match).toBeInstanceOf(RegExp);
    expect(typeof rule.handler).toBe('function');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('heading rule handles single hash correctly', () => {
    const rule = headingRule(testSchema.nodes.heading);
    const state = createStateWithText('#');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    expect(result!.doc.firstChild?.attrs.level).toBe(1);
  });

  it('preserves text content after transformation for headings', () => {
    // Heading rule replaces the "# " with an empty heading
    // The text content after transformation should be empty (pattern consumed)
    const rule = headingRule(testSchema.nodes.heading);
    const state = createStateWithText('#');
    const result = applyInputRule(rule, state, ' ');

    expect(result).not.toBeNull();
    const firstNode = result!.doc.firstChild;
    expect(firstNode?.type.name).toBe('heading');
    // textblockTypeInputRule replaces the matched text, leaving the block empty
    expect(firstNode?.textContent).toBe('');
  });

  it('multiple rules do not conflict', () => {
    // Test that "# " triggers heading rule, not something else
    const headingR = headingRule(testSchema.nodes.heading);
    const bulletR = bulletRule(testSchema.nodes.bullet_item);

    const stateForHash = createStateWithText('#');
    const hashResult = applyInputRule(headingR, stateForHash, ' ');
    const hashBulletResult = applyInputRule(bulletR, stateForHash, ' ');

    expect(hashResult).not.toBeNull();
    expect(hashBulletResult).toBeNull();

    const stateForDash = createStateWithText('-');
    const dashHeadingResult = applyInputRule(headingR, stateForDash, ' ');
    const dashBulletResult = applyInputRule(bulletR, stateForDash, ' ');

    expect(dashHeadingResult).toBeNull();
    expect(dashBulletResult).not.toBeNull();
  });
});
