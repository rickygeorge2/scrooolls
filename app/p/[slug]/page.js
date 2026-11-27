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
  const [stats, setStats] = useState(null);
  const [shared, setShared] = useState('');
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('partners').select('*').eq('slug', slug).maybeSingle().then(async ({ data }) => {
      setPartner(data || null);
      if (!data) return;
      const [{ data: s }, { data: n }] = await Promise.all([
        supabase.from('stories').select('id, title, summary, image_url, published_at').eq('author_id', data.profile_id).eq('status', 'published').order('published_at', { ascending: false }).limit(30),
        supabase.rpc('partner_stats', { p_profile: data.profile_id }),
      ]);
      setStories(s || []);
      setStats(n || { posts: 0, followers: 0, reads: 0 });
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
    setStats((st) => (st ? { ...st, followers: Math.max(0, st.followers + (next ? 1 : -1)) } : st));
    setBusy(false);
  }

  async function share() {
    const url = window.location.origin + '/p/' + slug;
    try {
      if (navigator.share) await navigator.share({ title: partner.name + ' on Scrooolls', url });
      else { await navigator.clipboard.writeText(url); setShared('Link copied'); setTimeout(() => setShared(''), 2000); }
    } catch {}
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
    <main style={{ maxWidth: 520, margin: '0 auto', minHeight: '100dvh', background: 'var(--ground)', padding: 'max(14px, env(safe-area-inset-top)) 14px 32px' }}>
      <PartnerHeader partner={partner} stats={stats} following={following} onFollow={toggle} onShare={share} busy={busy}
        topLeft={(
          <button aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push('/discover'))}
            style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Back />
          </button>
        )} />
      {shared && <div className="toast" role="status">{shared}</div>}
      <div className="stack" style={{ padding: '22px 6px 0', gap: 12 }}>
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
