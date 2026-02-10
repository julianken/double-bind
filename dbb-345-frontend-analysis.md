# DBB-345: Unique Page Names - Frontend State & Component Analysis

## Executive Summary

**Where should state live?**
- **Duplicate detection state**: Ephemeral, component-local (React useState)
- **Navigation decision**: Transient modal state (component-local)
- **Error/warning display**: Inline validation state (within PageTitle component)

**Is this state derived or independent?**
- **Derived**: Duplicate detection is derived from database query (check existing title)
- **Independent**: User's choice (navigate vs rename) is independent user input
- **Ephemeral**: Both states are transient and should NOT persist

**Cache invalidation strategy**:
- Use existing `invalidateQueries(['pages'])` pattern after title change
- No new cache keys needed - reuses existing page query infrastructure

---

## Current Architecture Patterns

### 1. State Management Architecture

The codebase uses **TanStack Query + Zustand** (migrated from pure Zustand):

```typescript
// Source: packages/desktop/src/hooks/useCozoQuery.ts
// - TanStack Query for data fetching/caching
// - Zustand for UI state (sidebar, navigation, focus)
// - Component-local useState for transient form state
```

**Key insight**: The ADR-011 decision document explains this is a **two-source architecture**:
1. **CozoDB (via TanStack Query)**: Source of truth for data
2. **Zustand**: UI state and navigation
3. **Component-local state**: Transient, form-level concerns

### 2. Modal/Dialog Patterns

**Finding**: No existing modal infrastructure

The codebase has:
- ✅ `CommandPalette` - overlay with backdrop, keyboard-first
- ✅ `ErrorBoundary` - error UI patterns
- ❌ **No generic modal/dialog component**

**CommandPalette as reference** (`packages/desktop/src/components/CommandPalette.tsx`):
- Modal overlay with backdrop click dismissal
- Keyboard navigation (Arrow keys, Enter, Escape)
- Focus trap with input autofocus
- Z-index layering via CSS
- WCAG 2.1 AA compliant

### 3. Navigation State (Zustand)

```typescript
// Source: packages/desktop/src/stores/ui-store.ts
interface AppStore {
  currentPageId: string | null;
  pageHistory: string[];
  historyIndex: number;
  navigateToPage: (pageId: string) => void;
  goBack: () => void;
  goForward: () => void;
}
```

**Navigation flow**:
1. User action (e.g., create page, rename page)
2. Call `navigateToPage('page/' + pageId)`
3. Zustand updates history and currentPageId
4. Router re-renders with new page

### 4. Inline Error/Validation Patterns

**PageTitle component** (`packages/desktop/src/components/PageTitle.tsx`):
- Local state for editing: `const [localTitle, setLocalTitle] = useState(title)`
- Saving state: `const [isSaving, setIsSaving] = useState(false)`
- Error handling: Reverts on error, callback handles error reporting
- Debounced saves (500ms)

**Key pattern**: **Optimistic updates with rollback on error**

```typescript
try {
  await onSave(newTitle);
  lastSavedTitleRef.current = newTitle;
} catch {
  // Revert on error - onSave callback handles error reporting
  setLocalTitle(lastSavedTitleRef.current);
}
```

### 5. Page Creation Flow

**useCreatePage hook** (`packages/desktop/src/hooks/useCreatePage.ts`):

```typescript
const createPage = async (title = 'Untitled') => {
  setIsCreating(true);
  try {
    const page = await pageService.createPage(title);
    invalidateQueries(['pages']); // ← Cache invalidation
    navigateToPage('page/' + page.pageId); // ← Navigation
    return { page, error: null };
  } catch (err) {
    setError(err);
    return { page: null, error };
  }
};
```

**Pattern**: Create → Invalidate → Navigate

---

## Design Recommendations for DBB-345

### Option 1: Modal Confirmation (Recommended)

**State Flow**:
```
User types new title → PageTitle onChange
  ↓
Check for duplicate (debounced query)
  ↓
Duplicate found → Show modal
  ↓
User choice:
  - Navigate → navigateToPage(existingPageId)
  - Rename → Proceed with save, append suffix
  - Cancel → Revert to previous title
```

