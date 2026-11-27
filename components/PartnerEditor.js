'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { HEX, contrast, slugify } from '@/lib/partners';
import PartnerHeader, { PartnerLogo } from './PartnerHeader';

const LINKS = [['website', 'Website', 'yourorganization.org'], ['instagram', 'Instagram', '@yourhandle'], ['youtube', 'YouTube', 'youtube.com/@yourchannel'], ['linkedin', 'LinkedIn', 'linkedin.com/company/…']];

function ColorField({ label, value, onChange }) {
  const ok = HEX.test(value);
  return (
    <div className="field">
      <label htmlFor={'c-' + label}>{label} <span className="hint">hex code, e.g. #15171C</span></label>
      <div className="row" style={{ gap: 8 }}>
        <input type="color" aria-label={label + ' picker'} value={ok ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())}
          style={{ width: 54, height: 50, padding: 2, borderRadius: 999, border: '1.5px solid #D6D3CA', background: '#fff', flexShrink: 0 }} />
        <input id={'c-' + label} className="grow" value={value} maxLength={7} onChange={(e) => {
          let v = e.target.value.trim(); if (v && !v.startsWith('#')) v = '#' + v; onChange(v.toUpperCase());
        }} style={{ fontFamily: 'ui-monospace, monospace', borderColor: ok ? undefined : 'var(--bad)' }} />
      </div>
      {!ok && <span className="error" style={{ fontWeight: 500 }}>Use a 6-digit hex code like #1A2B3C</span>}
    </div>
  );
}

