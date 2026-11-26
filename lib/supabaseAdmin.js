import { createClient } from '@supabase/supabase-js';

// Server-only client with full access. Never import this into a page.
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server keys are missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Works out who is calling an API route from the "Authorization: Bearer <token>" header.
export async function getCaller(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await db.from('profiles').select('id, role, name, email').eq('id', data.user.id).single();
  return profile || null;
}
