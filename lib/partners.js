'use client';
import { supabase } from './supabaseClient';

export const HEX = /^#[0-9A-Fa-f]{6}$/;

export function slugify(s) {
  const s2 = (s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s2.length >= 2 ? s2 : (s2 + '-partner').replace(/^-/, '');
}

// WCAG contrast ratio between two hex colours (4.5 or more reads comfortably)
export function contrast(a, b) {
  if (!HEX.test(a) || !HEX.test(b)) return 0;
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Turns "@name", "instagram.com/name" or a full link into a proper https link
export function socialUrl(kind, value) {
  let v = (value || '').trim();
  if (!v) return '';
  if (v.startsWith('@')) {
    const handle = v.slice(1);
    if (kind === 'instagram') return 'https://instagram.com/' + handle;
    if (kind === 'youtube') return 'https://youtube.com/@' + handle;
  }
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  return v;
}

// All partner pages, keyed by the partner's profile id
let cache = null;
export async function loadPartners(force = false) {
  if (!cache || force) {
    const { data } = await supabase.from('partners').select('*');
    cache = Object.fromEntries((data || []).map((p) => [p.profile_id, p]));
  }
  return cache;
}

export async function myFollows(userId) {
  const { data } = await supabase.from('follows').select('contributor_id').eq('user_id', userId);
  return new Set((data || []).map((r) => r.contributor_id));
}

export async function setFollow(userId, partnerId, on) {
  if (on) await supabase.from('follows').upsert({ user_id: userId, contributor_id: partnerId }, { onConflict: 'user_id,contributor_id', ignoreDuplicates: true });
  else await supabase.from('follows').delete().eq('user_id', userId).eq('contributor_id', partnerId);
}
