import { NextResponse } from 'next/server';
import { adminClient, getCaller } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Permanently deletes a person's account and everything tied to it. Admins only.
// Their published stories stay up, still showing their name as the author.
export async function POST(request) {
  try {
    const caller = await getCaller(request);
    if (!caller || caller.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    if (userId === caller.id) return NextResponse.json({ error: 'You can’t delete your own account here.' }, { status: 400 });

    const db = adminClient();
    const { data: target } = await db.from('profiles').select('id, role, email').eq('id', userId).single();
    if (!target) return NextResponse.json({ error: 'That person wasn’t found' }, { status: 404 });
    if (target.role === 'admin') {
      return NextResponse.json({ error: 'This person is an admin. Remove their admin access first, then delete them.' }, { status: 400 });
    }
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw error;
    return NextResponse.json({ deleted: target.email });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
