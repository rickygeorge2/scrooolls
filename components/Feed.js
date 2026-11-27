'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { dayName, dayStart, daysAgoOf } from '@/lib/dates';
import { enablePush, isIOS, isStandalone, pushStatus } from '@/lib/pushClient';
import InstallSheet from './InstallSheet';
import VerseSheet from './VerseSheet';
import { PartnerLogo } from './PartnerHeader';
import { loadPartners, myFollows, setFollow } from '@/lib/partners';
import { useActivity } from '@/lib/useActivity';
import { Bell, Check, Down, Up } from './Icons';

export default function Feed({ profile }) {
  const router = useRouter();
  const [themes, setThemes] = useState({});
  const [genres, setGenres] = useState({});
  const [mode, setMode] = useState({ kind: 'day', day: 0 }); // or { kind: 'genre', id, name }
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [olderDay, setOlderDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null); // 'enable' | 'install'
  const [sheet, setSheet] = useState(false);
  const [verseStory, setVerseStory] = useState(null);
  const [partners, setPartners] = useState({});
  const [follows, setFollows] = useState(new Set());
  const read = useRef(new Set());
  const start = useRef(null);
  const lastWheel = useRef(0);
  useActivity(profile.id);

  // Lookups for theme colours and genre names
  useEffect(() => {
    loadPartners().then(setPartners);
    myFollows(profile.id).then(setFollows);
  }, [profile.id]);

  async function toggleFollow(partnerId) {
    const on = !follows.has(partnerId);
    const nextSet = new Set(follows); if (on) nextSet.add(partnerId); else nextSet.delete(partnerId);
    setFollows(nextSet);
    await setFollow(profile.id, partnerId, on);
  }

  useEffect(() => {
    Promise.all([supabase.from('themes').select('*'), supabase.from('genres').select('*')]).then(([t, g]) => {
      setThemes(Object.fromEntries((t.data || []).map((x) => [x.id, x])));
      setGenres(Object.fromEntries((g.data || []).map((x) => [x.id, x])));
    });
    const status = pushStatus();
    if (status === 'default') setBanner('enable');
    else if (status === 'unsupported' && isIOS() && !isStandalone()) setBanner('install');
  }, []);

  // Read ?genre= and ?story= from the address
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('genre')) setMode({ kind: 'genre', id: Number(q.get('genre')), name: q.get('name') || 'Genre' });
  }, []);

  const loadDay = useCallback(async (day) => {
    setLoading(true);
    const from = dayStart(day), to = dayStart(day - 1);
    const { data: stories } = await supabase.from('stories').select('*').eq('status', 'published')
      .gte('published_at', from.toISOString()).lt('published_at', to.toISOString()).order('published_at', { ascending: true });
    const list = stories || [];
    if (list.length) {
      const { data: reads } = await supabase.from('reads').select('story_id').eq('user_id', profile.id).in('story_id', list.map((s) => s.id));
      (reads || []).forEach((r) => read.current.add(r.story_id));
    }
    // Every story from that day stays in the feed, oldest at the bottom and newest at the top:
    // swipe up for newer stories, swipe down for older ones. You start at the oldest one you
    // haven't read yet, so swiping up always brings something new.
    let q = list;
    let startAt = q.findIndex((s) => !read.current.has(s.id));
    if (startAt === -1) startAt = q.length; // all read: start on the "caught up" card
    // Opened from a notification? Start on that story.
    const wanted = new URLSearchParams(window.location.search).get('story');
    if (wanted && day === 0) {
      const found = q.findIndex((x) => x.id === wanted);
      if (found >= 0) startAt = found;
      else {
        const { data: s } = await supabase.from('stories').select('*').eq('id', wanted).maybeSingle();
        if (s) { q = [...q, s]; startAt = q.length - 1; }
      }
      window.history.replaceState(null, '', '/');
    }
    const { data: older } = await supabase.from('stories').select('published_at').eq('status', 'published')
      .lt('published_at', from.toISOString()).order('published_at', { ascending: false }).limit(1);
    setOlderDay(older && older[0] ? daysAgoOf(older[0].published_at) : null);
    setQueue(q);
    setIdx(startAt);
    setLoading(false);
  }, [profile.id]);

  const loadGenre = useCallback(async (id) => {
    setLoading(true);
    const { data } = await supabase.from('stories').select('*').eq('status', 'published').eq('genre_id', id)
      .order('published_at', { ascending: false }).limit(50);
    const list = (data || []).reverse(); // oldest → newest, so swiping down goes back in time
    setQueue(list);
    setIdx(Math.max(list.length - 1, 0)); // start on the newest
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mode.kind === 'day') loadDay(mode.day); else loadGenre(mode.id);
  }, [mode, loadDay, loadGenre]);

  const markRead = useCallback((story) => {
    if (!story || read.current.has(story.id)) return;
    read.current.add(story.id);
    supabase.from('reads').upsert({ user_id: profile.id, story_id: story.id }, { onConflict: 'user_id,story_id', ignoreDuplicates: true }).then(() => {});
  }, [profile.id]);

  const openedLink = useCallback((story) => {
    markRead(story);
    supabase.from('reads').upsert({ user_id: profile.id, story_id: story.id, opened_link: true }, { onConflict: 'user_id,story_id' }).then(() => {});
  }, [profile.id, markRead]);

  const next = useCallback(() => {
    setIdx((i) => { markRead(queue[i]); return Math.min(i + 1, queue.length); });
  }, [queue, markRead]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  function onPointerDown(e) { start.current = { x: e.clientX, y: e.clientY }; }
  function onPointerUp(e) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > Math.abs(dy)) { if (dx < -60) router.push('/discover'); }
    else if (dy < -40) next();
    else if (dy > 40) prev();
  }
  function onWheel(e) {
    const now = Date.now();
    if (now - lastWheel.current < 650 || Math.abs(e.deltaY) < 12) return;
    lastWheel.current = now;
    if (e.deltaY > 0) next(); else prev();
  }

  async function turnOn() {
    try {
      const r = await enablePush(profile.id);
      if (r === 'install-first') { setSheet(true); return; }
      setBanner(null);
    } catch { setBanner(null); }
  }

  const label = mode.kind === 'genre' ? mode.name : dayName(mode.day);
  const atEnd = idx >= queue.length;
  const counter = loading ? '' : atEnd ? label + ' · all read' : label + ' · ' + (idx + 1) + ' / ' + queue.length;

  return (
    <div className="feed">
      <header className="feed-head">
        <div className="brand">Scrooolls</div>
        <div className="row" style={{ gap: 6 }}>
          <span className="small muted" style={{ fontWeight: 600 }}>{counter}</span>
          <Link href="/discover" className="btn outline small" style={{ height: 36, borderRadius: 999 }}>Discover</Link>
        </div>
      </header>

      {banner && (
        <div className="row between" style={{ padding: '10px 14px', background: '#FFF6DA', fontSize: 14, gap: 12 }}>
          <span className="row" style={{ gap: 8 }}><Bell c="#15171C" />{banner === 'enable' ? 'Get notified about new stories' : 'Add Scrooolls to your home screen to get notifications'}</span>
          <button className="btn small" onClick={banner === 'enable' ? turnOn : () => setSheet(true)}>{banner === 'enable' ? 'Turn on' : 'How'}</button>
        </div>
      )}

      <div className="feed-body" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onWheel={onWheel}>
        {loading ? (
          <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading stories…</p></div>
        ) : (
          <>
            {queue.map((s, i) => {
              const theme = themes[s.theme_id];
              const genre = genres[s.genre_id];
              const isToday = daysAgoOf(s.published_at) === 0;
              return (
                <article key={s.id} className="story" style={{ transform: `translateY(${(i - idx) * 100}%)` }} aria-hidden={i !== idx}>
                  <div className="story-img" style={{ background: theme?.color || '#FFD666' }}>
                    {s.image_url ? <img src={s.image_url} alt="" draggable="false" /> : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#2A2D36' }}>{theme?.name || 'Scrooolls'}</div>
                        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 34, lineHeight: 1.05 }}>{genre?.name || ''}</div>
                      </>
                    )}
                    {read.current.has(s.id) ? <span className="story-day" style={{ background: '#fff', color: 'var(--ink)' }}>Read ✓</span>
                      : isToday && mode.kind === 'day' && <span className="story-day">New today</span>}
                    {genre && <span className="story-tag">{genre.name}</span>}
                  </div>
                  <div className="story-text">
                    <h2>{s.title}</h2>
                    <p>{s.summary}</p>
                    {partners[s.author_id] ? (() => {
                      const pt = partners[s.author_id];
                      const on = follows.has(pt.profile_id);
                      return (
                        <div className="row" style={{ gap: 10, padding: '6px 6px 6px 6px', borderRadius: 999, background: pt.bg_color, color: pt.text_color, marginTop: 2 }}>
                          <Link href={'/p/' + pt.slug} className="row grow" style={{ gap: 10, minWidth: 0, color: pt.text_color, textDecoration: 'none' }} tabIndex={i === idx ? 0 : -1}>
                            <PartnerLogo partner={pt} size={34} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.name}</span>
                              <span style={{ display: 'block', fontSize: 11, opacity: 0.8 }}>{theme ? theme.name + ' · ' : ''}View profile</span>
                            </span>
                          </Link>
                          <button onClick={() => toggleFollow(pt.profile_id)} aria-pressed={on} tabIndex={i === idx ? 0 : -1}
                            style={{ height: 34, padding: '0 14px', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
                              background: on ? 'transparent' : pt.text_color, color: on ? pt.text_color : pt.bg_color, border: `1.5px solid ${pt.text_color}` }}>
                            {on ? 'Following' : 'Follow'}
                          </button>
                        </div>
                      );
                    })() : (
                      <div className="small" style={{ color: 'var(--soft)', fontSize: 12 }}>
                        {theme ? theme.name + ' · ' : ''}by {s.author_name || 'Scrooolls'} · swipe left for Discover
                      </div>
                    )}
                  </div>
                  {s.verse_text ? (
                    <button className="read-more" style={{ border: 0, cursor: 'pointer', font: 'inherit' }} tabIndex={i === idx ? 0 : -1}
                      onClick={() => { markRead(s); setVerseStory(s); }}>
                      <span className="arrow" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15171C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span><span className="label">Tap to read {s.verse_ref}</span>
                    </button>
                  ) : s.link ? (
                    <a className="read-more" href={s.link} target="_blank" rel="noopener noreferrer" onClick={() => openedLink(s)} tabIndex={i === idx ? 0 : -1}>
                      <span className="arrow" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15171C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span><span className="label">Tap to read more</span>
                    </a>
                  ) : (
                    <div className="read-more" style={{ background: '#fff', color: 'var(--ink)', border: '1.5px solid var(--line)', boxShadow: 'none' }}><span className="label" style={{ paddingRight: 0 }}>Swipe up for the next story</span></div>
                  )}
                </article>
              );
            })}
            <section className="story" style={{ transform: `translateY(${(queue.length - idx) * 100}%)`, background: 'var(--ground)', justifyContent: 'center', padding: '40px 28px', gap: 16 }} aria-hidden={!atEnd}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check /></div>
              <h2 className="title">{mode.kind === 'genre' ? 'That’s everything in ' + mode.name : mode.day === 0 ? (queue.length ? 'You’re all caught up for today' : 'No new stories yet today') : 'You’re all caught up'}</h2>
              <p className="lead">
                {mode.kind === 'genre' ? 'Head back to your daily feed for today’s stories.'
                  : mode.day === 0 ? 'You’ve read everything posted today. Swipe down to read any of them again. We’ll notify you the moment a new story goes up.'
                  : 'That’s everything from ' + dayName(mode.day).toLowerCase() + '.'}
              </p>
              {mode.kind === 'day' && olderDay !== null && (
                <button className="btn" onClick={() => setMode({ kind: 'day', day: olderDay })}>Read {dayName(olderDay).toLowerCase()}’s stories</button>
              )}
              {(mode.kind === 'genre' || mode.day !== 0) && (
                <button className="btn outline" onClick={() => { window.history.replaceState(null, '', '/'); setMode({ kind: 'day', day: 0 }); }}>Back to today</button>
              )}
              <Link className="btn ghost" href="/discover">Browse contributors and themes</Link>
            </section>
            <div className="nav-arrows">
              <button onClick={prev} aria-label="Older story"><Up /></button>
              <button onClick={next} aria-label="Newer story"><Down /></button>
            </div>
          </>
        )}
      </div>
      {sheet && <InstallSheet onClose={() => setSheet(false)} />}
      {verseStory && <VerseSheet story={verseStory} onClose={() => setVerseStory(null)} onOpenLink={() => openedLink(verseStory)} />}
    </div>
  );
}
