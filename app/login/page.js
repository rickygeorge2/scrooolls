'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Back, Logo } from '@/components/Icons';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [showPw, setShowPw] = useState(false);
  const [next, setNext] = useState('/');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('mode') === 'signup') setMode('signup');
    if (q.get('next')) setNext(q.get('next'));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      if (mode === 'signup') {
        if (!form.name.trim()) throw new Error('Please enter your name.');
        if (form.password.length < 8) throw new Error('Use at least 8 characters for your password.');
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(), password: form.password,
          options: { data: { name: form.name.trim(), phone: form.phone.trim() || null } },
        });
        if (error) throw error;
        if (!data.session) { setNotice('Check your email to confirm your account, then log in.'); setMode('login'); return; }
        router.replace('/onboarding');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) throw error;
        router.replace(next);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === 'signup';
  return (
    <main className="screen">
      <div className="row between">
        <Link href="/" className="icon-btn" aria-label="Back"><Back /></Link>
        <Logo size={32} />
      </div>
      <h1 className="title">{signup ? 'Create your account' : 'Welcome back'}</h1>
      <form className="stack grow" onSubmit={submit} style={{ gap: 16 }}>
        {signup && (
          <label className="field">Name<input value={form.name} onChange={set('name')} autoComplete="name" required /></label>
        )}
        <label className="field">Email<input type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></label>
        {signup && (
          <label className="field"><span>Phone number <span className="hint">(optional)</span></span>
            <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="+91" /></label>
        )}
        <div className="field">
          <label htmlFor="password">Password</label>
          <div style={{ position: 'relative' }}>
            <input id="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')}
              autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined}
              style={{ width: '100%', paddingRight: 76 }} />
            <button type="button" onClick={() => setShowPw(!showPw)} aria-pressed={showPw} aria-controls="password"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 4, top: 4, bottom: 4, minWidth: 64, border: 0, borderRadius: 999, background: '#F1EFEA', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          {signup && <span className="hint" style={{ fontSize: 13 }}>At least 8 characters</span>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="card" role="status">{notice}</p>}
        <div className="grow" />
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}</button>
        <button type="button" className="btn ghost" onClick={() => { setMode(signup ? 'login' : 'signup'); setError(''); }}>
          {signup ? 'I already have an account · Log in' : 'New here? Create an account'}
        </button>
      </form>
    </main>
  );
}
