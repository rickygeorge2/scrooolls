import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabaseAdmin';
import { notifyStory, sendToSubscriptions } from '@/lib/push';
import plan from '@/public/journey/plan.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function localParts(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
  } catch {
    return null;
  }
}

// Runs every hour (set up in supabase/cron.sql).
export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  if (!process.env.CRON_SECRET || auth !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  }
  const db = adminClient();
  const report = { published: 0, storyPushes: 0, morning: 0 };

  // 1. Publish scheduled stories whose time has come, then notify everyone.
  const { data: due } = await db.from('stories').select('id').eq('status', 'scheduled').lte('scheduled_for', new Date().toISOString());
  for (const s of due || []) {
    await db.from('stories').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', s.id);
    report.published += 1;
    const r = await notifyStory(s.id);
    report.storyPushes += r.sent || 0;
  }

  // 2. Morning notification at each reader's chosen hour, once per day.
  const { data: subs } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, profiles(first_hour, timezone, last_morning_push)');
  const byUser = new Map();
  for (const s of subs || []) {
    const p = s.profiles;
    if (!p) continue;
    const now = localParts(p.timezone || 'Asia/Kolkata');
    if (!now || now.hour !== p.first_hour || p.last_morning_push === now.date) continue;
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, { date: now.date, subs: [] });
    byUser.get(s.user_id).subs.push(s);
  }
  if (byUser.size) {
    const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data: latest } = await db.from('stories').select('title').eq('status', 'published').gte('published_at', since)
      .order('published_at', { ascending: false }).limit(1);
    const payload = {
      title: 'Good morning from Scrooolls',
      body: latest && latest[0] ? 'Start your day with: ' + latest[0].title : 'Start your day in the Word. Your stories are waiting.',
      url: '/', tag: 'morning',
    };
    for (const [userId, u] of byUser) {
      report.morning += await sendToSubscriptions(u.subs, payload);
      await db.from('profiles').update({ last_morning_push: u.date }).eq('id', userId);
    }
    await db.from('push_log').insert({ kind: 'morning', title: payload.title, body: payload.body, sent_count: report.morning });
  }

  // 3. "Read the Gospels in 100 days" reminders, at each reader's chosen hour, if today's reading isn't done.
  report.journey = 0;
  const { data: journeys } = await db.from('journeys').select('user_id, reminder_hour, current_day, completed_on, last_reminder_on, finished_at, profiles(timezone)').is('finished_at', null);
  for (const j of journeys || []) {
    const now = localParts(j.profiles?.timezone || 'Asia/Kolkata');
    if (!now || now.hour !== j.reminder_hour || j.completed_on === now.date || j.last_reminder_on === now.date) continue;
    const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', j.user_id);
    await db.from('journeys').update({ last_reminder_on: now.date }).eq('user_id', j.user_id);
    if (!subs || !subs.length) continue;
    const day = plan.days[j.current_day - 1];
    report.journey += await sendToSubscriptions(subs, {
      title: `Day ${j.current_day} of 100 is ready`,
      body: day ? `${day.label} · ${day.count} scrolls. Keep your streak going!` : 'Your Gospel reading is ready.',
      url: '/journey', tag: 'journey',
    });
  }

  return NextResponse.json(report);
}
