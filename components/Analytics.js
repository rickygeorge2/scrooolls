'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { authHeader } from '@/lib/useAuth';

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']];
const num = (n) => Number(n || 0).toLocaleString();
const mins = (m) => { m = Number(m || 0); return m < 60 ? m + ' min' : (m / 60).toFixed(m < 600 ? 1 : 0) + ' hrs'; };
const shortDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const ago = (ts) => {
  if (!ts) return 'Never';
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 120) return 'Just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' hrs ago';
  return Math.round(s / 86400) + ' days ago';
};

function Tile({ label, value, note }) {
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="small" style={{ color: 'var(--soft)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 30, lineHeight: 1.1 }}>{value}</div>
      {note && <div className="small muted">{note}</div>}
    </div>
  );
}

// One measure per day, as thin bars with a hover readout.
function DailyBars({ title, data, field, format = num }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => Number(d[field]) || 0));
  const total = data.reduce((a, d) => a + (Number(d[field]) || 0), 0);
  const shown = hover !== null ? data[hover] : null;
  const labelEvery = Math.ceil(data.length / 7);
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <h3 style={{ fontSize: 15, fontFamily: 'var(--font-body)', fontWeight: 700 }}>{title}</h3>
        <span className="small muted" aria-live="polite">{shown ? `${shortDay(shown.day)}: ${format(shown[field])}` : `Total ${format(total)}`}</span>
      </div>
      <div role="img" aria-label={`${title}, ${data.length} days, total ${format(total)}`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, borderBottom: '1px solid var(--line)' }}
        onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const v = Number(d[field]) || 0;
          return (
            <div key={d.day} onMouseEnter={() => setHover(i)} title={`${shortDay(d.day)}: ${format(v)}`}
              style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'default' }}>
              <div style={{ width: '100%', maxWidth: 28, margin: '0 auto', height: v ? Math.max(3, (v / max) * 100) + '%' : 0,
                background: hover === i ? 'var(--accent)' : 'var(--ink)', borderRadius: '4px 4px 0 0' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2 }} aria-hidden="true">
        {data.map((d, i) => (
          <div key={d.day} className="small" style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--soft)', whiteSpace: 'nowrap', overflow: 'visible' }}>
            {i % labelEvery === 0 ? shortDay(d.day) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics({ flash = () => {} }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState(null);

  async function removePerson(p) {
    const who = (p.name || 'this person') + ' (' + p.email + ')';
    if (!window.confirm('Permanently delete ' + who + '?\n\nTheir account, reading history and notification settings will be erased and cannot be recovered. Any stories they published will stay up.')) return;
    setDeleting(p.id);
    const res = await fetch('/api/admin/delete-user', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ userId: p.id }) });
    const out = await res.json().catch(() => ({}));
    setDeleting(null);
    if (!res.ok) return flash('Could not delete: ' + (out.error || res.status));
    flash('Deleted ' + p.email);
    load();
  }

  const load = useCallback(async () => {
    setError('');
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const { data, error } = await supabase.rpc('admin_stats', { p_days: days, p_tz: tz });
    if (error) setError(error.message); else setData(data);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (error) return <><h1 className="title">Analytics</h1><p className="error">{error}</p></>;
  if (!data) return <><h1 className="title">Analytics</h1><p className="muted">Loading…</p></>;

  const t = data.totals;
  const avgMins = t.active_period ? Math.round(t.minutes / t.active_period) : 0;
  const readsPer = t.active_period ? (t.reads / t.active_period).toFixed(1) : '0';
  const clickRate = t.reads ? Math.round((t.link_opens / t.reads) * 100) : 0;
  const maxTheme = Math.max(1, ...data.themes.map((x) => Number(x.reads) || 0));
  const people = data.people.filter((p) => !query || (p.name || '').toLowerCase().includes(query.toLowerCase()) || (p.email || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div className="row between" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <h1 className="title">Analytics</h1>
          <p className="muted" style={{ marginTop: 6 }}>How people are using Scrooolls. Time spent counts only while the app is open on screen.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="Date range">
            {RANGES.map(([d, l]) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)} style={{ padding: '0 12px' }}>{l}</button>)}
          </div>
          <button className="btn small outline" onClick={load}>Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <Tile label="People signed up" value={num(t.people)} note={`${num(t.new_people)} new in the last ${days} days`} />
        <Tile label="Active today" value={num(t.active_today)} note={`${num(t.active_7)} in the last 7 days`} />
        <Tile label={`Active in ${days} days`} value={num(t.active_period)} note={`${num(t.opens)} app opens`} />
        <Tile label="Time spent" value={mins(t.minutes)} note={`About ${avgMins} min per active person`} />
        <Tile label="Stories read" value={num(t.reads)} note={`${readsPer} per active person`} />
        <Tile label="“Read more” taps" value={num(t.link_opens)} note={`${clickRate}% of stories read`} />
        <Tile label="Notifications on" value={num(t.notifications_on)} note={t.people ? `${Math.round((t.notifications_on / t.people) * 100)}% of people` : ''} />
        <Tile label="Stories published" value={num(t.published)} note={`in the last ${days} days`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <DailyBars title="Active people per day" data={data.daily} field="active" />
        <DailyBars title="Minutes spent per day" data={data.daily} field="minutes" format={(v) => num(v) + ' min'} />
        <DailyBars title="Stories read per day" data={data.daily} field="reads" />
        <DailyBars title="New sign-ups per day" data={data.daily} field="signups" />
      </div>

      <div className="split">
        <div className="main card" style={{ padding: 20, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: 8 }}>Most-read stories (published in the last {days} days)</h3>
          {data.top_stories.length === 0 ? <p className="muted small">No stories published in this period yet.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 480 }}>
                <thead><tr><th>Story</th><th>By</th><th style={{ textAlign: 'right' }}>Reads</th><th style={{ textAlign: 'right' }}>Read more</th></tr></thead>
                <tbody>
                  {data.top_stories.map((s) => (
                    <tr key={s.id}><td style={{ fontWeight: 600 }}>{s.title}</td><td>{s.author_name}</td>
                      <td style={{ textAlign: 'right' }}>{num(s.reads)}</td><td style={{ textAlign: 'right' }}>{num(s.link_opens)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="side card" style={{ padding: 20, maxWidth: 'none', flexBasis: 320 }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-body)', fontWeight: 700, marginBottom: 12 }}>Themes</h3>
          <div className="stack" style={{ gap: 12 }}>
            {data.themes.map((x) => (
              <div key={x.name} className="stack" style={{ gap: 4 }}>
                <div className="row between small"><span style={{ fontWeight: 600 }}>{x.name}</span><span className="muted">{num(x.reads)} reads · {num(x.interested)} interested</span></div>
                <div style={{ height: 8, borderRadius: 4, background: '#F1EFEA' }} aria-hidden="true">
                  <div style={{ height: '100%', width: (Number(x.reads) / maxTheme) * 100 + '%', background: 'var(--ink)', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20, minWidth: 0 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-body)', fontWeight: 700 }}>People ({num(data.people.length)})</h3>
          <input aria-label="Search people" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)}
            style={{ height: 38, border: '1.5px solid #D6D3CA', padding: '0 12px', minWidth: 220 }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Name</th><th>Joined</th><th>Last active</th><th style={{ textAlign: 'right' }}>Days active</th><th style={{ textAlign: 'right' }}>Time spent</th><th style={{ textAlign: 'right' }}>Stories read</th><th>Notifications</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td><div style={{ fontWeight: 600 }}>{p.name || '—'}{p.role !== 'reader' && <span className="pill" style={{ marginLeft: 6, background: '#F1EFEA' }}>{p.role}</span>}</div><div className="small muted">{p.email}</div></td>
                  <td className="small">{new Date(p.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="small">{ago(p.last_seen)}</td>
                  <td style={{ textAlign: 'right' }}>{num(p.days_active)}</td>
                  <td style={{ textAlign: 'right' }}>{mins(p.minutes)}</td>
                  <td style={{ textAlign: 'right' }}>{num(p.reads)}</td>
                  <td className="small">{p.notifications ? 'On' : 'Off'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {p.role !== 'admin' && (
                      <button className="btn small ghost" style={{ color: 'var(--bad)' }} disabled={deleting !== null} onClick={() => removePerson(p)}
                        aria-label={'Delete ' + (p.name || p.email)}>{deleting === p.id ? 'Deleting…' : 'Delete'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Days active, time spent and stories read cover the selected period. Time tracking started on 26 Nov 2026, so earlier visits aren’t counted.</p>
      </div>
    </>
  );
}
