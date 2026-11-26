'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Current signed-in user and their profile.
export function useAuth() {
  const [state, setState] = useState({ loading: true, session: null, profile: null });

  const load = useCallback(async (session) => {
    if (!session) { setState({ loading: false, session: null, profile: null }); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setState({ loading: false, session, profile: data || null });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    // Supabase must not be called directly inside this listener (it can freeze),
    // so the profile is loaded a moment later instead.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  return { ...state, refresh };
}

export async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: 'Bearer ' + data.session.access_token } : {};
}
