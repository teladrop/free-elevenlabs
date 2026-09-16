import { NextRequest, NextResponse } from 'next/server';

/**
 * proxy.ts — Next.js 16 auth guard
 * (renamed from middleware.ts in Next.js 16)
 *
 * Redirects unauthenticated users to the landing page.
 * Protected: all app routes except /, /auth/*, and /api/*
 */

// Routes that are always public
const PUBLIC_PATHS    = ['/', '/auth/complete'];
const PUBLIC_PREFIXES = ['/api/', '/_next/', '/favicon', '/images/'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

/** Check JWT expiry client-side without a network call */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() / 1000 > payload.exp;
  } catch { return true; }
}

/** Extract the Supabase access token from cookies */
function getSupabaseToken(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const eq = cookie.indexOf('=');
    if (eq === -1) continue;
    const name  = cookie.slice(0, eq).trim();
    const value = cookie.slice(eq + 1).trim();

    if (
      name.includes('-auth-token') ||
      name === 'sb-access-token'  ||
      name === 'sb-temp-auth-token'
    ) {
      try {
        const decoded = decodeURIComponent(value);
        // Chunked storage array: ["<base64>","<base64>"]
        if (decoded.startsWith('[')) {
          const parts    = JSON.parse(decoded) as string[];
          const combined = parts.join('');
          try {
            const sess = JSON.parse(combined) as { access_token?: string };
            if (sess?.access_token) return sess.access_token;
          } catch {}
        }
        // Session JSON object
        if (decoded.startsWith('{')) {
          const sess = JSON.parse(decoded) as { access_token?: string };
          if (sess?.access_token) return sess.access_token;
        }
        // Raw JWT
        if (decoded.startsWith('eyJ') && decoded.length > 50) return decoded;
      } catch {
        if (value.startsWith('eyJ') && value.length > 50) return value;
      }
    }
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = getSupabaseToken(request.headers.get('cookie') ?? '');

  if (!token || isTokenExpired(token)) {
    const landing = new URL('/', request.url);
    landing.searchParams.set('redirect', pathname);
    return NextResponse.redirect(landing);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
