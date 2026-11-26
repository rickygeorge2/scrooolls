import { NextResponse } from 'next/server';
import { adminClient, getCaller } from '@/lib/supabaseAdmin';
import { allSubscriptions, sendToSubscriptions } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sends an earlier notification again, to everyone. Admins only.
export async function POST(request) {
  try {
    const caller = await getCaller(request);
    if (!caller || caller.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    const { logId } = await request.json();
    const db = adminClient();
    const { data: old } = await db.from('push_log').select('title, body, story_id').eq('id', logId).single();
    if (!old) return NextResponse.json({ error: 'That notification wasn’t found' }, { status: 404 });
    const url = old.story_id ? '/?story=' + old.story_id : '/';
    const sent = await sendToSubscriptions(await allSubscriptions(), {
      title: old.title || 'Scrooolls', body: old.body || '', url, tag: old.story_id ? 'story-' + old.story_id : undefined,
    });
    await db.from('push_log').insert({ kind: 'resend', title: old.title, body: old.body, story_id: old.story_id, sent_count: sent });
    return NextResponse.json({ sent });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
