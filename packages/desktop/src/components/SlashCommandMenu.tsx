/**
 * SlashCommandMenu - Floating block-type picker triggered by `/`
 *
 * Listens for `slash-command-open` and `slash-command-close` CustomEvents
 * dispatched by the slash-commands ProseMirror plugin (DBB-447).
 *
 * Renders a floating menu with block type options. Supports:
 * - Arrow key navigation (ArrowUp / ArrowDown)
 * - Enter to select the highlighted item
 * - Escape to close
 * - Click to select
 *
 * CustomEvent contract (from slash-commands.ts plugin):
 *   `slash-command-open`
 *     - detail.pos    — ProseMirror document position of the `/`
 *     - detail.coords — { top, left, bottom, right } bounding rect
 *
 *   `slash-command-close`
 *     - detail        — {}
 *
 * @see packages/desktop/src/editor/plugins/slash-commands.ts
 */

import { memo, useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react';
import styles from './SlashCommandMenu.module.css';

// ============================================================================
// Block Command Definitions
// ============================================================================

export type BlockCommandId =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet-list'
  | 'numbered-list'
  | 'blockquote'
  | 'code-block'
  | 'divider';

export interface BlockCommand {
  id: BlockCommandId;
  label: string;
  description: string;
  /** Keyboard shortcut hint shown in the menu */
  shortcut?: string;
}

export const BLOCK_COMMANDS: BlockCommand[] = [
  {
    id: 'text',
    label: 'Text',
    description: 'Start with a plain paragraph',
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Large section heading',
    shortcut: '# ',
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Medium section heading',
    shortcut: '## ',
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small section heading',
    shortcut: '### ',
  },
  {
    id: 'bullet-list',
    label: 'Bullet List',
    description: 'Create an unordered list',
    shortcut: '- ',
  },
  {
    id: 'numbered-list',
    label: 'Numbered List',
    description: 'Create an ordered list',
    shortcut: '1. ',
  },
  {
    id: 'blockquote',
    label: 'Blockquote',
    description: 'Capture a quotation',
    shortcut: '> ',
  },
  {
    id: 'code-block',
    label: 'Code Block',
    description: 'Write a code snippet',
    shortcut: '``` ',
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Insert a horizontal rule',
    shortcut: '--- ',
  },
];

// ============================================================================
// Types
// ============================================================================

export interface SlashCommandCoords {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface SlashCommandMenuState {
  open: boolean;
  pos: number;
  coords: SlashCommandCoords;
}

export interface SlashCommandMenuProps {
  /**
   * Called when the user selects a block type.
   * The consumer is responsible for applying the transformation to the editor.
   */
  onSelect?: (command: BlockCommand) => void;

  /**
   * Called when the menu is closed without selecting.
   */
  onClose?: () => void;

  /**
   * Test ID for the menu container.
   */
  testId?: string;
}

// ============================================================================
// SlashCommandMenu Component
// ============================================================================

/**
 * SlashCommandMenu - A floating command picker for block type selection.
 *
 * Self-manages open/close state via document-level CustomEvent listeners.
 * Supports full keyboard navigation: ArrowUp/Down, Enter to select, Escape
 * to close.
 *
 * @example
 * ```tsx
 * <SlashCommandMenu
 *   onSelect={(command) => applyBlockType(command.id)}
 *   onClose={() => closeSlashCommand(view)}
 * />
 * ```
 */
export const SlashCommandMenu = memo(function SlashCommandMenu({
  onSelect,
  onClose,
  testId = 'slash-command-menu',
}: SlashCommandMenuProps) {
  const [menuState, setMenuState] = useState<SlashCommandMenuState>({
    open: false,
    pos: 0,
    coords: { top: 0, left: 0, bottom: 0, right: 0 },
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset active index when menu opens
  const openMenu = useCallback((pos: number, coords: SlashCommandCoords) => {
    setMenuState({ open: true, pos, coords });
    setActiveIndex(0);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, open: false }));
    onClose?.();
  }, [onClose]);

  // Listen for CustomEvents from the ProseMirror plugin
  useEffect(() => {
    function handleOpen(event: Event) {
      const e = event as CustomEvent<{ pos: number; coords: SlashCommandCoords }>;
      openMenu(e.detail.pos, e.detail.coords);
    }

    function handleClose() {
      setMenuState((prev) => ({ ...prev, open: false }));
      // Do not call onClose here — the plugin already handled it
    }

    document.addEventListener('slash-command-open', handleOpen);
    document.addEventListener('slash-command-close', handleClose);

    return () => {
      document.removeEventListener('slash-command-open', handleOpen);
      document.removeEventListener('slash-command-close', handleClose);
    };
  }, [openMenu]);

  // Keyboard navigation handler attached to document when menu is open
  const handleKeyDown = useCallback(
    (e: globalThis.KeyboardEvent) => {
      if (!menuState.open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % BLOCK_COMMANDS.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + BLOCK_COMMANDS.length) % BLOCK_COMMANDS.length);
          break;
        case 'Enter': {
          e.preventDefault();
          const command = BLOCK_COMMANDS[activeIndex];
          if (command) {
            onSelect?.(command);
            closeMenu();
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          closeMenu();
          break;
      }
    },
    [menuState.open, activeIndex, onSelect, closeMenu]
  );

  useEffect(() => {
    if (menuState.open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuState.open, handleKeyDown]);

  // Scroll active item into view when navigating
  useEffect(() => {
    if (!menuState.open || !listRef.current) return;
    const activeItem = listRef.current.children[activeIndex] as HTMLElement | undefined;
    // scrollIntoView may not be available in all environments (e.g. jsdom in tests)
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, menuState.open]);

  const handleItemClick = useCallback(
    (command: BlockCommand) => {
      onSelect?.(command);
      closeMenu();
    },
    [onSelect, closeMenu]
  );

  // React keyboard handler for the menu container (accessible)
  const handleMenuKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Navigation is handled by the document listener above, but we stop
      // propagation here so ProseMirror doesn't also receive these keys.
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        e.stopPropagation();
      }
    },
    []
  );

  if (!menuState.open) {
    return null;
  }

  // Position the menu below the cursor using fixed coordinates from the plugin
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: menuState.coords.bottom + 4,
    left: menuState.coords.left,
  };

  return (
    <div
      ref={menuRef}
      className={styles.slashMenu}
      style={menuStyle}
      role="listbox"
      aria-label="Block type commands"
      aria-activedescendant={`slash-command-item-${BLOCK_COMMANDS[activeIndex]?.id}`}
      onKeyDown={handleMenuKeyDown}
      data-testid={testId}
    >
      <div className={styles.slashMenuHeader}>Turn into</div>
      <ul
        ref={listRef}
        className={styles.slashMenuList}
        role="presentation"
      >
        {BLOCK_COMMANDS.map((command, index) => (
          <li
            key={command.id}
            id={`slash-command-item-${command.id}`}
            className={[
              styles.slashMenuItem,
              index === activeIndex ? styles['slashMenuItem--active'] : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="option"
            aria-selected={index === activeIndex}
            onClick={() => handleItemClick(command)}
            onMouseEnter={() => setActiveIndex(index)}
            data-testid={`slash-command-item-${command.id}`}
          >
            <span className={styles.slashMenuItemLabel}>{command.label}</span>
            <span className={styles.slashMenuItemDescription}>{command.description}</span>
            {command.shortcut && (
              <span className={styles.slashMenuItemShortcut}>{command.shortcut}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';
