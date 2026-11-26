'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { authHeader, useAuth } from '@/lib/useAuth';
import BulkUpload from '@/components/BulkUpload';

const STATUS = {
  published: ['Published', 'var(--ok-bg)', 'var(--ok)'],
  scheduled: ['Scheduled', 'var(--info-bg)', 'var(--info)'],
  pending: ['Pending review', 'var(--warn-bg)', 'var(--warn)'],
  rejected: ['Declined', '#F1EFEA', '#3A3E4A'],
};
const EMPTY = { title: '', summary: '', link: '', theme_id: '', genre_id: '', when: '' };
const fmt = (d) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

export default function Dashboard() {
  const router = useRouter();
  const { loading, session, profile, refresh } = useAuth();
  const [tab, setTab] = useState('stories');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [toast, setToast] = useState('');
  const [themes, setThemes] = useState([]);
  const [genres, setGenres] = useState([]);
  const [stories, setStories] = useState([]);
  const [apps, setApps] = useState([]);
  const [log, setLog] = useState([]);
  const [interest, setInterest] = useState({});
  const [readers, setReaders] = useState(null);

  const isAdmin = profile?.role === 'admin';
  const isStaff = isAdmin || profile?.role === 'contributor';

  const flash = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 3500); }, []);

  useEffect(() => { if (!loading && !session) router.replace('/login?next=/dashboard'); }, [loading, session, router]);

  const loadTaxonomy = useCallback(async () => {
    const [t, g] = await Promise.all([supabase.from('themes').select('*').order('sort'), supabase.from('genres').select('*').order('sort')]);
    setThemes(t.data || []); setGenres(g.data || []);
  }, []);
  const loadStories = useCallback(async () => {
    let q = supabase.from('stories').select('*').order('created_at', { ascending: false }).limit(200);
    if (!isAdmin && profile) q = q.eq('author_id', profile.id);
    const { data } = await q;
    setStories(data || []);
  }, [isAdmin, profile]);
  const loadAdmin = useCallback(async () => {
    const [a, l, ut, r] = await Promise.all([
      supabase.from('applications').select('*, profiles(name, email)').order('created_at', { ascending: false }).limit(100),
      supabase.from('push_log').select('*').order('sent_at', { ascending: false }).limit(30),
      supabase.from('user_themes').select('theme_id'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);
    setApps(a.data || []); setLog(l.data || []);
    const counts = {};
    (ut.data || []).forEach((x) => { counts[x.theme_id] = (counts[x.theme_id] || 0) + 1; });
    setInterest(counts); setReaders(r.count ?? null);
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    loadTaxonomy(); loadStories();
    if (isAdmin) loadAdmin();
  }, [isStaff, isAdmin, loadTaxonomy, loadStories, loadAdmin]);

  async function notify(storyId) {
    const res = await fetch('/api/push/story', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ storyId }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return 'push failed: ' + (out.error || res.status);
    return 'push sent to ' + (out.sent ?? 0) + ' device' + (out.sent === 1 ? '' : 's');
  }

  async function saveName() {
    const name = nameDraft.trim();
    if (!name) return flash('Please enter a name.');
    const { error } = await supabase.from('profiles').update({ name }).eq('id', profile.id);
    if (error) return flash(error.message);
    setEditingName(false);
    await refresh();
    loadStories();
    flash('Name updated');
  }
  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace('/login?next=/dashboard');
  }

  async function approve(s) {
    // A contributor can ask for a publish date. If it's still ahead, schedule it; otherwise publish now.
    const later = s.scheduled_for && new Date(s.scheduled_for) > new Date();
    const { error } = await supabase.from('stories')
      .update(later ? { status: 'scheduled' } : { status: 'published', published_at: new Date().toISOString() }).eq('id', s.id);
    if (error) return flash(error.message);
    flash(later ? 'Approved · scheduled for ' + fmt(s.scheduled_for) + ', with a notification when it goes live' : 'Published · ' + (await notify(s.id)));
    loadStories(); loadAdmin();
  }
  async function decline(s) {
    await supabase.from('stories').update({ status: 'rejected' }).eq('id', s.id);
    loadStories();
  }
  async function remove(s) {
    if (!window.confirm('Delete “' + s.title + '”? This cannot be undone.')) return;
    await supabase.from('stories').delete().eq('id', s.id);
    loadStories();
  }

  if (loading || !profile) return <main className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading…</p></main>;
  if (!isStaff) {
    return (
      <main className="screen" style={{ justifyContent: 'center' }}>
        <h1 className="title">This area is for contributors</h1>
        <p className="lead">Your account is a reader account. Apply to contribute, and you’ll get access once an admin approves you.</p>
        <Link className="btn" href="/apply">Apply to contribute</Link>
        <Link className="btn ghost" href="/">Back to reading</Link>
      </main>
    );
  }

  const pendingStories = stories.filter((s) => s.status === 'pending').length;
  const pendingApps = apps.filter((a) => a.status === 'pending').length;
  const nav = isAdmin
    ? [['stories', 'Stories', pendingStories], ['new', 'New story', 0], ['bulk', 'Bulk upload', 0], ['apps', 'Applications', pendingApps], ['push', 'Push notifications', 0], ['tax', 'Themes & genres', 0]]
    : [['stories', 'My stories', 0], ['new', 'New story', 0], ['bulk', 'Bulk upload', 0]];
  const themeName = (id) => themes.find((t) => t.id === id)?.name || '—';
  const genreName = (id) => genres.find((g) => g.id === id)?.name || '—';

  return (
    <div className="dash">
      <nav className="dash-nav" aria-label="Dashboard">
        <div className="brand" style={{ fontSize: 22, padding: '0 10px 18px' }}>Scrooolls</div>
        {nav.map(([id, label, badge]) => (
          <button key={id} className={'nav' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
            <span>{label}</span>{badge > 0 && <span className="badge">{badge}</span>}
          </button>
        ))}
        <div className="grow" style={{ minHeight: 24 }} />
        <div style={{ padding: 12, borderRadius: 12, background: '#23262E', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="small" style={{ color: '#C9CCD6' }}>Signed in as</div>
          {editingName ? (
            <>
              <label className="sr-only" htmlFor="name-edit">Your name</label>
              <input id="name-edit" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                style={{ height: 40, borderRadius: 10, border: '1px solid #4A4E5A', background: '#15171C', color: '#fff', padding: '0 10px' }} />
              <div className="row" style={{ gap: 6 }}>
                <button className="btn small yellow grow" onClick={saveName}>Save</button>
                <button className="btn small grow" style={{ background: 'transparent', border: '1px solid #4A4E5A' }} onClick={() => setEditingName(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="row between" style={{ gap: 6 }}>
              <div style={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>{profile.name || profile.email}</div>
              <button className="btn small" style={{ background: 'transparent', color: '#C9CCD6', height: 32, padding: '0 8px' }}
                onClick={() => { setNameDraft(profile.name || ''); setEditingName(true); }}>Edit</button>
            </div>
          )}
          <span className="pill" style={{ background: 'var(--accent)', color: 'var(--ink)', alignSelf: 'flex-start' }}>{isAdmin ? 'Admin' : 'Contributor'}</span>
          <Link href="/" className="btn small" style={{ background: 'transparent', border: '1px solid #4A4E5A' }}>Open the app</Link>
          <button className="btn small" style={{ background: 'transparent', border: '1px solid #4A4E5A' }} onClick={signOut}>Sign out</button>
        </div>
      </nav>

      <main className="dash-main">
        {tab === 'stories' && (
          <>
            <div className="row between" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <h1 className="title">{isAdmin ? 'Stories' : 'My stories'}</h1>
                <p className="muted" style={{ marginTop: 6 }}>{isAdmin ? 'Everything in the feed, plus contributor stories waiting for review.' : 'Your submissions and their status.'}</p>
              </div>
              <button className="btn small" onClick={() => setTab('new')}>+ New story</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Story</th><th>Theme</th><th>Genre</th><th>By</th><th>Status</th><th>Push</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {stories.length === 0 && <tr><td colSpan={7} className="muted">No stories yet. Write the first one.</td></tr>}
                  {stories.map((s) => {
                    const [label, bg, fg] = STATUS[s.status];
                    const push = s.notified_at ? 'Sent ✓' : s.status === 'pending' ? 'Sends on approval' : s.status === 'scheduled' ? 'Sends when live' : '—';
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600, maxWidth: 320 }}>{s.title}<div className="small muted" style={{ fontWeight: 400 }}>{s.status === 'scheduled' ? 'Goes live ' + fmt(s.scheduled_for) : s.status === 'pending' && s.scheduled_for ? 'Requested for ' + fmt(s.scheduled_for) : fmt(s.published_at || s.created_at)}</div></td>
                        <td>{themeName(s.theme_id)}</td>
                        <td>{genreName(s.genre_id)}</td>
                        <td>{s.author_name}</td>
                        <td><span className="pill" style={{ background: bg, color: fg }}>{label}</span></td>
                        <td className="small" style={{ color: s.notified_at ? 'var(--ok)' : 'var(--soft)', whiteSpace: 'nowrap' }}>{push}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {isAdmin && s.status === 'pending' && (
                            <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                              <button className="btn small yellow" onClick={() => approve(s)}>Approve &amp; publish</button>
                              <button className="btn small outline" onClick={() => decline(s)}>Decline</button>
                            </span>
                          )}
                          {isAdmin && s.status !== 'pending' && <button className="btn small ghost" onClick={() => remove(s)}>Delete</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'new' && (
          <NewStory profile={profile} isAdmin={isAdmin} themes={themes} genres={genres}
            onDone={async (story, msg) => {
              let m = msg;
              if (story.status === 'published') m += ' · ' + (await notify(story.id));
              flash(m); setTab('stories'); loadStories(); if (isAdmin) loadAdmin();
            }} onError={flash} />
        )}

        {tab === 'bulk' && (
          <BulkUpload profile={profile} isAdmin={isAdmin} themes={themes} genres={genres} notify={notify} flash={flash}
            onDone={() => { loadStories(); if (isAdmin) loadAdmin(); }} />
        )}

        {tab === 'apps' && isAdmin && <Applications apps={apps} reload={loadAdmin} flash={flash} />}
        {tab === 'push' && isAdmin && <Push log={log} reload={loadAdmin} flash={flash} />}
        {tab === 'tax' && isAdmin && <Taxonomy themes={themes} genres={genres} interest={interest} readers={readers} reload={loadTaxonomy} flash={flash} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function NewStory({ profile, isAdmin, themes, genres, onDone, onError }) {
  const [f, setF] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const words = f.summary.trim() ? f.summary.trim().split(/\s+/).length : 0;
  const theme = themes.find((t) => String(t.id) === String(f.theme_id));
  const genre = genres.find((g) => String(g.id) === String(f.genre_id));

  function pick(e) {
    const file = e.target.files && e.target.files[0];
    setFile(file || null);
    setPreview(file ? URL.createObjectURL(file) : '');
  }

  async function save(status) {
    if (!f.title.trim() || !f.summary.trim()) return onError('Add a title and a summary first.');
    if (status === 'scheduled' && !f.when) return onError('Pick a date and time to schedule it.');
    setBusy(true);
    try {
      let image_url = null;
      if (file) {
        const path = `${profile.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, '-')}`;
        const up = await supabase.storage.from('story-images').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        image_url = supabase.storage.from('story-images').getPublicUrl(path).data.publicUrl;
      }
      const row = {
        title: f.title.trim(), summary: f.summary.trim(), link: f.link.trim() || null, image_url,
        theme_id: f.theme_id ? Number(f.theme_id) : null, genre_id: f.genre_id ? Number(f.genre_id) : null,
        author_id: profile.id, status,
        scheduled_for: status === 'scheduled' ? new Date(f.when).toISOString() : null,
      };
      const { data, error } = await supabase.from('stories').insert(row).select().single();
      if (error) throw error;
      setF(EMPTY); setFile(null); setPreview('');
      await onDone(data, status === 'published' ? 'Published' : status === 'scheduled' ? 'Scheduled for ' + fmt(row.scheduled_for) : 'Sent to an admin for review');
    } catch (e) {
      onError(e.message || 'Could not save the story.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div>
        <h1 className="title">New story</h1>
        <p className="muted" style={{ marginTop: 6 }}>The preview shows how readers will see it.</p>
      </div>
      <div className="split">
        <div className="main card stack" style={{ padding: 24, gap: 18 }}>
          <label className="field">Title<input value={f.title} onChange={set('title')} placeholder="A short, punchy headline" maxLength={120} /></label>
          <label className="field">
            <span className="row between"><span>Summary</span><span className="hint" style={{ color: words > 60 ? 'var(--bad)' : undefined }}>{words} / 60 words</span></span>
            <textarea rows={5} value={f.summary} onChange={set('summary')} placeholder="Up to 60 words. Include the verse and one takeaway." />
          </label>
          <label className="field"><span>Read-more link <span className="hint">(optional)</span></span><input type="url" value={f.link} onChange={set('link')} placeholder="https://" /></label>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
            <label className="field grow">Theme
              <select value={f.theme_id} onChange={set('theme_id')}><option value="">Choose…</option>{themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
            <label className="field grow">Genre
              <select value={f.genre_id} onChange={set('genre_id')}><option value="">Choose…</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            </label>
          </div>
          <label className="field">Image <span className="hint">(optional; wide photos look best)</span>
            <input type="file" accept="image/*" onChange={pick} style={{ height: 'auto', padding: 12 }} />
          </label>
          <div className="card" style={{ background: '#FFF6DA', border: 0, fontSize: 13, lineHeight: 1.5 }}>
            {isAdmin ? 'Publishing sends a push notification to all readers automatically. A scheduled story sends its push when it goes live.'
              : 'When an admin approves this story it goes live, and all readers get a push notification automatically.'}
          </div>
          {isAdmin ? (
            <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <button className="btn" disabled={busy} onClick={() => save('published')}>{busy ? 'Saving…' : 'Publish now'}</button>
              <input type="datetime-local" aria-label="Schedule date and time" value={f.when} onChange={set('when')} style={{ height: 54, borderRadius: 16, border: '1.5px solid #D6D3CA', padding: '0 12px' }} />
              <button className="btn outline" disabled={busy} onClick={() => save('scheduled')}>Schedule</button>
            </div>
          ) : (
            <button className="btn" disabled={busy} onClick={() => save('pending')}>{busy ? 'Sending…' : 'Submit for review'}</button>
          )}
        </div>
        <div className="side stack" style={{ gap: 10 }}>
          <div className="small" style={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--soft)' }}>Live preview</div>
          <div className="phone">
            <div className="story-img" style={{ background: theme?.color || '#FFD666', height: 220, minHeight: 0 }}>
              {preview ? <img src={preview} alt="" /> : <span className="small" style={{ fontWeight: 600 }}>{theme?.name || 'Story image'}</span>}
              {genre && <span className="story-tag">{genre.name}</span>}
            </div>
            <div className="story-text" style={{ padding: '26px 16px 80px' }}>
              <h2 style={{ fontSize: 18 }}>{f.title || 'Your title appears here'}</h2>
              <p style={{ fontSize: 14 }}>{f.summary || 'Your summary appears here. Keep it short enough to read in under a minute.'}</p>
              <div className="small" style={{ color: 'var(--soft)', fontSize: 11 }}>by {profile.name || profile.email}</div>
            </div>
            <div className="read-more" style={{ minHeight: 60 }}><strong style={{ fontSize: 14 }}>{f.link ? 'Tap to read more' : 'No read-more link'}</strong></div>
          </div>
        </div>
      </div>
    </>
  );
}

function Applications({ apps, reload, flash }) {
  async function decide(a, status) {
    const { error } = await supabase.from('applications').update({ status, decided_at: new Date().toISOString() }).eq('id', a.id);
    if (error) return flash(error.message);
    if (status === 'approved') {
      const { error: e2 } = await supabase.from('profiles').update({ role: 'contributor', bio: a.topic }).eq('id', a.user_id);
      if (e2) return flash(e2.message);
      flash((a.profiles?.name || 'They') + ' can now publish from the dashboard');
    }
    reload();
  }
  return (
    <>
      <div>
        <h1 className="title">Contributor applications</h1>
        <p className="muted" style={{ marginTop: 6 }}>Approving someone gives them access to this dashboard the next time they open it.</p>
      </div>
      {apps.length === 0 && <p className="muted">No applications yet.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {apps.map((a) => (
          <div key={a.id} className="card stack" style={{ padding: 20, gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{a.profiles?.name || 'Unnamed'}</div>
              <div className="small muted">{a.profiles?.email}</div>
            </div>
            <div style={{ fontSize: 14 }}><strong>Wants to write:</strong> {a.topic}</div>
            {a.about && <div style={{ fontSize: 14, lineHeight: 1.5, color: '#3A3E4A' }}>{a.about}</div>}
            {a.sample_link && <a className="small" href={a.sample_link} target="_blank" rel="noopener noreferrer">View sample</a>}
            <div className="small muted">Applied {fmt(a.created_at)}</div>
            {a.status === 'pending' ? (
              <div className="row">
                <button className="btn small grow" onClick={() => decide(a, 'approved')}>Approve</button>
                <button className="btn small outline grow" onClick={() => decide(a, 'declined')}>Decline</button>
              </div>
            ) : (
              <span className="pill" style={{ alignSelf: 'flex-start', background: a.status === 'approved' ? 'var(--ok-bg)' : '#F1EFEA', color: a.status === 'approved' ? 'var(--ok)' : '#3A3E4A' }}>
                {a.status === 'approved' ? 'Approved' : 'Declined'}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Push({ log, reload, flash }) {
  const [f, setF] = useState({ title: '', body: '' });
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!f.title.trim() || !f.body.trim()) return flash('Add a heading and a message.');
    setBusy(true);
    const res = await fetch('/api/push/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify(f) });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return flash('Could not send: ' + (out.error || res.status));
    flash('Sent to ' + out.sent + ' device' + (out.sent === 1 ? '' : 's'));
    setF({ title: '', body: '' }); reload();
  }
  const kinds = { story: ['New story', 'var(--ok-bg)', 'var(--ok)'], manual: ['Sent by admin', 'var(--info-bg)', 'var(--info)'], morning: ['Morning', 'var(--warn-bg)', 'var(--warn)'] };
  return (
    <>
      <div>
        <h1 className="title">Push notifications</h1>
        <p className="muted" style={{ marginTop: 6 }}>Every new story notifies all readers automatically. Each reader also gets one morning notification at the time they picked.</p>
      </div>
      <div className="split">
        <div className="main card stack" style={{ padding: 24, gap: 16 }}>
          <h2 style={{ fontSize: 18 }}>Send a notification to everyone</h2>
          <label className="field">Heading<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="New series: 30 Days of Hope" /></label>
          <label className="field">Message<textarea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Day 1 is live. Tap to read." /></label>
          <button className="btn" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send now'}</button>
        </div>
      </div>
      <div className="card stack" style={{ padding: 24, gap: 0 }}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Sent notifications</h2>
        {log.length === 0 && <p className="muted">Nothing sent yet.</p>}
        {log.map((l) => {
          const [label, bg, fg] = kinds[l.kind] || kinds.manual;
          return (
            <div key={l.id} className="row" style={{ flexWrap: 'wrap', gap: '6px 14px', padding: '10px 0', borderTop: '1px solid #EFEDE7' }}>
              <span className="pill" style={{ background: bg, color: fg }}>{label}</span>
              <div className="grow" style={{ minWidth: 220 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{l.title}</div><div className="small muted">{l.body}</div></div>
              <div className="small muted">{l.sent_count} devices · {fmt(l.sent_at)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Taxonomy({ themes, genres, interest, readers, reload, flash }) {
  const [t, setT] = useState({ name: '', color: '#FFD666' });
  const [g, setG] = useState({ name: '', description: '' });
  async function add(table, row, reset) {
    if (!row.name.trim()) return;
    const list = table === 'themes' ? themes : genres;
    const { error } = await supabase.from(table).insert({ ...row, name: row.name.trim(), sort: list.length + 1 });
    if (error) return flash(error.message);
    reset(); reload();
  }
  async function del(table, row) {
    if (!window.confirm('Remove “' + row.name + '”? Stories using it will keep their text but lose this tag.')) return;
    const { error } = await supabase.from(table).delete().eq('id', row.id);
    if (error) return flash(error.message);
    reload();
  }
  const maxInterest = Math.max(1, ...Object.values(interest));
  return (
    <>
      <div>
        <h1 className="title">Themes &amp; genres</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 720 }}>Themes are what a story is about. Genres are what kind of post it is. Readers pick the themes they like at sign-up. Everyone still gets every story, so use their picks to plan what to write more of.</p>
      </div>
      <div className="split">
        <div className="main card stack" style={{ padding: 24 }}>
          <div className="row between"><h2 style={{ fontSize: 18 }}>Themes</h2>{readers !== null && <span className="small muted">{readers} readers</span>}</div>
          {themes.map((x) => (
            <div key={x.id} className="row" style={{ gap: 12 }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, background: x.color, flexShrink: 0 }} />
              <span style={{ width: 130, fontWeight: 600 }}>{x.name}</span>
              <span className="grow" style={{ height: 8, borderRadius: 4, background: '#F1EFEA', position: 'relative' }} aria-hidden="true">
                <span style={{ position: 'absolute', inset: 0, width: ((interest[x.id] || 0) / maxInterest) * 100 + '%', background: 'var(--ink)', borderRadius: 4 }} />
              </span>
              <span className="small muted" style={{ width: 90, textAlign: 'right' }}>{interest[x.id] || 0} interested</span>
              <button className="btn small ghost" onClick={() => del('themes', x)} aria-label={'Remove ' + x.name}>Remove</button>
            </div>
          ))}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input aria-label="New theme name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="Add a theme, e.g. Forgiveness" style={{ flex: '1 1 200px', height: 42, borderRadius: 10, border: '1.5px solid #D6D3CA', padding: '0 12px' }} />
            <input aria-label="Theme colour" type="color" value={t.color} onChange={(e) => setT({ ...t, color: e.target.value })} style={{ width: 48, height: 42, border: 0, background: 'none' }} />
            <button className="btn small" onClick={() => add('themes', t, () => setT({ name: '', color: '#FFD666' }))}>Add</button>
          </div>
        </div>
        <div className="main card stack" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18 }}>Genres</h2>
          {genres.map((x) => (
            <div key={x.id} className="row between" style={{ gap: 12 }}>
              <span><div style={{ fontWeight: 600 }}>{x.name}</div>{x.description && <div className="small muted">{x.description}</div>}</span>
              <button className="btn small ghost" onClick={() => del('genres', x)} aria-label={'Remove ' + x.name}>Remove</button>
            </div>
          ))}
          <input aria-label="New genre name" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Add a genre, e.g. Verse of the Day" style={{ height: 42, borderRadius: 10, border: '1.5px solid #D6D3CA', padding: '0 12px' }} />
          <input aria-label="New genre description" value={g.description} onChange={(e) => setG({ ...g, description: e.target.value })} placeholder="Short description (optional)" style={{ height: 42, borderRadius: 10, border: '1.5px solid #D6D3CA', padding: '0 12px' }} />
          <button className="btn small" onClick={() => add('genres', g, () => setG({ name: '', description: '' }))}>Add genre</button>
        </div>
      </div>
    </>
  );
}
