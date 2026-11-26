'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { Back, Check } from '@/components/Icons';

const PARTNER_QUESTIONS = [
  ['about', 'What does your organization do?', 'A few sentences about your ministry, church or organization', 3],
  ['vision', 'What is your vision?', 'The future you’re working towards', 2],
  ['mission', 'What is your mission?', 'How you’re working towards that vision', 2],
  ['audience', 'Who do you serve?', 'e.g. college students in Pune, young adults across India', 2],
  ['content', 'What would you share on Scrooolls?', 'Series, topics, how often you’d post', 2],
  ['contact', 'Your name and role in the organization', 'e.g. Priya Thomas, Youth Pastor', 1],
];

export default function Apply() {
  const router = useRouter();
  const { loading, session, profile } = useAuth();
  const [existing, setExisting] = useState(undefined);
  const [kind, setKind] = useState('contributor');
  const [form, setForm] = useState({ topic: '', about: '', sample_link: '' });
  const [org, setOrg] = useState({ org_name: '', org_website: '', instagram: '', youtube: '', linkedin: '', about: '', vision: '', mission: '', audience: '', content: '', contact: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!loading && !session) router.replace('/login?next=/apply'); }, [loading, session, router]);
  useEffect(() => {
    if (!profile) return;
    if (new URLSearchParams(window.location.search).get('as') === 'partner') setKind('partner');
    supabase.from('applications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setExisting(data && data[0] ? data[0] : null));
  }, [profile]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    let row;
    if (kind === 'partner') {
      const site = org.org_website.trim();
      row = {
        user_id: profile.id, kind: 'partner', org_name: org.org_name.trim(),
        org_website: site && !/^https?:\/\//i.test(site) ? 'https://' + site : site,
        topic: org.content.trim() || 'Organization partner', about: org.about.trim(),
        answers: { vision: org.vision.trim(), mission: org.mission.trim(), audience: org.audience.trim(), content: org.content.trim(), contact: org.contact.trim(),
          instagram: org.instagram.trim(), youtube: org.youtube.trim(), linkedin: org.linkedin.trim() },
      };
    } else {
      row = { user_id: profile.id, kind: 'contributor', ...form };
    }
    const { data, error } = await supabase.from('applications').insert(row).select().single();
    setBusy(false);
    if (error) setError(error.message); else setExisting(data);
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setO = (k) => (e) => setOrg({ ...org, [k]: e.target.value });
  if (!profile || existing === undefined) return <main className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading…</p></main>;

  if (profile.role !== 'reader' || (existing && existing.status !== 'declined')) {
    const approved = profile.role !== 'reader' || existing.status === 'approved';
    const asPartner = profile.role === 'partner' || existing?.kind === 'partner';
    return (
      <main className="screen">
        <Link href="/discover" className="icon-btn" aria-label="Back"><Back /></Link>
        <div className="grow stack" style={{ justifyContent: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: '#A8D5B0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check /></div>
          <h1 className="title">{approved ? (asPartner ? 'You’re a Scrooolls partner' : 'You’re a contributor') : 'Application sent'}</h1>
          <p className="lead">
            {approved
              ? (asPartner ? 'Open the dashboard to set up your partner page and publish stories.' : 'Open the dashboard to write your first story.')
              : 'An admin will review it. Once you’re approved, you’ll see “Open the dashboard” under Discover → Me.'}
          </p>
        </div>
        {approved ? <Link className="btn" href="/dashboard">Open the dashboard</Link> : <Link className="btn" href="/">Back to reading</Link>}
      </main>
    );
  }

  return (
    <main className="screen">
      <Link href="/discover" className="icon-btn" aria-label="Back"><Back /></Link>
      <h1 className="title">Apply to contribute</h1>
      <p className="lead">{existing ? 'Your last application wasn’t approved, but you’re welcome to apply again.' : 'Once an admin approves you, you can publish stories from the dashboard.'}</p>

      <div className="stack" style={{ gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>I’m applying as</div>
        <div className="chip-grid">
          {[['contributor', 'An individual', 'Write stories under your own name'], ['partner', 'An organization partner', 'A church, ministry or organization with its own branded page']].map(([k, l, d]) => (
            <button key={k} type="button" className={'chip' + (kind === k ? ' on' : '')} aria-pressed={kind === k} onClick={() => setKind(k)}
              style={{ background: kind === k ? 'var(--accent)' : '#fff' }}>
              {l}<div className="small" style={{ fontWeight: 400, marginTop: 4 }}>{d}</div>
            </button>
          ))}
        </div>
      </div>

      <form className="stack grow" onSubmit={submit} style={{ gap: 16 }}>
        {kind === 'contributor' ? (
          <>
            <label className="field">What would you write about?<input value={form.topic} onChange={set('topic')} placeholder="e.g. a 30-day series on hope" required /></label>
            <label className="field">A little about you<textarea rows={4} value={form.about} onChange={set('about')} placeholder="Your church, ministry or why you want to write" /></label>
            <label className="field"><span>Link to a sample <span className="hint">(optional)</span></span><input type="url" value={form.sample_link} onChange={set('sample_link')} placeholder="https://" /></label>
          </>
        ) : (
          <>
            <label className="field">Organization name<input value={org.org_name} onChange={setO('org_name')} required maxLength={80} /></label>
            <label className="field">Organization website<input value={org.org_website} onChange={setO('org_website')} placeholder="yourorganization.org" required /></label>
            {PARTNER_QUESTIONS.map(([k, label, hint, rows]) => (
              <label key={k} className="field">{label} <span className="hint">{hint}</span>
                {rows > 1 ? <textarea rows={rows} value={org[k]} onChange={setO(k)} required /> : <input value={org[k]} onChange={setO(k)} required />}
              </label>
            ))}
            <div className="stack" style={{ gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Social links <span className="hint" style={{ fontWeight: 400 }}>(optional)</span></div>
              {[['instagram', 'Instagram', '@yourhandle'], ['youtube', 'YouTube', 'youtube.com/@yourchannel'], ['linkedin', 'LinkedIn', 'linkedin.com/company/…']].map(([k, l, ph]) => (
                <label key={k} className="field">{l}<input value={org[k]} onChange={setO(k)} placeholder={ph} /></label>
              ))}
            </div>
          </>
        )}
        <p className="small muted" style={{ lineHeight: 1.5 }}>Planning a series? <a href="/scrooolls-template.csv" download style={{ fontWeight: 600 }}>Download the story template</a>, fill it in Google Sheets, and upload it from the dashboard once you’re approved.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="grow" />
        <button className="btn" disabled={busy}>{busy ? 'Sending…' : kind === 'partner' ? 'Apply as a partner' : 'Send application'}</button>
      </form>
    </main>
  );
}
