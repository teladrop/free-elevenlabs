/**
 * Feature Flags
 *
 * Single source of truth for all feature-flag checks in the data-intelligence
 * layer.  Flags are read from environment variables at runtime so they can be
 * toggled without a code change.
 *
 * All flags default to FALSE — the new layer is opt-in.
 * Existing behavior is preserved when all flags are false.
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 * ENABLE_DATA_CACHE=true          Master switch for the whole layer
 * ENABLE_YOUTUBE_DATA_LAYER=true  YouTube Supabase cache
 * ENABLE_TRENDS_DATA_LAYER=true   Google Trends Supabase cache
 * ENABLE_STALE_WHILE_REVALIDATE=true  Serve stale + queue refresh
 * ENABLE_QUOTA_PROTECTION=true    Block low-priority requests near quota limit
 * ENABLE_EXTERNAL_DATA_RANKING_SIGNALS=false  (reserved — do not enable yet)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type FeatureFlag =
  | 'ENABLE_DATA_CACHE'
  | 'ENABLE_YOUTUBE_DATA_LAYER'
  | 'ENABLE_TRENDS_DATA_LAYER'
  | 'ENABLE_STALE_WHILE_REVALIDATE'
  | 'ENABLE_QUOTA_PROTECTION'
  | 'ENABLE_EXTERNAL_DATA_RANKING_SIGNALS';

/**
 * Returns true when a flag is explicitly set to "true" (case-insensitive).
 * Anything else (missing, "false", "0") returns false.
 *
 * The master switch ENABLE_DATA_CACHE must also be true for sub-flags to fire,
 * unless the flag IS the master switch.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const raw = (process.env[flag] ?? '').trim().toLowerCase();
  const flagOn = raw === 'true' || raw === '1';

  // The master switch itself doesn't need to check itself
  if (flag === 'ENABLE_DATA_CACHE') return flagOn;

  // Every other flag also requires the master switch
  const masterOn =
    (process.env.ENABLE_DATA_CACHE ?? '').trim().toLowerCase() === 'true' ||
    (process.env.ENABLE_DATA_CACHE ?? '').trim() === '1';

  return masterOn && flagOn;
}

/**
 * Convenience — returns true when ANY data-layer flag is enabled.
 * Useful for skipping import-cost paths when everything is disabled.
 */
export function isAnyDataLayerEnabled(): boolean {
  return (
    isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER') ||
    isFeatureEnabled('ENABLE_TRENDS_DATA_LAYER')
  );
}
