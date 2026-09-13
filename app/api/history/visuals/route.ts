import { NextRequest, NextResponse } from 'next/server';
import {
  listVisualHistory,
  getVisualHistory,
  deleteVisualHistory,
  saveVisualHistory,
} from '@/lib/db/history';
import { isSupabaseReady } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

function notConfigured() {
  return NextResponse.json(
    { success: false, error: 'Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local' },
    { status: 503 },
  );
}

export async function GET(req: NextRequest) {
  if (!isSupabaseReady()) return notConfigured();
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const entry = await getVisualHistory(id);
    if (!entry) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: entry });
  }
  const list = await listVisualHistory(50);
  return NextResponse.json({ success: true, data: list });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseReady()) return notConfigured();
  const body = await req.json();

  if (body.action === 'delete') {
    const ok = await deleteVisualHistory(body.id);
    return NextResponse.json({ success: ok });
  }

  const id = await saveVisualHistory(
    body.scriptText,
    body.visualStyle,
    body.visualBible ?? '',
    body.lines,
  );
  if (!id) return NextResponse.json({ success: false, error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ success: true, data: { id } });
}
