import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * proxy.ts — Next.js 16 auth guard (renamed from middleware.ts)
 *
 * Uses @supabase/ssr createServerClient to reliably read the session
 * from chunked Supabase cookies.
 */

// Routes that are always public
const PUBLIC_PATHS    = ['/', '/auth/complete'];
const PUBLIC_PREFIXES = ['/api/', '/_next/', '/favicon', '/images/'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

/** Quick cookie-based check — look for any Supabase auth token cookie */
function hasAuthCookie(request: NextRequest): boolean {
  const cookieHeader = request.headers.get('cookie') ?? '';
  return cookieHeader.includes('-auth-token') || cookieHeader.includes('sb-access-token');
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured, let the request through
  if (!url || !anon) return NextResponse.next();

  // Fast-path: if no auth cookie at all, redirect immediately (no network call)
  if (!hasAuthCookie(request)) {
    const landing = new URL('/', request.url);
    landing.searchParams.set('redirect', pathname);
    return NextResponse.redirect(landing);
  }

  // We have a cookie — try to validate it with Supabase
  const response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Use getSession() here — it reads the JWT from the cookie without a
    // network round-trip. getUser() makes a network call which can timeout
    // in Edge middleware. We validate expiry client-side instead.
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const landing = new URL('/', request.url);
      landing.searchParams.set('redirect', pathname);
      return NextResponse.redirect(landing);
    }

    return response;
  } catch (err) {
    // If Supabase call fails (network error, timeout), fail OPEN —
    // let the request through. The page itself will redirect if needed.
    console.error('[proxy] Auth check failed, failing open:', err);
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
