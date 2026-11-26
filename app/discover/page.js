'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { enablePush, pushStatus } from '@/lib/pushClient';
import InstallSheet from '@/components/InstallSheet';
import { Back, Chevron } from '@/components/Icons';

const HOURS = [5, 6, 7, 8, 9, 10];
const hourLabel = (h) => (h > 12 ? h - 12 : h) + ':00 ' + (h >= 12 ? 'PM' : 'AM');

export default function Discover() {
  const router = useRouter();
  const { loading, session, profile, refresh } = useAuth();
  const [tab, setTab] = useState('contributors');
  const [people, setPeople] = useState([]);
  const [themes, setThemes] = useState([]);
  const [genres, setGenres] = useState([]);
  const [follows, setFollows] = useState([]);
  const [picked, setPicked] = useState([]);
  const [push, setPush] = useState('default');
  const [sheet, setSheet] = useState(false);
  const start = useRef(null);

  useEffect(() => { if (!loading && !session) router.replace('/'); }, [loading, session, router]);

  useEffect(() => {
    if (!profile) return;
    supabase.from('contributors').select('*').order('name').then(({ data }) => setPeople(data || []));
    supabase.from('themes').select('*').order('sort').then(({ data }) => setThemes(data || []));
    supabase.from('genres').select('*').order('sort').then(({ data }) => setGenres(data || []));
    supabase.from('follows').select('contributor_id').eq('user_id', profile.id).then(({ data }) => setFollows((data || []).map((r) => r.contributor_id)));
    supabase.from('user_themes').select('theme_id').eq('user_id', profile.id).then(({ data }) => setPicked((data || []).map((r) => r.theme_id)));
    setPush(pushStatus());
  }, [profile]);

  async function toggleFollow(id) {
    if (follows.includes(id)) {
      setFollows(follows.filter((x) => x !== id));
      await supabase.from('follows').delete().eq('user_id', profile.id).eq('contributor_id', id);
    } else {
      setFollows([...follows, id]);
      await supabase.from('follows').insert({ user_id: profile.id, contributor_id: id });
    }
  }
  async function toggleTheme(id) {
    if (picked.includes(id)) {
      setPicked(picked.filter((x) => x !== id));
      await supabase.from('user_themes').delete().eq('user_id', profile.id).eq('theme_id', id);
    } else {
      setPicked([...picked, id]);
      await supabase.from('user_themes').insert({ user_id: profile.id, theme_id: id });
    }
  }
  async function setHour(h) {
    await supabase.from('profiles').update({ first_hour: h }).eq('id', profile.id);
    refresh();
  }
  async function turnOn() {
    const r = await enablePush(profile.id).catch(() => 'error');
    if (r === 'install-first') setSheet(true);
    setPush(pushStatus());
  }
  async function logout() {
    await supabase.auth.signOut();
    window.location.replace('/');
  }

  function onPointerDown(e) { start.current = { x: e.clientX, y: e.clientY }; }
  function onPointerUp(e) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
    start.current = null;
    if (dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) router.push('/');
  }

  if (!profile) return <main className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading…</p></main>;
  const staff = profile.role === 'admin' || profile.role === 'contributor';

  return (
    <main className="screen" onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ gap: 16 }}>
      <div className="row">
        <Link href="/" className="btn ghost" style={{ padding: '0 6px', color: 'var(--ink)', fontWeight: 600 }}><Back /> Feed</Link>
        <h1 style={{ fontSize: 22 }}>Discover</h1>
      </div>
      <div className="seg">
        {[['contributors', 'Contributors'], ['themes', 'Themes'], ['genres', 'Genres'], ['me', 'Me']].map(([id, l]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>

      {tab === 'contributors' && (
        <div className="stack" style={{ gap: 10 }}>
          {people.length === 0 && <p className="muted">Contributors will appear here once they’re approved.</p>}
          {people.map((p) => {
            const on = follows.includes(p.id);
            return (
              <div key={p.id} className="card row" style={{ gap: 12 }}>
                <div className="avatar">{(p.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  {p.bio && <div className="small muted">{p.bio}</div>}
                </div>
                <button className={'btn small' + (on ? '' : ' outline')} style={{ borderRadius: 999, minWidth: 92 }} onClick={() => toggleFollow(p.id)}>{on ? 'Following' : 'Follow'}</button>
              </div>
            );
          })}
          {!staff && (
            <Link href="/apply" className="card" style={{ background: 'var(--ink)', color: '#fff', textDecoration: 'none', marginTop: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Become a contributor</div>
              <div className="small" style={{ color: '#C9CCD6', marginTop: 4 }}>Write a series on hope, joy or anything in Scripture. Apply and an admin will review it.</div>
            </Link>
          )}
        </div>
      )}

      {tab === 'themes' && (
        <div className="chip-grid">
          {themes.map((t) => {
            const on = picked.includes(t.id);
            return (
              <button key={t.id} className={'chip' + (on ? ' on' : '')} aria-pressed={on} style={{ background: on ? t.color : '#fff' }} onClick={() => toggleTheme(t.id)}>
                {t.name}<div className="small" style={{ fontWeight: 400, marginTop: 4 }}>{on ? 'Interested ✓' : 'Tap if interested'}</div>
              </button>
            );
          })}
        </div>
      )}

      {tab === 'genres' && (
        <div className="stack" style={{ gap: 10 }}>
          {genres.map((g) => (
            <Link key={g.id} href={`/?genre=${g.id}&name=${encodeURIComponent(g.name)}`} className="card row between" style={{ textDecoration: 'none' }}>
              <span>
                <div style={{ fontWeight: 700 }}>{g.name}</div>
                {g.description && <div className="small muted">{g.description}</div>}
              </span>
              <Chevron />
            </Link>
          ))}
        </div>
      )}

      {tab === 'me' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="card">
            <div style={{ fontWeight: 700 }}>{profile.name || 'Your account'}</div>
            <div className="small muted">{profile.email}</div>
          </div>
          <div className="card stack" style={{ gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Notifications</div>
            {push === 'granted' ? <p className="small muted">On for this device. You’ll be notified for every new story.</p>
              : push === 'denied' ? <p className="small muted">Blocked. Turn them on in your phone’s settings for Scrooolls.</p>
              : <button className="btn small" onClick={turnOn}>Turn on notifications</button>}
            <div className="small" style={{ fontWeight: 600, marginTop: 4 }}>Morning notification</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {HOURS.map((h) => (
                <button key={h} className={'btn small' + (profile.first_hour === h ? ' yellow' : ' outline')} onClick={() => setHour(h)}>{hourLabel(h)}</button>
              ))}
            </div>
          </div>
          {staff && <Link className="btn outline" href="/dashboard">Open the dashboard</Link>}
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      )}
      {sheet && <InstallSheet onClose={() => setSheet(false)} />}
    </main>
  );
}
