/**
 * graphTokens.ts — OKLCH community color palette for graph nodes.
 *
 * Reads CSS custom properties from the document when available (browser/Tauri),
 * falling back to hardcoded OKLCH strings for test environments.
 *
 * CSS tokens are defined in:
 *   packages/ui-primitives/src/styles/tokens/primitives/colors-graph.css
 *
 * Theme adaptation: tokens change at [data-theme="dark"] / [data-theme="dim"]
 * automatically — callers only need to call getCommunityColor() with isDark
 * so the canvas can choose the correct resolved value.
 */

// ---------------------------------------------------------------------------
// CSS token names (8 community slots + structural tokens)
// ---------------------------------------------------------------------------

const COMMUNITY_TOKEN_NAMES = [
  '--graph-c0', // indigo
  '--graph-c1', // amber
  '--graph-c2', // emerald
  '--graph-c3', // rose
  '--graph-c4', // chartreuse
  '--graph-c5', // teal
  '--graph-c6', // violet
  '--graph-c7', // coral
] as const;

// ---------------------------------------------------------------------------
// Hardcoded fallbacks (used in non-browser environments / SSR / test)
// ---------------------------------------------------------------------------

const FALLBACK_LIGHT: readonly string[] = [
  'oklch(62% 0.14 283)',
  'oklch(62% 0.15 30)',
  'oklch(62% 0.15 145)',
  'oklch(62% 0.14 330)',
  'oklch(62% 0.14 80)',
  'oklch(62% 0.14 200)',
  'oklch(62% 0.14 250)',
  'oklch(62% 0.15 10)',
];

const FALLBACK_DARK: readonly string[] = [
  'oklch(68% 0.14 283)',
  'oklch(70% 0.15 30)',
  'oklch(68% 0.15 145)',
  'oklch(68% 0.14 330)',
  'oklch(68% 0.14 80)',
  'oklch(68% 0.14 200)',
  'oklch(68% 0.14 250)',
  'oklch(70% 0.15 10)',
];

/** Orphan / connectivity fallbacks */
export const GRAPH_TOKEN_FALLBACKS = {
  orphan: 'oklch(62% 0.18 25)',
  lowConnect: 'oklch(64% 0.15 55)',
  wellConnect: 'oklch(60% 0.14 145)',
  recencyCold: 'oklch(60% 0.10 230)',
  recencyWarm: 'oklch(68% 0.16 40)',
  highlight: 'oklch(68% 0.20 55)', // amber highlight
  edge: 'oklch(55% 0.04 265)',
  label: 'oklch(50% 0.04 265)',
} as const;

// ---------------------------------------------------------------------------
// Token reader helpers
// ---------------------------------------------------------------------------

/**
 * Read a CSS custom property from the document root.
 * Returns an empty string if the environment has no document.
 */
function readToken(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Read a structural graph token (non-community), with optional fallback.
 */
export function readGraphToken(
  tokenName: string,
  fallback: string
): string {
  const value = readToken(tokenName);
  return value !== '' ? value : fallback;
}

// ---------------------------------------------------------------------------
// Community color lookup
// ---------------------------------------------------------------------------

/**
 * Return the OKLCH color string for a given community ID.
 *
 * Attempts to read the resolved CSS token value from the document so that
 * theme changes are reflected automatically. Falls back to hardcoded OKLCH
 * strings in environments without a DOM (tests, SSR).
 *
 * @param communityId - Community index (non-negative integer); wraps cyclically.
 * @param isDark - Whether the current theme is dark/dim (used for fallback path only).
 */
export function getCommunityColor(communityId: number, isDark: boolean): string {
  const idx = Math.abs(communityId) % COMMUNITY_TOKEN_NAMES.length;
  const tokenName = COMMUNITY_TOKEN_NAMES[idx];

  // Try to read live CSS token
  if (tokenName !== undefined) {
    const liveValue = readToken(tokenName);
    if (liveValue !== '') return liveValue;
  }

  // Fallback for non-browser environments
  const palette = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
  return palette[idx] ?? FALLBACK_LIGHT[0]!;
}

/**
 * Return the full resolved community color palette (8 colors).
 * Useful for legends or batch canvas draws.
 */
export function getCommunityPalette(isDark: boolean): string[] {
  return Array.from({ length: COMMUNITY_TOKEN_NAMES.length }, (_, i) =>
    getCommunityColor(i, isDark)
  );
}
