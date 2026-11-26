'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { useActivity } from '@/lib/useActivity';
import { enablePush, pushStatus } from '@/lib/pushClient';
import { BADGES, REMINDER_HOURS, TOTAL_DAYS, hourLabel, loadDay, loadPlan } from '@/lib/journey';
import Badge from '@/components/Badge';
import { Back, Check, Down, Up } from '@/components/Icons';

const Flame = ({ lit = true, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.4 2.5 1.7 0 2.6-1.5 2.1-3.6C17.4 10 19 12.6 19 15a7 7 0 1 1-14 0c0-4.4 3.4-6.6 4.7-9.4C10.5 4 11.4 3 12 2z"
      fill={lit ? '#FF8A3D' : '#D6D3CA'} stroke={lit ? '#C2410C' : '#B8B4A9'} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

function scrollsLeftText(left) {
  if (left <= 0) return 'Last one!';
  return left === 1 ? '1 more to go' : `${left} more to go`;
}

export default function Journey() {
  const router = useRouter();
  const { loading, session, profile } = useAuth();
  useActivity(profile?.id);
  const [state, setState] = useState(null);
  const [plan, setPlan] = useState(null);
  const [hour, setHour] = useState(7);
  const [reading, setReading] = useState(null); // { day, label, verses, idx }
  const [done, setDone] = useState(null); // result after finishing a day
  const [busy, setBusy] = useState(false);
  const start = useRef(null);
  const lastWheel = useRef(0);

  useEffect(() => { if (!loading && !session) router.replace('/login?next=/journey'); }, [loading, session, router]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc('journey_state');
    setState(data || { started: false });
    if (data?.reminder_hour !== undefined) setHour(data.reminder_hour);
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadPlan().then(setPlan);
    // Opening the journey counts towards today's streak (if they've started)
    supabase.rpc('journey_checkin').then(({ data }) => (data ? (setState(data), setHour(data.reminder_hour ?? 7)) : refresh()));
  }, [profile, refresh]);

  async function startJourney() {
    setBusy(true);
    const { data, error } = await supabase.rpc('journey_start', { p_hour: hour });
    if (!error) {
      const { data: checked } = await supabase.rpc('journey_checkin');
      setState(checked || data);
      if (pushStatus() === 'default') enablePush(profile.id).catch(() => {});
    }
    setBusy(false);
  }

  async function changeHour(h) {
    setHour(h);
    const { data } = await supabase.rpc('journey_set_reminder', { p_hour: h });
    if (data) setState(data);
  }

  async function openReading() {
    const day = await loadDay(state.current_day);
    setReading({ day: day.day, label: day.label, verses: day.verses, idx: Math.min(state.position, day.verses.length - 1) });
  }

  const advance = useCallback(async () => {
    if (!reading) return;
    const total = reading.verses.length;
    const nextIdx = reading.idx + 1;
    if (nextIdx >= total) {
      const { data } = await supabase.rpc('journey_progress', { p_position: total, p_total: total });
      setReading(null);
      if (data) { setState(data); setDone(data); }
      return;
    }
    setReading((r) => ({ ...r, idx: nextIdx }));
    supabase.rpc('journey_progress', { p_position: nextIdx, p_total: total }).then(() => {});
  }, [reading]);

  const back = useCallback(() => setReading((r) => (r && r.idx > 0 ? { ...r, idx: r.idx - 1 } : r)), []);

  function onPointerDown(e) { start.current = { x: e.clientX, y: e.clientY }; }
  function onPointerUp(e) {
    if (!start.current) return;
    const dy = e.clientY - start.current.y, dx = e.clientX - start.current.x;
    start.current = null;
    if (Math.abs(dy) < Math.abs(dx)) return;
    if (dy < -40) advance(); else if (dy > 40) back();
  }
  function onWheel(e) {
    const now = Date.now();
    if (now - lastWheel.current < 600 || Math.abs(e.deltaY) < 12) return;
    lastWheel.current = now;
    if (e.deltaY > 0) advance(); else back();
  }

  if (loading || !profile || !state || !plan) return <main className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading…</p></main>;

  const earned = new Set(state.badges || []);
  const today = plan.days[(state.current_day || 1) - 1];

  // ---------- Reading: one verse per scroll ----------
  if (reading) {
    const total = reading.verses.length;
    const left = total - reading.idx - 1;
    return (
      <div className="feed" style={{ background: 'var(--ground)' }}>
        <header className="feed-head" style={{ background: 'var(--ground)' }}>
          <button className="icon-btn" aria-label="Close reading" onClick={() => { setReading(null); refresh(); }}><Back /></button>
          <div style={{ textAlign: 'center' }}>
            <div className="small" style={{ fontWeight: 700 }}>Day {reading.day} of {TOTAL_DAYS}</div>
            <div className="small muted" aria-live="polite">{scrollsLeftText(left)}</div>
          </div>
          <div className="row" style={{ gap: 4, minWidth: 44, justifyContent: 'flex-end', fontWeight: 700 }}><Flame />{state.streak}</div>
        </header>
        <div style={{ height: 4, background: '#ECE9E1' }} aria-hidden="true">
          <div style={{ height: '100%', width: ((reading.idx + 1) / total) * 100 + '%', background: 'var(--accent)', transition: 'width 300ms' }} />
        </div>
        <div className="feed-body" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onWheel={onWheel}>
          {reading.verses.map((v, i) => (
            <section key={i} className="story" aria-hidden={i !== reading.idx}
              style={{ transform: `translateY(${(i - reading.idx) * 100}%)`, background: 'var(--ground)', justifyContent: 'center', padding: '32px 28px', gap: 20 }}>
              <div className="small" style={{ fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--soft)' }}>{v.ref}</div>
              <p style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: v.text.length > 220 ? 22 : 26, lineHeight: 1.5, color: '#1F2128' }}>{v.text}</p>
              <div className="small muted" style={{ marginTop: 12 }}>{i === total - 1 ? 'Swipe up to finish today’s reading' : 'Swipe up for the next verse'}</div>
            </section>
          ))}
          <div className="nav-arrows" style={{ top: 'auto', bottom: 24 }}>
            <button onClick={back} aria-label="Previous verse"><Up /></button>
            <button onClick={advance} aria-label="Next verse"><Down /></button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Day finished ----------
  if (done) {
    const newBadges = BADGES.filter((b) => (done.new_badges || []).includes(b.days));
    return (
      <main className="screen" style={{ justifyContent: 'center', gap: 20, textAlign: 'center', alignItems: 'center' }}>
        {newBadges.length ? (
          <>
            <div className="small" style={{ fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--soft)' }}>New badge unlocked</div>
            {newBadges.map((b) => <Badge key={b.days} badge={b} earned size={140} />)}
            <h1 className="title">{newBadges[newBadges.length - 1].name}!</h1>
            <p className="lead">{newBadges[newBadges.length - 1].note}. Well done.</p>
          </>
        ) : (
          <>
            <div style={{ width: 80, height: 80, borderRadius: 999, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check /></div>
            <h1 className="title">Day {done.completed_days} complete</h1>
          </>
        )}
        <div className="row" style={{ gap: 8, fontSize: 18, fontWeight: 700 }}><Flame size={28} /> {done.streak} day streak</div>
        <p className="lead">
          {done.finished ? 'You’ve read all four Gospels. Amazing.' : `${TOTAL_DAYS - done.completed_days} days to go. Day ${done.current_day} unlocks tomorrow, and we’ll remind you at ${hourLabel(done.reminder_hour)}.`}
        </p>
        <button className="btn" style={{ alignSelf: 'stretch' }} onClick={() => setDone(null)}>Done</button>
      </main>
    );
  }

  // ---------- Not started yet ----------
  if (!state.started) {
    return (
      <main className="screen" style={{ gap: 18 }}>
        <Link href="/discover" className="icon-btn" aria-label="Back"><Back /></Link>
        <div className="stack" style={{ gap: 10 }}>
          <div className="small" style={{ fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--soft)' }}>100-day challenge</div>
          <h1 className="title">Read the Gospels in 100 days</h1>
          <p className="lead">Matthew, Mark, Luke and John, one verse at a time. About {Math.round(plan.days.reduce((a, d) => a + d.count, 0) / plan.days.length)} scrolls a day, roughly 5 minutes. Keep your streak going and earn badges along the way.</p>
        </div>
        <div className="row" style={{ gap: 4, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {BADGES.map((b) => <Badge key={b.days} badge={b} earned size={52} />)}
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <div style={{ fontWeight: 700 }}>When do you want to read each day?</div>
          <p className="small muted">We’ll send a reminder at this time.</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {REMINDER_HOURS.map((h) => (
              <button key={h} className={'btn small' + (hour === h ? ' yellow' : ' outline')} aria-pressed={hour === h} onClick={() => setHour(h)}>{hourLabel(h)}</button>
            ))}
          </div>
        </div>
        <div className="grow" />
        <button className="btn" disabled={busy} onClick={startJourney}>{busy ? 'Starting…' : 'Start the journey'}</button>
      </main>
    );
  }

  // ---------- Journey home ----------
  const pct = Math.round((state.completed_days / TOTAL_DAYS) * 100);
  return (
    <main className="screen" style={{ gap: 18 }}>
      <div className="row between">
        <Link href="/discover" className="icon-btn" aria-label="Back"><Back /></Link>
        <div className="row" style={{ gap: 6, padding: '6px 12px', borderRadius: 999, background: '#fff', border: '1px solid var(--line)', fontWeight: 700 }}
          aria-label={`${state.streak} day streak`}>
          <Flame lit={state.streak > 0} /> {state.streak} day streak
        </div>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="title">Read the Gospels in 100 days</h1>
        <div className="row between small"><span style={{ fontWeight: 700 }}>{state.completed_days} of {TOTAL_DAYS} days</span><span className="muted">{pct}%</span></div>
        <div style={{ height: 10, borderRadius: 5, background: '#ECE9E1' }} role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_DAYS} aria-valuenow={state.completed_days}>
          <div style={{ height: '100%', width: pct + '%', background: 'var(--ink)', borderRadius: 5 }} />
        </div>
      </div>

      {state.finished ? (
        <div className="card stack" style={{ gap: 8, padding: 20 }}>
          <h2 style={{ fontSize: 22 }}>You did it!</h2>
          <p className="lead">You’ve read all four Gospels. Best streak: {state.best_streak} days.</p>
        </div>
      ) : state.done_today ? (
        <div className="card stack" style={{ gap: 8, padding: 20 }}>
          <div className="row" style={{ gap: 8 }}><Check /><h2 style={{ fontSize: 22 }}>Today’s reading is done</h2></div>
          <p className="lead">Day {state.current_day} ({today?.label}) unlocks tomorrow. We’ll remind you at {hourLabel(state.reminder_hour)}.</p>
        </div>
      ) : (
        <div className="card stack" style={{ gap: 12, padding: 20, background: 'var(--ink)', color: '#fff', border: 0 }}>
          <div className="small" style={{ color: '#C9CCD6', fontWeight: 600 }}>Day {state.current_day} · today’s reading</div>
          <h2 style={{ fontSize: 24 }}>{today?.label}</h2>
          <div className="small" style={{ color: '#C9CCD6' }}>
            {state.position > 0 ? `${today.count - state.position} of ${today.count} scrolls left` : `${today?.count} scrolls`}
          </div>
          <button className="btn yellow" onClick={openReading}>{state.position > 0 ? 'Continue reading' : 'Start reading'}</button>
        </div>
      )}

      <div className="stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 18 }}>Badges</h2>
        <div className="row" style={{ gap: 4, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {BADGES.map((b) => <Badge key={b.days} badge={b} earned={earned.has(b.days)} size={56} />)}
        </div>
        <p className="small muted">Earn a badge at 10, 25, 50, 75 and 100 days of reading. Best streak so far: {state.best_streak} days.</p>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 18 }}>Daily reminder</h2>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {REMINDER_HOURS.map((h) => (
            <button key={h} className={'btn small' + (state.reminder_hour === h ? ' yellow' : ' outline')} aria-pressed={state.reminder_hour === h} onClick={() => changeHour(h)}>{hourLabel(h)}</button>
          ))}
        </div>
      </div>
    </main>
  );
}