**State Location**:
- **Modal state**: Component-local in PageTitle (`const [showDuplicateModal, setShowDuplicateModal] = useState(false)`)
- **Duplicate check**: TanStack Query (ephemeral, not cached)
- **Navigation decision**: Immediate action (no persistent state)

**Implementation**:
1. Create `DuplicatePageModal.tsx` (similar to CommandPalette overlay)
2. Add duplicate check in `PageTitle.tsx` before save
3. Use existing `navigateToPage()` for navigation option
4. Use existing `onSave()` callback with modified title for rename option

### Option 2: Inline Warning (Alternative)

**State Flow**:
```
User types new title → PageTitle onChange
  ↓
Check for duplicate (debounced query)
  ↓
Duplicate found → Show inline warning + action buttons
  ↓
User clicks action:
  - Navigate link → navigateToPage(existingPageId)
  - "Use anyway" → Append suffix, save
```

**State Location**:
- **Warning state**: Component-local in PageTitle (`const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)`)
- **Duplicate check**: Same as Option 1

**Pros**:
- Less intrusive than modal
- Follows inline validation pattern (similar to form errors)

**Cons**:
- Less visible for important decision
- Harder to implement keyboard-first UX

### Recommended: **Option 1 (Modal)**

**Rationale**:
1. **Interrupts flow appropriately** - This is a significant decision (navigate vs create duplicate)
2. **Keyboard-first** - Follows CommandPalette pattern (already proven in codebase)
3. **Clear affordances** - Three explicit buttons (Navigate, Rename, Cancel)
4. **Accessibility** - Focus trap, Escape to dismiss, clear ARIA labels

---

## State Colocation Analysis

### Where does duplicate detection state live?

**Answer**: Component-local in `PageTitle.tsx`

**Reasoning** (from state colocation principles):
1. **Scope**: Only PageTitle component needs this state
2. **Lifetime**: Ephemeral (exists only during editing session)
3. **Sharing**: No other components need access
4. **Persistence**: Should NOT persist across page reloads

### Is this state derived or independent?

**Answer**: **Derived** from database query

**Implementation**:
```typescript
// In PageTitle.tsx
const checkDuplicate = useCallback(async (newTitle: string) => {
  const existing = await pageService.getByTitle(newTitle);
  if (existing && existing.pageId !== pageId) {
    setDuplicatePageId(existing.pageId);
    setShowDuplicateModal(true);
  }
}, [pageService, pageId]);
```

**Key insight**: This is NOT cached via TanStack Query - it's a one-time check during save.

### Cache Invalidation Strategy

**Answer**: Reuse existing patterns

**After title change** (if user chooses "Rename"):
```typescript
await pageService.updateTitle(pageId, modifiedTitle);
invalidateQueries(['pages']); // ← Existing pattern
invalidateQueries(['page', 'withBlocks']); // ← Existing pattern
```

**After navigation** (if user chooses "Navigate"):
```typescript
navigateToPage('page/' + existingPageId); // ← Existing pattern
// No invalidation needed - just navigation
```

**No new query keys needed** ✅

---

## Component Architecture

### New Components Needed

1. **`DuplicatePageModal.tsx`**
   - Props: `isOpen`, `existingPageTitle`, `onNavigate`, `onRename`, `onCancel`
   - Pattern: Copy CommandPalette overlay structure
   - Location: `packages/desktop/src/components/`

2. **Modified: `PageTitle.tsx`**
   - Add duplicate check in `handleBlur` (before save)
   - Add modal state and handlers
   - Integrate with existing `onSave` callback

### No Changes Needed

- ❌ No Zustand store modifications
- ❌ No new TanStack Query keys
- ❌ No new service methods (reuse `pageService.getByTitle()`)

---

## Accessibility & UX Patterns

### Keyboard Navigation (from CommandPalette)

