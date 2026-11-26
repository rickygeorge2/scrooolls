import { NextResponse } from 'next/server';
import { adminClient, getCaller } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

// Turns Google Drive / Dropbox share links into direct download links.
function directLink(raw) {
  const url = new URL(raw);
  if (url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com') {
    const m = url.pathname.match(/\/d\/([^/]+)/);
    const id = m ? m[1] : url.searchParams.get('id');
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  if (url.hostname.endsWith('dropbox.com')) {
    url.searchParams.set('dl', '1');
    return url.toString();
  }
  return url.toString();
}

// Copies an image from a link into Scrooolls' own storage and returns its new address.
export async function POST(request) {
  try {
    const caller = await getCaller(request);
    if (!caller || !['admin', 'contributor'].includes(caller.role)) {
      return NextResponse.json({ error: 'Contributors and admins only' }, { status: 403 });
    }
    const { url } = await request.json();
    if (!url || !/^https:\/\//i.test(url)) return NextResponse.json({ error: 'The image link must start with https://' }, { status: 400 });

    const res = await fetch(directLink(url), { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!res.ok) return NextResponse.json({ error: `Couldn't open the image link (error ${res.status}). Is it shared publicly?` }, { status: 400 });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!type.startsWith('image/')) {
      return NextResponse.json({ error: 'That link isn’t an image. For Google Drive, set sharing to “Anyone with the link”.' }, { status: 400 });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'Image is larger than 8 MB.' }, { status: 400 });

    const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '');
    const path = `${caller.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const db = adminClient();
    const up = await db.storage.from('story-images').upload(path, buf, { contentType: type });
    if (up.error) throw up.error;
    return NextResponse.json({ url: db.storage.from('story-images').getPublicUrl(path).data.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: e.name === 'TimeoutError' ? 'The image link took too long to load.' : e.message }, { status: 500 });
  }
}
