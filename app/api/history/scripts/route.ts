import { NextRequest, NextResponse } from 'next/server';
import {
  listScriptHistory,
  getScriptHistory,
  deleteScriptHistory,
  saveScriptHistory,
} from '@/lib/db/history';
import { isSupabaseReady } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

function notConfigured() {
  return NextResponse.json(
    { success: false, error: 'Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local' },
    { status: 503 },
  );
}

// GET /api/history/scripts          → list
// GET /api/history/scripts?id=xxx   → single entry
export async function GET(req: NextRequest) {
  if (!isSupabaseReady()) return notConfigured();
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const entry = await getScriptHistory(id);
    if (!entry) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: entry });
  }
  const list = await listScriptHistory(50);
  return NextResponse.json({ success: true, data: list });
}

// POST /api/history/scripts  body: { action: 'save', params, script, analysis }
//                            body: { action: 'delete', id }
export async function POST(req: NextRequest) {
  if (!isSupabaseReady()) return notConfigured();
  const body = await req.json();

  if (body.action === 'delete') {
    const ok = await deleteScriptHistory(body.id);
    return NextResponse.json({ success: ok });
  }

  // save
  const id = await saveScriptHistory(body.params, body.script, body.analysis ?? null);
  if (!id) return NextResponse.json({ success: false, error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ success: true, data: { id } });
}