Modal should support:
- **Escape** → Cancel (close modal)
- **Enter** → Confirm primary action (Navigate)
- **Tab** → Cycle between buttons
- **Arrow keys** → Optional (for 3-button layout)

### Focus Management

```typescript
useEffect(() => {
  if (isOpen) {
    // Focus first button after modal opens
    requestAnimationFrame(() => {
      navigateButtonRef.current?.focus();
    });
  }
}, [isOpen]);
```

### ARIA Labels

```typescript
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="duplicate-modal-title"
  aria-describedby="duplicate-modal-description"
>
  <h2 id="duplicate-modal-title">Page Already Exists</h2>
  <p id="duplicate-modal-description">
    A page titled "{existingTitle}" already exists. Would you like to navigate to it?
  </p>
  {/* Buttons */}
</div>
```

---

## Implementation Checklist

### Phase 1: Backend (Already in DBB-345 spec)
- [ ] Add unique constraint on page titles (schema migration)
- [ ] Update `PageRepository.update()` to handle conflict
- [ ] Add `PageService.renamePage()` with suffix logic

### Phase 2: Frontend State (This analysis)
- [ ] Create `DuplicatePageModal.tsx` component
- [ ] Add duplicate check in `PageTitle.tsx`
- [ ] Wire up navigation vs rename logic
- [ ] Add inline loading state during duplicate check

### Phase 3: UX Polish
- [ ] Keyboard shortcuts (Escape, Enter, Tab)
- [ ] Focus trap in modal
- [ ] WCAG 2.1 AA compliance
- [ ] Loading/saving states

### Phase 4: Testing
- [ ] Unit test: Duplicate detection logic
- [ ] Unit test: Suffix generation (edge cases)
- [ ] E2E test: Modal navigation flow
- [ ] E2E test: Modal rename flow
- [ ] E2E test: Keyboard navigation

---

## Example Component API

```typescript
// DuplicatePageModal.tsx
interface DuplicatePageModalProps {
  isOpen: boolean;
  existingPageId: string;
  existingPageTitle: string;
  attemptedTitle: string;
  onNavigate: () => void;
  onRename: () => void;
  onCancel: () => void;
}

// PageTitle.tsx (modified)
const handleSaveTitle = async (newTitle: string) => {
  // Check for duplicate
  const existing = await pageService.getByTitle(newTitle);
  
  if (existing && existing.pageId !== pageId) {
    // Show modal
    setDuplicateInfo({ pageId: existing.pageId, title: existing.title });
    setShowDuplicateModal(true);
    return; // Don't save yet
  }
  
  // No duplicate - proceed with save
  await onSave(newTitle);
};

const handleNavigateToExisting = () => {
  setShowDuplicateModal(false);
  navigateToPage('page/' + duplicateInfo.pageId);
};

const handleRenameWithSuffix = async () => {
  setShowDuplicateModal(false);
  const modifiedTitle = await pageService.generateUniqueTitle(attemptedTitle);
  await onSave(modifiedTitle);
};
```

---

## Open Questions

1. **Should duplicate check be debounced or only on blur?**
   - Recommendation: **Only on blur/Enter** (less aggressive, matches existing save pattern)

2. **Should we show "Page already exists" inline while typing?**
   - Recommendation: **No** (too aggressive, would require continuous queries)

3. **What's the default action in modal (Navigate vs Rename)?**
   - Recommendation: **Navigate** (safer default, avoids accidental duplicates)

4. **Should Cancel revert to previous title or keep new title?**
   - Recommendation: **Revert** (matches Escape behavior in PageTitle)

5. **Should we cache duplicate check results?**
   - Recommendation: **No** (one-time check, not worth caching)

---

## References

- CommandPalette: `packages/desktop/src/components/CommandPalette.tsx`
- PageTitle: `packages/desktop/src/components/PageTitle.tsx`
- useCreatePage: `packages/desktop/src/hooks/useCreatePage.ts`
- UI Store: `packages/desktop/src/stores/ui-store.ts`
- State Management Doc: `docs/frontend/state-management.md`
- ADR-011: `docs/decisions/011-state-management.md`
