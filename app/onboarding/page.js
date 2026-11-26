'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { enablePush } from '@/lib/pushClient';
import InstallSheet from '@/components/InstallSheet';
import { Back, Bell } from '@/components/Icons';

const HOURS = [5, 6, 7, 8, 9, 10];
const hourLabel = (h) => (h > 12 ? h - 12 : h) + ':00 ' + (h >= 12 ? 'PM' : 'AM');

export default function Onboarding() {
  const router = useRouter();
  const { loading, session, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [themes, setThemes] = useState([]);
  const [people, setPeople] = useState([]);
  const [picked, setPicked] = useState([]);
  const [follows, setFollows] = useState([]);
  const [hour, setHour] = useState(7);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !session) router.replace('/login?mode=signup');
  }, [loading, session, router]);

  useEffect(() => {
    supabase.from('themes').select('*').order('sort').then(({ data }) => setThemes(data || []));
    supabase.from('contributors').select('*').order('name').then(({ data }) => setPeople(data || []));
  }, []);

  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function finish(withPush) {
    setBusy(true); setError('');
    try {
      const uid = profile.id;
      if (picked.length) await supabase.from('user_themes').upsert(picked.map((theme_id) => ({ user_id: uid, theme_id })));
      if (follows.length) await supabase.from('follows').upsert(follows.map((contributor_id) => ({ user_id: uid, contributor_id })));
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const { error } = await supabase.from('profiles').update({ first_hour: hour, timezone: tz, onboarded: true }).eq('id', uid);
      if (error) throw error;
      if (withPush) {
        const r = await enablePush(uid).catch(() => 'error');
        if (r === 'install-first') { setSheet(true); setBusy(false); return; }
      }
      window.location.replace('/');
    } catch (e) {
      setError(e.message || 'Could not save. Please try again.');
      setBusy(false);
    }
  }

  if (loading || !profile) return <main className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading…</p></main>;

  return (
    <main className="screen">
      <div className="row between">
        {step > 1 ? <button className="icon-btn" aria-label="Back" onClick={() => setStep(step - 1)}><Back /></button> : <span />}
        <span className="steps">Step {step} of 3</span>
      </div>

      {step === 1 && (
        <>
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="title">What do you want to study?</h1>
            <p className="lead">You’ll still get every story. Your picks tell us what to write more of.</p>
          </div>
          <div className="chip-grid grow" style={{ alignContent: 'start' }}>
            {themes.map((t) => (
              <button key={t.id} className={'chip' + (picked.includes(t.id) ? ' on' : '')} style={{ background: picked.includes(t.id) ? t.color : '#fff' }}
                aria-pressed={picked.includes(t.id)} onClick={() => toggle(picked, setPicked, t.id)}>{t.name}</button>
            ))}
          </div>
          <button className="btn" onClick={() => setStep(people.length ? 2 : 3)}>Continue{picked.length ? ` with ${picked.length}` : ''}</button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="title">Follow contributors</h1>
            <p className="lead">Get to know the people writing for Scrooolls. You can change this anytime.</p>
          </div>
          <div className="stack grow" style={{ gap: 10 }}>
            {people.map((p) => {
              const on = follows.includes(p.id);
              return (
                <div key={p.id} className="card row" style={{ gap: 12 }}>
                  <div className="avatar">{(p.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    {p.bio && <div className="small muted">{p.bio}</div>}
                  </div>
                  <button className={'btn small' + (on ? '' : ' outline')} style={{ borderRadius: 999, minWidth: 92 }} onClick={() => toggle(follows, setFollows, p.id)}>{on ? 'Following' : 'Follow'}</button>
                </div>
              );
            })}
          </div>
          <button className="btn" onClick={() => setStep(3)}>Continue</button>
        </>
      )}

      {step === 3 && (
        <>
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="title">When does your day start?</h1>
            <p className="lead">Pick when you’d like your first notification each morning.</p>
          </div>
          <div className="chip-grid grow" style={{ alignContent: 'start' }}>
            {HOURS.map((h) => (
              <button key={h} className={'chip' + (hour === h ? ' on' : '')} aria-pressed={hour === h}
                style={{ background: hour === h ? 'var(--accent)' : '#fff', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 20 }}
                onClick={() => setHour(h)}>{hourLabel(h)}</button>
            ))}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="stack" style={{ gap: 8 }}>
            <button className="btn" disabled={busy} onClick={() => finish(true)}><Bell /> Turn on notifications</button>
            <button className="btn ghost" disabled={busy} onClick={() => finish(false)}>Not now</button>
          </div>
        </>
      )}
      {sheet && <InstallSheet onClose={() => window.location.replace('/')} />}
    </main>
  );
}
