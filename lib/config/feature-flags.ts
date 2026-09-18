/**
 * Feature Flags
 *
 * Single source of truth for all feature-flag checks in the data-intelligence
 * layer.  Flags are read from environment variables at runtime so they can be
 * toggled without a code change.
 *
 * YouTube search cache defaults ON so repeat researches share quota.
 * Set ENABLE_YOUTUBE_DATA_LAYER=false to disable. Trends flags stay opt-in.
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 * ENABLE_DATA_CACHE               default ON
 * ENABLE_YOUTUBE_DATA_LAYER       default ON
 * ENABLE_TRENDS_DATA_LAYER        default OFF
 * ENABLE_STALE_WHILE_REVALIDATE   default ON
 * ENABLE_QUOTA_PROTECTION         default OFF
 * ENABLE_EXTERNAL_DATA_RANKING_SIGNALS  default OFF
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
const DEFAULT_ON: Partial<Record<FeatureFlag, boolean>> = {
  ENABLE_DATA_CACHE: true,
  ENABLE_YOUTUBE_DATA_LAYER: true,
  ENABLE_STALE_WHILE_REVALIDATE: true,
};

function envFlag(flag: FeatureFlag): boolean {
  const raw = (process.env[flag] ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return DEFAULT_ON[flag] === true;
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  if (flag === 'ENABLE_DATA_CACHE') return envFlag(flag);
  return envFlag('ENABLE_DATA_CACHE') && envFlag(flag);
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
