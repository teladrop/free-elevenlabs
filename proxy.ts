import { NextRequest, NextResponse } from 'next/server';

/**
 * proxy.ts — Next.js 16 (renamed from middleware.ts)
 *
 * The Supabase browser client stores sessions in localStorage, NOT cookies.
 * Server-side middleware cannot read localStorage — so we cannot do auth
 * checks here. Auth protection is handled client-side inside AppLayout.
 *
 * This file exists only to satisfy Next.js 16's requirement for proxy.ts.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
