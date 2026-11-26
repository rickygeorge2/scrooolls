'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { myFollows, setFollow } from '@/lib/partners';
import PartnerHeader from '@/components/PartnerHeader';
import { Back } from '@/components/Icons';

// A partner organisation's public page inside Scrooolls.
export default function PartnerPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { loading, session, profile } = useAuth();
  const [partner, setPartner] = useState(undefined);
  const [stories, setStories] = useState([]);
  const [followers, setFollowers] = useState(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('partners').select('*').eq('slug', slug).maybeSingle().then(async ({ data }) => {
      setPartner(data || null);
      if (!data) return;
      const [{ data: s }, { data: n }] = await Promise.all([
        supabase.from('stories').select('id, title, summary, image_url, published_at').eq('author_id', data.profile_id).eq('status', 'published').order('published_at', { ascending: false }).limit(30),
        supabase.rpc('follower_count', { p_profile: data.profile_id }),
      ]);
      setStories(s || []);
      setFollowers(typeof n === 'number' ? n : null);
    });
  }, [slug]);

  useEffect(() => {
    if (profile && partner) myFollows(profile.id).then((f) => setFollowing(f.has(partner.profile_id)));
  }, [profile, partner]);

  async function toggle() {
    if (!session) { router.push('/login?next=' + encodeURIComponent('/p/' + slug)); return; }
    setBusy(true);
    const next = !following;
    await setFollow(profile.id, partner.profile_id, next);
    setFollowing(next);
    setFollowers((n) => (typeof n === 'number' ? n + (next ? 1 : -1) : n));
    setBusy(false);
  }

  if (partner === undefined || loading) return <main className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading…</p></main>;
  if (!partner) {
    return (
      <main className="screen" style={{ justifyContent: 'center' }}>
        <h1 className="title">Partner not found</h1>
        <Link className="btn" href="/discover">Back to Discover</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', minHeight: '100dvh', background: 'var(--ground)' }}>
      <div style={{ background: partner.bg_color, paddingTop: 'env(safe-area-inset-top)' }}>
        <button className="icon-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push('/discover'))} style={{ margin: '8px 0 0 8px' }}>
          <Back c={partner.text_color} />
        </button>
      </div>
      <PartnerHeader partner={partner} followers={followers} following={following} onFollow={toggle} busy={busy} />
      <div className="stack" style={{ padding: 20, gap: 12 }}>
        <h2 style={{ fontSize: 18 }}>Stories from {partner.name}</h2>
        {stories.length === 0 && <p className="muted">No stories yet. Follow to see them in your feed when they arrive.</p>}
        {stories.map((s) => (
          <Link key={s.id} href={'/?story=' + s.id} className="card row" style={{ textDecoration: 'none', gap: 12, alignItems: 'flex-start' }}>
            {s.image_url && <img src={s.image_url} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{s.title}</div>
              <div className="small muted" style={{ marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.summary}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
