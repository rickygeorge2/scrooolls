'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { loadPlan } from '@/lib/journey';

// Admin page for "The Gospels in 100 Days": who's taking part, and the Discover / Reflect / Respond text for each day.
export default function JourneyAdmin({ flash }) {
  const [plan, setPlan] = useState(null);
  const [content, setContent] = useState({});
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState({ discover: '', reflect: '', respond: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadPlan().then(setPlan);
    supabase.from('journey_content').select('*').then(({ data }) => setContent(Object.fromEntries((data || []).map((r) => [r.day, r]))));
    supabase.from('journeys').select('current_day, completed_days, streak, last_active_on, finished_at').then(({ data }) => {
      const rows = data || [];
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      setStats({
        started: rows.length,
        onStreak: rows.filter((r) => r.last_active_on && r.last_active_on >= yesterday && r.streak > 0).length,
        finished: rows.filter((r) => r.finished_at).length,
        avgDays: rows.length ? Math.round(rows.reduce((a, r) => a + r.completed_days, 0) / rows.length) : 0,
      });
    });
  }, []);

  function edit(day) {
    if (open === day) { setOpen(null); return; }
    const c = content[day] || {};
    setDraft({ discover: c.discover || '', reflect: c.reflect || '', respond: c.respond || '' });
    setOpen(day);
  }

  async function save(day) {
    setSaving(true);
    const row = { day, discover: draft.discover.trim() || null, reflect: draft.reflect.trim() || null, respond: draft.respond.trim() || null, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('journey_content').upsert(row);
    setSaving(false);
    if (error) return flash(error.message);
    setContent({ ...content, [day]: row });
    flash('Day ' + day + ' saved');
    setOpen(null);
  }

  if (!plan) return <><h1 className="title">The Gospels in 100 Days</h1><p className="muted">Loading…</p></>;
  const filled = (d) => { const c = content[d]; return c && (c.discover || c.reflect || c.respond); };
  const doneCount = plan.days.filter((d) => filled(d.day)).length;
  const days = plan.days.filter((d) => filter === 'all' || (filter === 'missing' ? !filled(d.day) : filled(d.day)));

  return (
    <>
      <div>
        <h1 className="title">The Gospels in 100 Days</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 760 }}>Each day, readers scroll through the chapter one verse at a time, then see Discover, Reflect and Respond if you’ve written them. A day without them simply ends after the last verse.</p>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
          {[['Started the journey', stats.started], ['On a streak now', stats.onStreak], ['Average days done', stats.avgDays], ['Finished all 100', stats.finished]].map(([l, v]) => (
            <div key={l} className="card" style={{ padding: 16 }}>
              <div className="small" style={{ color: 'var(--soft)', fontWeight: 600 }}>{l}</div>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 28 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 20 }}>Daily reflections <span className="small muted" style={{ fontWeight: 400 }}>· {doneCount} of 100 days written</span></h2>
        <div className="seg" role="group" aria-label="Show">
          {[['all', 'All'], ['missing', 'Not written'], ['done', 'Written']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} style={{ padding: '0 12px' }} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {days.map((d) => (
          <div key={d.day} className="card" style={{ padding: 0 }}>
            <button onClick={() => edit(d.day)} aria-expanded={open === d.day}
              style={{ width: '100%', border: 0, background: 'transparent', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 700, width: 64, flexShrink: 0 }}>Day {d.day}</span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{d.label}{d.theme ? ' · ' + d.theme : ''}</span>
                <span className="small muted" style={{ display: 'block' }}>{d.section} · {d.count} verses</span>
              </span>
              <span className="pill" style={{ background: filled(d.day) ? 'var(--ok-bg)' : '#F1EFEA', color: filled(d.day) ? 'var(--ok)' : '#3A3E4A' }}>{filled(d.day) ? 'Written' : 'Not written'}</span>
            </button>
            {open === d.day && (
              <div className="stack" style={{ gap: 12, padding: '0 16px 16px' }}>
                {[['discover', 'Discover', 'A short explanation of the chapter'], ['reflect', 'Reflect', 'One meaningful insight'], ['respond', 'Respond', 'One question to apply to life']].map(([k, l, hint]) => (
                  <label key={k} className="field">{l} <span className="hint">{hint}</span>
                    <textarea rows={k === 'discover' ? 4 : 2} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
                  </label>
                ))}
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn small" disabled={saving} onClick={() => save(d.day)}>{saving ? 'Saving…' : 'Save day ' + d.day}</button>
                  <button className="btn small outline" onClick={() => setOpen(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
