import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth middleware — redirects unauthenticated users to the landing page.
 *
 * Protected: all app routes except /, /auth/*, and /api/*
 * Detection: reads the Supabase session cookie set after Google sign-in.
 */

// Routes that are always public (no auth required)
const PUBLIC_PATHS = ['/', '/auth/complete'];
const PUBLIC_PREFIXES = ['/api/', '/_next/', '/favicon', '/images/'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

/** Extract the Supabase access token from cookies */
function getSupabaseToken(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const eq = cookie.indexOf('=');
    if (eq === -1) continue;
    const name  = cookie.slice(0, eq).trim();
    const value = cookie.slice(eq + 1).trim();

    // Supabase v2 sets a cookie like: sb-<ref>-auth-token
    if (name.includes('-auth-token') || name === 'sb-access-token' || name === 'sb-temp-auth-token') {
      try {
        const decoded = decodeURIComponent(value);
        if (decoded.startsWith('[')) {
          // Chunked storage: ["<base64>","<base64>"] — first chunk has the JWT
          const parts = JSON.parse(decoded) as string[];
          const combined = parts.join('');
          const session = JSON.parse(atob(combined.split('.')[0] + '==')) as { access_token?: string };
          if (session?.access_token) return session.access_token;
          // Try decoding the combined value as a session JSON directly
          try {
            const sess = JSON.parse(combined) as { access_token?: string };
            if (sess?.access_token) return sess.access_token;
          } catch {}
        }
        if (decoded.startsWith('{')) {
          const sess = JSON.parse(decoded) as { access_token?: string };
          if (sess?.access_token) return sess.access_token;
        }
        // Raw JWT (starts with eyJ)
        if (decoded.startsWith('eyJ') && decoded.length > 50) return decoded;
      } catch {
        if (value.startsWith('eyJ') && value.length > 50) return value;
      }
    }
  }
  return null;
}

/** Check JWT expiry without a network call */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() / 1000 > payload.exp;
  } catch { return true; }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (isPublic(pathname)) return NextResponse.next();

  const cookieHeader = request.headers.get('cookie') ?? '';
  const token = getSupabaseToken(cookieHeader);

  // No token or expired → redirect to landing page
  if (!token || isTokenExpired(token)) {
    const landing = new URL('/', request.url);
    landing.searchParams.set('redirect', pathname);
    return NextResponse.redirect(landing);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - /api/* (API routes handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
