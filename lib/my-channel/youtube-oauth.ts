/**
 * YouTube OAuth — server-side only
 *
 * Handles the YouTube Data API OAuth 2.0 flow:
 *   1. Build the authorization URL (send user to Google consent)
 *   2. Exchange the authorization code for tokens
 *   3. Refresh an expired access token
 *   4. Revoke tokens on disconnect
 *
 * NEVER called from Client Components.
 * Tokens are NEVER returned to the browser.
 *
 * Scopes requested (read-only, minimum required):
 *   - https://www.googleapis.com/auth/youtube.readonly
 *     → read channel info, video list, playlists
 *   - https://www.googleapis.com/auth/yt-analytics.readonly  (optional)
 *     → private analytics (views, watch time, etc.)
 *
 * Environment variables required:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL   (for the redirect_uri)
 */

const GOOGLE_AUTH_URL    = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL   = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL  = 'https://oauth2.googleapis.com/revoke';

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  // Uncomment to request private analytics in a future iteration:
  // 'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ');

function getRedirectUri(requestOrigin?: string): string {
  // Priority: explicit origin from the live request > env var > localhost fallback
  // This ensures Vercel deployments use the correct production URL, not localhost
  const base =
    requestOrigin ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';
  return `${base}/api/my-channel/callback`;
}

function getClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error('GOOGLE_CLIENT_ID is not configured');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error('GOOGLE_CLIENT_SECRET is not configured');
  return secret;
}

// ─── 1. Build authorization URL ───────────────────────────────────────────────

export function buildYouTubeAuthUrl(state: string, requestOrigin?: string): string {
  const params = new URLSearchParams({
    client_id:     getClientId(),
    redirect_uri:  getRedirectUri(requestOrigin),
    response_type: 'code',
    scope:         YOUTUBE_SCOPES,
    access_type:   'offline',   // request refresh_token
    prompt:        'consent',   // always show consent so we get refresh_token
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ─── 2. Token exchange ────────────────────────────────────────────────────────

export interface YouTubeTokens {
  access_token:  string;
  refresh_token: string | null;
  expires_in:    number;      // seconds
  expires_at:    Date;
  token_type:    string;
  scope:         string;
}

export async function exchangeCodeForTokens(code: string, requestOrigin?: string): Promise<YouTubeTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     getClientId(),
      client_secret: getClientSecret(),
      redirect_uri:  getRedirectUri(requestOrigin),
      grant_type:    'authorization_code',
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Token exchange failed (${res.status}): ${body.error_description ?? body.error ?? res.statusText}`,
    );
  }

  const data = await res.json();
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token ?? null,
    expires_in:    data.expires_in ?? 3600,
    expires_at:    new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    token_type:    data.token_type ?? 'Bearer',
    scope:         data.scope ?? '',
  };
}

// ─── 3. Refresh access token ──────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at:   Date;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     getClientId(),
      client_secret: getClientSecret(),
      grant_type:    'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Token refresh failed (${res.status}): ${body.error_description ?? body.error ?? res.statusText}`,
    );
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_at:   new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  };
}

// ─── 4. Get a valid access token (auto-refresh if expired) ───────────────────

export async function getValidAccessToken(connection: {
  access_token:   string | null;
  refresh_token:  string | null;
  token_expires_at: string | null;
}): Promise<{ access_token: string; refreshed: boolean; new_expires_at?: Date }> {
  if (!connection.access_token) {
    throw new Error('No access token stored — user must reconnect YouTube.');
  }

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at)
    : null;

  // Consider token expired if it expires within 5 minutes
  const isExpired = expiresAt
    ? Date.now() > expiresAt.getTime() - 5 * 60 * 1000
    : false;

  if (!isExpired) {
    return { access_token: connection.access_token, refreshed: false };
  }

  if (!connection.refresh_token) {
    throw new Error('Access token expired and no refresh token stored — user must reconnect.');
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  return {
    access_token:    refreshed.access_token,
    refreshed:       true,
    new_expires_at:  refreshed.expires_at,
  };
}

// ─── 5. Revoke tokens (on disconnect) ────────────────────────────────────────

export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    });
    // Revocation errors are non-fatal (token may already be expired)
  } catch {
    // Ignore network errors during revocation
  }
}

// ─── 6. Fetch the authenticated user's channel ───────────────────────────────

export interface YouTubeOwnChannel {
  channelId:       string;
  title:           string;
  handle:          string;
  thumbnailUrl:    string;
  subscriberCount: number;
  videoCount:      number;
  viewCount:       number;
  publishedAt:     string;
  description:     string;
}

export async function fetchOwnChannel(accessToken: string): Promise<YouTubeOwnChannel> {
  const url = 'https://www.googleapis.com/youtube/v3/channels'
    + '?part=snippet,statistics,brandingSettings'
    + '&mine=true';

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new Error('YouTube authorization expired — please reconnect your channel.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to fetch channel (${res.status}): ${body.error?.message ?? res.statusText}`,
    );
  }

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) {
    throw new Error('No YouTube channel found for this Google account.');
  }

  return {
    channelId:       item.id,
    title:           item.snippet?.title ?? '',
    handle:          item.snippet?.customUrl ?? '',
    thumbnailUrl:    item.snippet?.thumbnails?.medium?.url
                  ?? item.snippet?.thumbnails?.default?.url
                  ?? '',
    subscriberCount: parseInt(item.statistics?.subscriberCount ?? '0', 10),
    videoCount:      parseInt(item.statistics?.videoCount ?? '0', 10),
    viewCount:       parseInt(item.statistics?.viewCount ?? '0', 10),
    publishedAt:     item.snippet?.publishedAt ?? '',
    description:     (item.snippet?.description ?? '').slice(0, 500),
  };
}
