import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * proxy.ts — Next.js 16 auth guard (renamed from middleware.ts)
 *
 * Uses @supabase/ssr createServerClient to reliably read the session
 * from chunked Supabase cookies — replaces the fragile manual cookie parser.
 */

// Routes that are always public
const PUBLIC_PATHS    = ['/', '/auth/complete'];
const PUBLIC_PREFIXES = ['/api/', '/_next/', '/favicon', '/images/'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured, let the request through
  // (avoids hard failure on misconfigured deploys)
  if (!url || !anon) return NextResponse.next();

  // We need a mutable response so @supabase/ssr can refresh cookies
  const response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write refreshed cookies back to the response
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getUser() is the secure check — it validates the JWT with Supabase
  // getSession() alone is not sufficient (can be spoofed client-side)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const landing = new URL('/', request.url);
    landing.searchParams.set('redirect', pathname);
    return NextResponse.redirect(landing);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
