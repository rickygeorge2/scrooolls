import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Which Bible translation Scrooolls uses. 'web' = World English Bible; 'kjv' = King James Version.
const TRANSLATION = 'web';

// Looks up a Bible reference (e.g. "John 3:16", "Romans 15:13-14", "Psalm 23") and returns its text.
export async function GET(request) {
  const caller = await getCaller(request);
  if (!caller || !['admin', 'contributor'].includes(caller.role)) {
    return NextResponse.json({ error: 'Contributors and admins only' }, { status: 403 });
  }
  const ref = (new URL(request.url).searchParams.get('ref') || '').trim();
  if (!ref) return NextResponse.json({ error: 'Type a Bible reference, e.g. John 3:16' }, { status: 400 });
  if (ref.length > 60) return NextResponse.json({ error: 'That reference is too long' }, { status: 400 });

  try {
    const url = 'https://bible-api.com/' + encodeURIComponent(ref).replace(/%20/g, '+') + '?translation=' + TRANSLATION;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.verses || !data.verses.length) {
      return NextResponse.json({ error: `Couldn’t find “${ref}”. Check the book, chapter and verse.` }, { status: 404 });
    }
    if (data.verses.length > 40) {
      return NextResponse.json({ error: 'That passage is very long. Please pick 40 verses or fewer.' }, { status: 400 });
    }
    const clean = (s) => s.replace(/\s+/g, ' ').trim();
    const text = data.verses.length === 1
      ? clean(data.verses[0].text)
      : data.verses.map((v) => `${v.verse} ${clean(v.text)}`).join(' ');
    return NextResponse.json({ reference: data.reference, text, translation: data.translation_name || 'World English Bible' });
  } catch (e) {
    return NextResponse.json({ error: 'The Bible lookup is taking too long. Please try again in a moment.' }, { status: 504 });
  }
}
