import { NextResponse } from 'next/server';
import { adminClient, getCaller } from '@/lib/supabaseAdmin';
import { allSubscriptions, sendToSubscriptions } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A notification written by an admin, sent to everyone.
export async function POST(request) {
  try {
    const caller = await getCaller(request);
    if (!caller || caller.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    const { title, body, url } = await request.json();
    if (!title || !body) return NextResponse.json({ error: 'Heading and message are required' }, { status: 400 });
    const sent = await sendToSubscriptions(await allSubscriptions(), { title, body, url: url || '/' });
    await adminClient().from('push_log').insert({ kind: 'manual', title, body, sent_count: sent });
    return NextResponse.json({ sent });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
