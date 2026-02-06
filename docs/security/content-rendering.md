# Content Rendering Security

## The Problem

Users import notes from other apps. Imported content may contain:
- Embedded JavaScript in markdown (e.g., `<script>` tags)
- Event handlers in HTML attributes (e.g., `<img onerror="...">`)
- Data URIs with JavaScript payloads
- SVG with embedded scripts

If rendered unsanitized in the Tauri webview, these achieve XSS.

## Defense Strategy

### 1. DOMPurify

All user-generated or imported HTML passes through DOMPurify before rendering:

```typescript
import DOMPurify from 'dompurify';

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote'],
    ALLOWED_ATTR: ['href', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}
```

**Version pinning**: DOMPurify >= 3.2.4 required. Three CVEs in 2024-2025:

| CVE | Severity | Description | Fixed In |
|-----|----------|-------------|----------|
| CVE-2024-47875 | High (7.9) | Nesting-based mXSS | 2.5.0 / 3.1.3 |
| CVE-2024-48910 | Medium | Prototype pollution → XSS | 2.4.2 |
| CVE-2025-26791 | Medium | mXSS via template literal regex | 3.2.4 |

DOMPurify remains the recommended client-side sanitizer (~17M weekly npm downloads, maintained by Cure53). No production-ready alternative matches its security rigor. The browser-native HTML Sanitizer API is not yet available in Tauri's system webviews.

### 2. Content Security Policy (CSP)

CSP is configured in Tauri's `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' data:",
        "connect-src": "'self'"
      },
      "dangerousDisableAssetCspModification": ["style-src"]
    }
  }
}
```

**Why `unsafe-inline` for styles**: React and CSS-in-JS libraries inject inline styles at runtime. Tauri auto-injects nonces into CSP directives, which causes browsers to ignore `unsafe-inline`. Setting `dangerousDisableAssetCspModification: ["style-src"]` prevents nonce injection for the `style-src` directive specifically, keeping `unsafe-inline` effective. Script protection remains nonce-based.

**Security impact**: CSS injection attacks are rare compared to script injection. This is an accepted trade-off used in Tauri's own official examples.

### 3. ProseMirror Schema Enforcement

ProseMirror's schema defines exactly which node types and marks are allowed. Content that doesn't match the schema is rejected at parse time. This is a structural defense — the editor cannot render arbitrary HTML.

**Attribute validation**: ProseMirror's `validate` property (added in prosemirror-model 1.22.1, fixing CVE-2024-40626) must be set on all custom node/mark attribute specs. Without it, type confusion attacks can replace string attributes with arrays that render as DOM elements. See [ProseMirror docs](../frontend/prosemirror.md) for the schema with validation.

**Pin prosemirror-model >= 1.22.1**.

### 4. Import Sanitization

Content is sanitized at import time, not just at render time:

```
Import file → Parse format → Sanitize each block's content → Store in CozoDB
```

Malicious content never enters the database.

### 5. Paste Sanitization

Clipboard paste is a separate XSS vector from import. When users paste HTML content into ProseMirror:

1. ProseMirror's `clipboardParser` converts pasted HTML to ProseMirror nodes
2. The schema rejects unknown node types (structural defense)
3. **Additionally**, a `transformPastedHTML` plugin hook runs DOMPurify on the raw HTML **before** ProseMirror parses it:

```typescript
// In ProseMirror plugin setup
new Plugin({
  props: {
    transformPastedHTML(html: string): string {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li',
                       'h1', 'h2', 'h3', 'blockquote'],
        ALLOWED_ATTR: ['href', 'class'],
        ALLOW_DATA_ATTR: false,
      });
    },
  },
});
```

This provides defense-in-depth: even if ProseMirror's schema had a gap, DOMPurify strips dangerous content before it reaches the parser.

## Resolved Decisions

- **DOMPurify config**: Allowlist above with `ALLOW_DATA_ATTR: false`. Pin >= 3.2.4.
- **CSP config**: Tauri security config with `dangerousDisableAssetCspModification: ["style-src"]`
- **ProseMirror security boundary**: Schema rejects unknown node types + `validate` on all custom attributes
- **Import sanitization**: DOMPurify runs at import time (before storage). Content is sanitized once, stored clean.
- **Paste sanitization**: `transformPastedHTML` ProseMirror plugin hook runs DOMPurify before schema parsing. Same allowlist as import.