// Edit one partner's branded page. Used by the partner themselves and by admins.
export default function PartnerEditor({ profileId, flash, onSaved }) {
  const [p, setP] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from('partners').select('*').eq('profile_id', profileId).maybeSingle().then(({ data }) => setP(data || false));
  }, [profileId]);

  if (p === null) return <p className="muted">Loading…</p>;
  if (p === false) return <p className="muted">This account doesn’t have a partner page yet. An admin creates it when they approve the partner application.</p>;

  const set = (k) => (v) => setP({ ...p, [k]: typeof v === 'string' ? v : v.target.value });
  const ratio = contrast(p.bg_color, p.text_color);

  async function uploadLogo(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return flash('Logo must be under 3 MB.');
    setUploading(true);
    const path = `${profileId}/logo-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, '-')}`;
    const up = await supabase.storage.from('story-images').upload(path, file, { contentType: file.type });
    setUploading(false);
    if (up.error) return flash('Upload failed: ' + up.error.message);
    setP({ ...p, logo_url: supabase.storage.from('story-images').getPublicUrl(path).data.publicUrl });
  }

  async function save() {
    if (!p.name.trim()) return flash('Add your organization name.');
    if (!HEX.test(p.bg_color) || !HEX.test(p.text_color)) return flash('Fix the colour codes first.');
    const slug = slugify(p.slug);
    setSaving(true);
    const row = {
      name: p.name.trim(), slug, bio: (p.bio || '').trim().slice(0, 140) || null, logo_url: p.logo_url || null,
      bg_color: p.bg_color, text_color: p.text_color, updated_at: new Date().toISOString(),
      ...Object.fromEntries(LINKS.map(([k]) => [k, (p[k] || '').trim() || null])),
    };
    const { error } = await supabase.from('partners').update(row).eq('profile_id', profileId);
    setSaving(false);
    if (error) return flash(/duplicate|unique/i.test(error.message) ? 'That page address is taken. Try another.' : error.message);
    await supabase.from('profiles').update({ name: row.name }).eq('id', profileId);
    setP({ ...p, ...row });
    flash('Partner page saved');
    if (onSaved) onSaved();
  }

  return (
    <div className="split">
      <div className="main card stack" style={{ padding: 24, gap: 18 }}>
        <div className="row" style={{ gap: 14 }}>
          <PartnerLogo partner={p} size={72} />
          <div className="stack" style={{ gap: 6 }}>
            <label className="btn small outline" style={{ cursor: 'pointer' }}>
              {uploading ? 'Uploading…' : p.logo_url ? 'Change logo' : 'Upload logo'}
              <input type="file" accept="image/*" className="sr-only" onChange={uploadLogo} disabled={uploading} />
            </label>
            {p.logo_url && <button className="btn small ghost" onClick={() => setP({ ...p, logo_url: null })}>Remove logo</button>}
            <span className="small muted">Square images work best.</span>
          </div>
        </div>
        <label className="field">Organization name<input value={p.name} onChange={set('name')} maxLength={80} /></label>
        <label className="field">
          <span className="row between"><span>One-line bio</span><span className="hint">{(p.bio || '').length} / 140</span></span>
          <input value={p.bio || ''} onChange={set('bio')} maxLength={140} placeholder="e.g. Helping students in Pune follow Jesus every day" />
        </label>
        <label className="field">
          <span>Page address <span className="hint">scrooolls…/p/<strong>{slugify(p.slug)}</strong></span></span>
          <input value={p.slug} onChange={set('slug')} maxLength={40} />
        </label>
        <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
          <div className="grow" style={{ minWidth: 220 }}><ColorField label="Background colour" value={p.bg_color} onChange={set('bg_color')} /></div>
          <div className="grow" style={{ minWidth: 220 }}><ColorField label="Text colour" value={p.text_color} onChange={set('text_color')} /></div>
        </div>
        {HEX.test(p.bg_color) && HEX.test(p.text_color) && ratio < 4.5 && (
          <div className="card" style={{ background: 'var(--warn-bg)', border: 0, fontSize: 13 }}>
            These two colours are hard to read together (contrast {ratio.toFixed(1)}:1). Try a lighter text colour on a dark background, or the other way round.
          </div>
        )}
        <div className="stack" style={{ gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Links <span className="hint" style={{ fontWeight: 400 }}>· a button only shows when its link is filled in</span></div>
          {LINKS.map(([k, l, ph]) => <label key={k} className="field">{l}<input value={p[k] || ''} onChange={set(k)} placeholder={ph} /></label>)}
        </div>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save partner page'}</button>
      </div>
      <div className="side stack" style={{ gap: 10 }}>
        <div className="small" style={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--soft)' }}>Live preview</div>
        <div style={{ background: 'var(--ground)', borderRadius: 24, padding: 12, border: '1px solid var(--line)' }}>
          <PartnerHeader partner={{ ...p, bg_color: HEX.test(p.bg_color) ? p.bg_color : '#15171C', text_color: HEX.test(p.text_color) ? p.text_color : '#FFFFFF' }} stats={{ posts: 0, followers: 0, reads: 0 }} following={false} onFollow={() => {}} onShare={() => {}} />
          <div style={{ padding: '14px 6px 2px' }} className="small muted">Your stories appear below this card.</div>
        </div>
        <a className="btn small outline" href={'/p/' + slugify(p.slug)} target="_blank" rel="noopener noreferrer">Open the live page</a>
      </div>
    </div>
  );
}

// Admin: every partner, with the same editor for each.
export function PartnersAdmin({ flash }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => supabase.from('partners').select('profile_id, name, slug, logo_url, bg_color, text_color, bio').order('name').then(({ data }) => setList(data || []));
  useEffect(() => { load(); }, []);
  if (open) {
    return (
      <>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn small outline" onClick={() => { setOpen(null); load(); }}>← All partners</button>
        </div>
        <PartnerEditor profileId={open} flash={flash} />
      </>
    );
  }
  return (
    <>
      <div>
        <h1 className="title">Partners</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 720 }}>Organizations become partners when you approve their application. Partners can edit their own page from their dashboard; you can edit any of them here.</p>
      </div>
      {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="muted">No partners yet. Approve an organization partner application to add one.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {list.map((p) => (
            <button key={p.profile_id} className="card row" onClick={() => setOpen(p.profile_id)} style={{ gap: 12, textAlign: 'left', cursor: 'pointer', background: p.bg_color, color: p.text_color, border: 0 }}>
              <PartnerLogo partner={p} size={48} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{p.name}</span>
                <span style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>/p/{p.slug} · Edit</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
