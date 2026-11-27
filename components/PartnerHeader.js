'use client';
import { contrast, socialUrl } from '@/lib/partners';

const ic = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const ICONS = {
  instagram: (c) => <svg width="18" height="18" viewBox="0 0 24 24" stroke={c} {...ic}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill={c} /></svg>,
  youtube: (c) => <svg width="18" height="18" viewBox="0 0 24 24" stroke={c} {...ic}><rect x="2.5" y="5" width="19" height="14" rx="4" /><path d="M10 9.5l5 2.5-5 2.5z" fill={c} /></svg>,
  linkedin: (c) => <svg width="18" height="18" viewBox="0 0 24 24" stroke={c} {...ic}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" /></svg>,
};
const LABELS = { instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn' };
const STAT_ICONS = {
  posts: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3" fill="#15171C" /><path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  followers: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="#15171C" /><path d="M4 21a8 8 0 0 1 16 0z" fill="#15171C" /></svg>,
  reads: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="#15171C" /><circle cx="12" cy="12" r="3" fill="#fff" /></svg>,
};

export function initials(name) {
  return (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function compact(n) {
  n = Number(n || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function PartnerLogo({ partner, size = 88, ring = false }) {
  const style = { width: size, height: size, borderRadius: 999, flexShrink: 0, boxShadow: ring ? '0 0 0 5px #fff' : 'none' };
  return partner.logo_url ? (
    <img src={partner.logo_url} alt={partner.name + ' logo'} style={{ ...style, objectFit: 'cover', background: '#fff' }} />
  ) : (
    <div aria-hidden="true" style={{ ...style, background: partner.bg_color, color: partner.text_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontWeight: 700, fontSize: size * 0.34 }}>
      {initials(partner.name)}
    </div>
  );
}

// A partner's profile card: cover in their colour, logo, name and @handle, Follow, stats and a big website button.
export default function PartnerHeader({ partner, stats, following, onFollow, onShare, busy, topLeft }) {
  // Very light brand colours vanish on the white card, so buttons swap to the text colour then
  const light = contrast(partner.bg_color, '#FFFFFF') < 1.6;
  const bg = light ? partner.text_color : partner.bg_color, fg = light ? partner.bg_color : partner.text_color;
  const socials = ['instagram', 'youtube', 'linkedin'].filter((k) => (partner[k] || '').trim());
  const website = (partner.website || '').trim();
  return (
    <section style={{ background: '#fff', borderRadius: 28, padding: 14, boxShadow: '0 1px 2px rgba(21,23,28,0.06), 0 8px 24px rgba(21,23,28,0.06)' }}>
      {/* Cover */}
      <div style={{ position: 'relative', height: 150, borderRadius: 20, border: light ? '1px solid var(--line)' : 0,
        background: `radial-gradient(120% 140% at 85% 10%, rgba(255,255,255,0.28), rgba(255,255,255,0) 55%), ${partner.bg_color}` }}>
        {topLeft && <div style={{ position: 'absolute', top: 8, left: 8 }}>{topLeft}</div>}
        <div style={{ position: 'absolute', left: 18, bottom: -44 }}>
          <PartnerLogo partner={partner} size={96} ring />
        </div>
      </div>

      {/* Name, handle and actions */}
      <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, padding: '54px 6px 0', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 160px' }}>
          <h1 style={{ fontSize: 24, lineHeight: 1.15 }}>{partner.name}</h1>
          <div className="small" style={{ color: 'var(--soft)', marginTop: 2 }}>@{partner.slug}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {onFollow && (
            <button onClick={onFollow} disabled={busy} aria-pressed={!!following}
              style={{ height: 44, padding: '0 22px', borderRadius: 999, fontWeight: 700, fontSize: 15, cursor: 'pointer',
                background: following ? '#fff' : bg, color: following ? 'var(--ink)' : fg, border: following ? '1.5px solid var(--line)' : `1.5px solid ${bg}` }}>
              {following ? 'Following' : 'Follow'}
            </button>
          )}
          {onShare && (
            <button onClick={onShare} aria-label={'Share ' + partner.name}
              style={{ width: 44, height: 44, borderRadius: 999, border: '1.5px solid var(--line)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" stroke="#15171C" {...ic}><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
            </button>
          )}
        </div>
      </div>

      {partner.bio && <p style={{ fontSize: 15, lineHeight: 1.5, color: '#3A3E4A', padding: '10px 6px 0' }}>{partner.bio}</p>}

      {socials.length > 0 && (
        <div className="row" style={{ gap: 8, padding: '12px 6px 0' }}>
          {socials.map((k) => (
            <a key={k} href={socialUrl(k, partner[k])} target="_blank" rel="noopener noreferrer" aria-label={partner.name + ' on ' + LABELS[k]}
              style={{ width: 40, height: 40, borderRadius: 999, border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {ICONS[k]('#15171C')}
            </a>
          ))}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderTop: '1px solid var(--line)', margin: '16px 6px 0', padding: '16px 0 4px', textAlign: 'center' }}>
          {[['posts', 'Stories'], ['followers', 'Followers'], ['reads', 'Reads']].map(([k, l]) => (
            <div key={k}>
              <div className="row" style={{ gap: 8, justifyContent: 'center', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 24 }}>{STAT_ICONS[k]}{compact(stats[k])}</div>
              <div className="small" style={{ color: 'var(--soft)', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Website */}
      {website && (
        <a href={socialUrl('website', website)} target="_blank" rel="noopener noreferrer"
          style={{ marginTop: 16, height: 64, borderRadius: 999, background: `linear-gradient(90deg, ${bg} 55%, ${bg}cc)`, color: fg, textDecoration: 'none',
            display: 'flex', alignItems: 'center', padding: '0 8px', position: 'relative' }}>
          <span style={{ width: 48, height: 48, borderRadius: 999, background: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" stroke={bg} {...ic} strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
          <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontWeight: 600, fontSize: 17, pointerEvents: 'none' }}>Visit website</span>
        </a>
      )}
    </section>
  );
}
