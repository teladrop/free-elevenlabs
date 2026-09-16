import { NextRequest, NextResponse } from 'next/server';
import {
  listVisualHistory,
  getVisualHistory,
  deleteVisualHistory,
  saveVisualHistory,
} from '@/lib/db/history';
import { getUserFromRequest } from '@/lib/db/auth-server';

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const entry = await getVisualHistory(user.id, id);
    if (!entry) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: entry });
  }
  const list = await listVisualHistory(user.id, 50);
  return NextResponse.json({ success: true, data: list });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const body = await req.json();

  if (body.action === 'delete') {
    const ok = await deleteVisualHistory(user.id, body.id);
    return NextResponse.json({ success: ok });
  }

  const id = await saveVisualHistory(
    user.id,
    body.scriptText,
    body.visualStyle,
    body.visualBible ?? '',
    body.lines,
  );
  if (!id) return NextResponse.json({ success: false, error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ success: true, data: { id } });
}
