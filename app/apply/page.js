'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { Back, Check } from '@/components/Icons';

export default function Apply() {
  const router = useRouter();
  const { loading, session, profile } = useAuth();
  const [existing, setExisting] = useState(undefined);
  const [form, setForm] = useState({ topic: '', about: '', sample_link: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!loading && !session) router.replace('/login?next=/apply'); }, [loading, session, router]);
  useEffect(() => {
    if (!profile) return;
    supabase.from('applications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setExisting(data && data[0] ? data[0] : null));
  }, [profile]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const { data, error } = await supabase.from('applications').insert({ user_id: profile.id, ...form }).select().single();
    setBusy(false);
    if (error) setError(error.message); else setExisting(data);
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  if (!profile || existing === undefined) return <main className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading…</p></main>;

  if (profile.role !== 'reader' || (existing && existing.status !== 'declined')) {
    const approved = profile.role !== 'reader' || existing.status === 'approved';
    return (
      <main className="screen">
        <Link href="/discover" className="icon-btn" aria-label="Back"><Back /></Link>
        <div className="grow stack" style={{ justifyContent: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: '#A8D5B0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check /></div>
          <h1 className="title">{approved ? 'You’re a contributor' : 'Application sent'}</h1>
          <p className="lead">{approved ? 'Open the dashboard to write your first story.' : 'An admin will review it. Once you’re approved, you’ll see “Open the dashboard” under Discover → Me.'}</p>
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
      <form className="stack grow" onSubmit={submit} style={{ gap: 16 }}>
        <label className="field">What would you write about?<input value={form.topic} onChange={set('topic')} placeholder="e.g. a 30-day series on hope" required /></label>
        <label className="field">A little about you<textarea rows={4} value={form.about} onChange={set('about')} placeholder="Your church, ministry or why you want to write" /></label>
        <label className="field"><span>Link to a sample <span className="hint">(optional)</span></span><input type="url" value={form.sample_link} onChange={set('sample_link')} placeholder="https://" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="grow" />
        <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send application'}</button>
      </form>
    </main>
  );
}
