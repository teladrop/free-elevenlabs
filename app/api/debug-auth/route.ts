import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug-auth
 * Dumps cookie names and Supabase env var presence — never exposes values.
 * Remove this route once auth is confirmed working.
 */
export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookieNames = cookieHeader
    .split(';')
    .map(c => c.split('=')[0].trim())
    .filter(Boolean);

  const supabaseUrl     = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    cookieNames,
    supabaseUrl,
    supabaseAnonKey,
    supabaseCookies: cookieNames.filter(n =>
      n.includes('supabase') || n.includes('sb-') || n.includes('auth-token')
    ),
  });
}
