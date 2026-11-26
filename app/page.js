'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { isConfigured } from '@/lib/supabaseClient';
import Landing from '@/components/Landing';
import Feed from '@/components/Feed';

export default function Home() {
  const { loading, session, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session && profile && !profile.onboarded) router.replace('/onboarding');
  }, [loading, session, profile, router]);

  if (!isConfigured) {
    return (
      <main className="screen" style={{ justifyContent: 'center' }}>
        <h1 className="title">Almost there</h1>
        <p className="lead">Scrooolls is online, but the Supabase keys haven’t been added in Vercel yet. Follow step 5 of the launch guide.</p>
      </main>
    );
  }
  if (loading) return <main className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading…</p></main>;
  if (!session) return <Landing />;
  if (!profile || !profile.onboarded) return <main className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted">Loading…</p></main>;
  return <Feed profile={profile} />;
}
