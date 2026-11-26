'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { authHeader } from '@/lib/useAuth';
import { mapRows, parseCSV, parseDate, parseTime, toMoment, wordCount } from '@/lib/bulk';

const fmt = (d) => d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const byName = (list, name) => list.find((x) => x.name.trim().toLowerCase() === (name || '').trim().toLowerCase());

// Works out what's wrong (blocks upload) and what's worth a look (warnings) for one row.
function check(row) {
  const errors = [], warnings = [];
  if (!row.title.trim()) errors.push('Title is missing');
  if (!row.summary.trim()) errors.push('Summary is missing');
  if (row.date && !parseDate(row.date)) errors.push(`Can’t read the date “${row.date}”. Use 27/11/2026`);
  if (row.time && !parseTime(row.time)) errors.push(`Can’t read the time “${row.time}”. Use 7:00 PM`);
  if (row.link && !/^https?:\/\//i.test(row.link)) errors.push('Read-more link must start with https://');
  if (row.image && !row.file && !/^https:\/\//i.test(row.image)) errors.push('Image link must start with https://');
  if (wordCount(row.summary) > 60) warnings.push(`Summary is ${wordCount(row.summary)} words (aim for 60)`);
  if (row.theme && !row.theme_id) warnings.push(`No theme called “${row.theme}”. Pick one or leave blank`);
  if (row.genre && !row.genre_id) warnings.push(`No genre called “${row.genre}”. Pick one or leave blank`);
  return { errors, warnings };
}

export default function BulkUpload({ profile, isAdmin, themes, genres, notify, onDone, flash }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  function when(row) {
    if (!row.date) return null;
    return toMoment(row.date, row.time);
  }

  async function readFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setProblem(''); setRows([]);
    if (!/\.csv$/i.test(file.name)) { setProblem('Please upload a .csv file. In Google Sheets: File → Download → Comma-separated values (.csv).'); return; }
    const { items, error } = mapRows(parseCSV(await file.text()));
    if (error) { setProblem(error); return; }
    if (!items.length) { setProblem('No stories found in the file. Add one story per row under the header row.'); return; }
    if (items.length > 50) { setProblem('That’s more than 50 stories. Please split it into smaller files.'); return; }
    setFileName(file.name);
    setRows(items.map((x, i) => ({
      ...x, key: i, file: null, preview: '', state: 'ready', message: '',
      theme_id: byName(themes, x.theme)?.id || '', genre_id: byName(genres, x.genre)?.id || '',
    })));
  }

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key) => setRows((rs) => rs.filter((r) => r.key !== key));

  async function uploadImage(row) {
    if (row.file) {
      const path = `${profile.id}/${Date.now()}-${row.file.name.replace(/[^a-zA-Z0-9.]+/g, '-')}`;
      const up = await supabase.storage.from('story-images').upload(path, row.file, { contentType: row.file.type });
      if (up.error) throw new Error('Image upload failed: ' + up.error.message);
      return supabase.storage.from('story-images').getPublicUrl(path).data.publicUrl;
    }
    if (row.image) {
      const res = await fetch('/api/stories/import-image', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ url: row.image }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Couldn’t copy the image');
      return out.url;
    }
    return null;
  }

  async function uploadAll() {
    const todo = rows.filter((r) => r.state !== 'done' && check(r).errors.length === 0);
    if (!todo.length) return flash('Nothing to upload. Fix the rows marked in red first.');
    setBusy(true);
    let ok = 0, failed = 0, pushed = 0;
    for (const row of todo) {
      update(row.key, { state: 'working', message: 'Uploading…' });
      try {
        const at = when(row);
        const future = at && at > new Date();
        const status = isAdmin ? (future ? 'scheduled' : 'published') : 'pending';
        const image_url = await uploadImage(row);
        const { data, error } = await supabase.from('stories').insert({
          title: row.title.trim(), summary: row.summary.trim(), link: row.link.trim() || null, image_url,
          theme_id: row.theme_id ? Number(row.theme_id) : null, genre_id: row.genre_id ? Number(row.genre_id) : null,
          author_id: profile.id, status, scheduled_for: at ? at.toISOString() : null,
        }).select().single();
        if (error) throw error;
        if (status === 'published') { await notify(data.id); pushed += 1; }
        ok += 1;
        update(row.key, { state: 'done', message: status === 'published' ? 'Published' : status === 'scheduled' ? 'Scheduled for ' + fmt(at) : 'Sent for review' });
      } catch (e) {
        failed += 1;
        update(row.key, { state: 'failed', message: e.message || 'Something went wrong' });
      }
    }
    setBusy(false);
    flash(`${ok} stor${ok === 1 ? 'y' : 'ies'} uploaded` + (pushed ? ` · ${pushed} published now with notifications` : '') + (failed ? ` · ${failed} failed (see the red rows)` : ''));
    onDone();
  }

  const counts = rows.reduce((a, r) => {
    const c = check(r);
    if (r.state === 'done') a.done++; else if (c.errors.length) a.bad++; else a.ready++;
    return a;
  }, { ready: 0, bad: 0, done: 0 });

  return (
    <>
      <div>
        <h1 className="title">Bulk upload</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 760 }}>Add many stories at once from a spreadsheet. Nothing is saved until you check the preview and click Upload.</p>
      </div>

      <div className="split">
        <div className="main card stack" style={{ padding: 24, gap: 14 }}>
          <h2 style={{ fontSize: 18 }}>1. Get the template</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>Download it, then in Google Sheets go to <strong>File → Import → Upload</strong>. It also opens in Excel. Put one story per row and delete the example row.</p>
          <a className="btn small outline" href="/scrooolls-template.csv" download style={{ alignSelf: 'flex-start' }}>Download template</a>
          <h2 style={{ fontSize: 18, marginTop: 8 }}>2. Upload your stories</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>In Google Sheets, go to <strong>File → Download → Comma-separated values (.csv)</strong>, then choose that file here.</p>
          <label className="btn small" style={{ alignSelf: 'flex-start', cursor: busy ? 'default' : 'pointer' }}>
            Choose .csv file
            <input type="file" accept=".csv,text/csv" onChange={readFile} disabled={busy} className="sr-only" />
          </label>
          {problem && <p className="error" role="alert">{problem}</p>}
        </div>
        <div className="side card stack" style={{ padding: 20, gap: 8, fontSize: 13, lineHeight: 1.55 }}>
          <strong style={{ fontSize: 14 }}>Filling in the sheet</strong>
          <div><strong>Theme, Genre:</strong> use names from Themes &amp; genres, e.g. Hope, Devotional.</div>
          <div><strong>Publish date:</strong> 27/11/2026 (day first). Leave blank to publish right away{isAdmin ? '' : ' once approved'}.</div>
          <div><strong>Publish time:</strong> 7:00 PM or 19:00, in your time zone. Stories go live on the hour.</div>
          <div><strong>Image link:</strong> a link to the picture. For Google Drive, set sharing to “Anyone with the link”. You can also pick images in the preview instead.</div>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20 }}>3. Check and upload</h2>
              <p className="small muted" style={{ marginTop: 4 }}>{fileName}: {counts.ready} ready · {counts.bad} need fixing · {counts.done} uploaded</p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn small outline" disabled={busy} onClick={() => { setRows([]); setFileName(''); }}>Clear</button>
              <button className="btn small" disabled={busy || counts.ready === 0} onClick={uploadAll}>
                {busy ? 'Uploading…' : `Upload ${counts.ready} stor${counts.ready === 1 ? 'y' : 'ies'}`}
              </button>
            </div>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            {rows.map((r, i) => {
              const c = check(r);
              const at = when(r);
              const timing = !r.date ? (isAdmin ? 'Publishes right away' : 'Goes live when approved')
                : !at ? '—' : at <= new Date() ? (isAdmin ? 'Date has passed: publishes right away' : 'Date has passed: goes live when approved')
                : (isAdmin ? 'Scheduled for ' : 'Requested for ') + fmt(at);
              const border = r.state === 'done' ? 'var(--ok)' : r.state === 'failed' || c.errors.length ? 'var(--bad)' : 'var(--line)';
              const thumb = r.preview || (r.image && /^https:\/\//i.test(r.image) && !/drive\.google|dropbox/.test(r.image) ? r.image : '');
              return (
                <div key={r.key} className="card" style={{ borderColor: border, display: 'flex', gap: 16, flexWrap: 'wrap', opacity: r.state === 'done' ? 0.7 : 1 }}>
                  <div style={{ width: 120, height: 90, borderRadius: 10, background: themes.find((t) => String(t.id) === String(r.theme_id))?.color || '#F1EFEA', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#3A3E4A', textAlign: 'center', padding: 4 }}>
                    {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : r.image ? 'Image from link' : 'No image'}
                  </div>
                  <div className="stack grow" style={{ gap: 8, minWidth: 260, flexBasis: 360 }}>
                    <label className="sr-only" htmlFor={'t' + r.key}>Title, row {i + 1}</label>
                    <input id={'t' + r.key} value={r.title} disabled={r.state === 'done' || busy} onChange={(e) => update(r.key, { title: e.target.value })}
                      style={{ fontWeight: 700, fontSize: 15, border: '1px solid transparent', borderRadius: 8, padding: '4px 6px', marginLeft: -6, background: 'transparent' }} />
                    <label className="sr-only" htmlFor={'s' + r.key}>Summary, row {i + 1}</label>
                    <textarea id={'s' + r.key} rows={3} value={r.summary} disabled={r.state === 'done' || busy} onChange={(e) => update(r.key, { summary: e.target.value })}
                      style={{ fontSize: 14, lineHeight: 1.5, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', resize: 'vertical' }} />
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <select aria-label={'Theme, row ' + (i + 1)} value={r.theme_id} disabled={r.state === 'done' || busy} onChange={(e) => update(r.key, { theme_id: e.target.value })} style={{ height: 36, borderRadius: 8, border: '1px solid #D6D3CA', padding: '0 8px', background: '#fff' }}>
                        <option value="">Theme…</option>{themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <select aria-label={'Genre, row ' + (i + 1)} value={r.genre_id} disabled={r.state === 'done' || busy} onChange={(e) => update(r.key, { genre_id: e.target.value })} style={{ height: 36, borderRadius: 8, border: '1px solid #D6D3CA', padding: '0 8px', background: '#fff' }}>
                        <option value="">Genre…</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      {r.state !== 'done' && (
                        <label className="btn small outline" style={{ height: 36, cursor: 'pointer' }}>
                          {r.file ? 'Change image' : r.image ? 'Use a file instead' : 'Add image'}
                          <input type="file" accept="image/*" className="sr-only" disabled={busy}
                            onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) update(r.key, { file: f, preview: URL.createObjectURL(f) }); }} />
                        </label>
                      )}
                    </div>
                    <div className="small" style={{ color: 'var(--soft)' }}>{timing}{r.link ? ' · has read-more link' : ''}</div>
                    {r.state !== 'done' && c.errors.map((m) => <div key={m} className="small" style={{ color: 'var(--bad)', fontWeight: 600 }}>{m}</div>)}
                    {r.state !== 'done' && c.warnings.map((m) => <div key={m} className="small" style={{ color: 'var(--warn)' }}>{m}</div>)}
                    {r.message && <div className="small" style={{ fontWeight: 600, color: r.state === 'failed' ? 'var(--bad)' : r.state === 'done' ? 'var(--ok)' : 'var(--soft)' }}>{r.message}</div>}
                  </div>
                  {r.state !== 'done' && !busy && (
                    <button className="btn small ghost" style={{ alignSelf: 'flex-start' }} onClick={() => remove(r.key)} aria-label={'Remove row ' + (i + 1)}>Remove</button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
