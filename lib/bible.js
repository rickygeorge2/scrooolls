'use client';
import { authHeader } from './useAuth';

// Asks Scrooolls' server to look up a Bible reference. Returns { reference, text, translation } or { error }.
export async function lookupVerse(ref) {
  const res = await fetch('/api/bible?ref=' + encodeURIComponent(ref), { headers: await authHeader() });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return { error: out.error || 'Lookup failed' };
  return out;
}
