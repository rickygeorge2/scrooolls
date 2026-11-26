import webpush from 'web-push';
import { adminClient } from './supabaseAdmin';

let ready = false;
function setup() {
  if (ready) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('Push keys (VAPID) are missing');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  ready = true;
}

// Sends one payload to a list of subscription rows. Removes subscriptions that no longer work.
export async function sendToSubscriptions(subs, payload) {
  setup();
  const db = adminClient();
  const body = JSON.stringify(payload);
  let sent = 0;
  const dead = [];
  for (let i = 0; i < subs.length; i += 50) {
    const batch = subs.slice(i, i + 50);
    const results = await Promise.allSettled(
      batch.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 12 }))
    );
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') sent += 1;
      else if (r.reason && (r.reason.statusCode === 404 || r.reason.statusCode === 410)) dead.push(batch[j].id);
    });
  }
  if (dead.length) await db.from('push_subscriptions').delete().in('id', dead);
  return sent;
}

export async function allSubscriptions() {
  const db = adminClient();
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// Sends the "new story" notification to everyone, once per story.
export async function notifyStory(storyId) {
  const db = adminClient();
  const { data: story } = await db.from('stories').select('id, title, summary, status, notified_at').eq('id', storyId).single();
  if (!story || story.status !== 'published' || story.notified_at) return { skipped: true, sent: 0 };
  // Claim the story first so two calls can't both send.
  const { data: claimed } = await db.from('stories').update({ notified_at: new Date().toISOString() })
    .eq('id', storyId).is('notified_at', null).select('id');
  if (!claimed || !claimed.length) return { skipped: true, sent: 0 };
  const summary = story.summary.length > 110 ? story.summary.slice(0, 107).trimEnd() + '…' : story.summary;
  const sent = await sendToSubscriptions(await allSubscriptions(), {
    title: story.title, body: summary, url: '/?story=' + story.id, tag: 'story-' + story.id,
  });
  await db.from('push_log').insert({ kind: 'story', title: story.title, body: summary, story_id: story.id, sent_count: sent });
  return { skipped: false, sent };
}
