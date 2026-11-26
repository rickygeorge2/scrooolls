import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/supabaseAdmin';
import { notifyStory } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called by the dashboard right after an admin publishes or approves a story.
export async function POST(request) {
  try {
    const caller = await getCaller(request);
    if (!caller || caller.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    const { storyId } = await request.json();
    if (!storyId) return NextResponse.json({ error: 'storyId missing' }, { status: 400 });
    const result = await notifyStory(storyId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
