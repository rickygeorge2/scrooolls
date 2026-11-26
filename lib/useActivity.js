'use client';
import { useEffect } from 'react';
import { supabase } from './supabaseClient';

// Records app opens and time on screen (in 30-second steps, only while the app is visible).
export function useActivity(userId) {
  useEffect(() => {
    if (!userId) return;
    const send = (seconds, open) => supabase.rpc('track_activity', { p_seconds: seconds, p_open: open }).then(() => {}, () => {});
    let hiddenAt = null;
    // One "open" per launch, shared across pages in the same visit.
    if (!sessionStorage.getItem('scrooolls-open')) {
      sessionStorage.setItem('scrooolls-open', '1');
      send(0, true);
    }
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') send(30, false);
    }, 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000) send(0, true); // back after 30+ minutes counts as a new open
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [userId]);
}
