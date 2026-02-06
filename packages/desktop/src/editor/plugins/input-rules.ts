/**
 * Input Rules Plugin
 *
 * Handles markdown-style shortcuts for block transformations:
 * - `# `, `## `, `### ` -> headings (levels 1-3)
 * - `- `, `* ` -> bullet items
 * - `[] `, `[ ] ` -> todo items (unchecked)
 * - `[x] ` -> todo items (checked)
 * - ``` -> code blocks
 *
 * Rules only trigger at the start of an empty or new block.
 */

import { InputRule, inputRules, textblockTypeInputRule } from 'prosemirror-inputrules';
import type { Schema, NodeType } from 'prosemirror-model';
import type { Plugin } from 'prosemirror-state';

/**
 * Creates an input rule that converts `# ` at block start to heading level 1,
 * `## ` to heading level 2, and `### ` to heading level 3.
 *
 * The pattern captures 1-3 hash characters followed by a space at the start
 * of a textblock.
 */
export function headingRule(nodeType: NodeType, maxLevel: number = 3): InputRule {
  // Match 1-N hash symbols followed by a space at the start of a line
  // The {1,N} quantifier limits how many levels we support
  const pattern = new RegExp(`^(#{1,${maxLevel}})\\s$`);

  return textblockTypeInputRule(pattern, nodeType, (match) => ({
    level: match[1]?.length ?? 1,
  }));
}

/**
 * Creates an input rule that converts `- ` or `* ` at block start
 * to a bullet item.
 */
export function bulletRule(nodeType: NodeType): InputRule {
  // Match dash or asterisk followed by a space at the start of a line
  const pattern = /^[-*]\s$/;

  return textblockTypeInputRule(pattern, nodeType);
}

/**
 * Creates an input rule that converts `[] `, `[ ] ` at block start
 * to an unchecked todo item.
 */
export function todoUncheckedRule(nodeType: NodeType): InputRule {
  // Match [] or [ ] followed by a space at the start of a line
  const pattern = /^\[\s?\]\s$/;

  return textblockTypeInputRule(pattern, nodeType, () => ({
    checked: false,
  }));
}

/**
 * Creates an input rule that converts `[x] ` at block start
 * to a checked todo item.
 */
export function todoCheckedRule(nodeType: NodeType): InputRule {
  // Match [x] followed by a space at the start of a line (case-insensitive for x)
  const pattern = /^\[[xX]\]\s$/;

  return textblockTypeInputRule(pattern, nodeType, () => ({
    checked: true,
  }));
}

/**
 * Creates an input rule that converts triple backticks at block start
 * to a code block.
 *
 * Supports optional language identifier: ```js, ```typescript, etc.
 */
export function codeBlockRule(nodeType: NodeType): InputRule {
  // Match ``` optionally followed by a language identifier at line start
  const pattern = /^```([a-zA-Z]*)?$/;

  return textblockTypeInputRule(pattern, nodeType, (match) => ({
    language: match[1] || '',
  }));
}

/**
 * Configuration for which input rules to enable.
 * All rules are enabled by default.
 */
export interface InputRulesConfig {
  /** Enable heading conversion (# , ## , ### ) */
  headings?: boolean;
  /** Maximum heading level (default: 3) */
  maxHeadingLevel?: number;
  /** Enable bullet conversion (- , * ) */
  bullets?: boolean;
  /** Enable todo conversion ([] , [ ] , [x] ) */
  todos?: boolean;
  /** Enable code block conversion (```) */
  codeBlocks?: boolean;
}

const defaultConfig: Required<InputRulesConfig> = {
  headings: true,
  maxHeadingLevel: 3,
  bullets: true,
  todos: true,
  codeBlocks: true,
};

/**
 * Creates the input rules plugin with all markdown shortcuts.
 *
 * @param schema - The ProseMirror schema containing the node types
 * @param config - Optional configuration to enable/disable specific rules
 * @returns A ProseMirror plugin that handles the input rules
 *
 * @example
 * ```typescript
 * const plugin = createInputRulesPlugin(schema);
 * const state = EditorState.create({ schema, plugins: [plugin] });
 * ```
 *
 * @example
 * ```typescript
 * // Disable todo rules
 * const plugin = createInputRulesPlugin(schema, { todos: false });
 * ```
 */
export function createInputRulesPlugin(schema: Schema, config: InputRulesConfig = {}): Plugin {
  const mergedConfig = { ...defaultConfig, ...config };
  const rules: InputRule[] = [];

  // Add heading rules if enabled and heading node type exists
  if (mergedConfig.headings && schema.nodes.heading) {
    rules.push(headingRule(schema.nodes.heading, mergedConfig.maxHeadingLevel));
  }

  // Add bullet rules if enabled and bullet_item node type exists
  if (mergedConfig.bullets && schema.nodes.bullet_item) {
    rules.push(bulletRule(schema.nodes.bullet_item));
  }

  // Add todo rules if enabled and todo_item node type exists
  if (mergedConfig.todos && schema.nodes.todo_item) {
    rules.push(todoUncheckedRule(schema.nodes.todo_item));
    rules.push(todoCheckedRule(schema.nodes.todo_item));
  }

  // Add code block rules if enabled and codeBlock node type exists
  if (mergedConfig.codeBlocks && schema.nodes.codeBlock) {
    rules.push(codeBlockRule(schema.nodes.codeBlock));
  }

  return inputRules({ rules });
}

// Re-export types for convenience
export type { InputRule } from 'prosemirror-inputrules';
