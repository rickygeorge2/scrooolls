'use client';
import { socialUrl } from '@/lib/partners';

const ic = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const ICONS = {
  instagram: (c) => <svg width="18" height="18" viewBox="0 0 24 24" stroke={c} {...ic}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill={c} /></svg>,
  youtube: (c) => <svg width="18" height="18" viewBox="0 0 24 24" stroke={c} {...ic}><rect x="2.5" y="5" width="19" height="14" rx="4" /><path d="M10 9.5l5 2.5-5 2.5z" fill={c} /></svg>,
  linkedin: (c) => <svg width="18" height="18" viewBox="0 0 24 24" stroke={c} {...ic}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" /></svg>,
  website: (c) => <svg width="18" height="18" viewBox="0 0 24 24" stroke={c} {...ic}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>,
};
const LABELS = { instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn', website: 'Website' };

export function initials(name) {
  return (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function PartnerLogo({ partner, size = 88 }) {
  return partner.logo_url ? (
    <img src={partner.logo_url} alt={partner.name + ' logo'} style={{ width: size, height: size, borderRadius: size * 0.22, objectFit: 'cover', background: '#fff', flexShrink: 0 }} />
  ) : (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: size * 0.22, background: partner.text_color, color: partner.bg_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontWeight: 700, fontSize: size * 0.36, flexShrink: 0 }}>
      {initials(partner.name)}
    </div>
  );
}

// The branded top of a partner's page: logo, name, one-line bio, Follow and their links.
export default function PartnerHeader({ partner, followers, following, onFollow, busy }) {
  const bg = partner.bg_color, fg = partner.text_color;
  const links = ['instagram', 'youtube', 'linkedin', 'website'].filter((k) => (partner[k] || '').trim());
  return (
    <section style={{ background: bg, color: fg, padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
      <PartnerLogo partner={partner} />
      <div>
        <h1 style={{ fontSize: 28, color: fg }}>{partner.name}</h1>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.75, marginTop: 4 }}>Scrooolls partner</div>
      </div>
      {partner.bio && <p style={{ fontSize: 16, lineHeight: 1.45, maxWidth: 420, color: fg }}>{partner.bio}</p>}
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        {onFollow && (
          <button onClick={onFollow} disabled={busy} aria-pressed={!!following}
            style={{ height: 44, padding: '0 26px', borderRadius: 999, fontWeight: 700, fontSize: 15, cursor: 'pointer',
              background: following ? 'transparent' : fg, color: following ? fg : bg, border: `2px solid ${fg}` }}>
            {following ? 'Following' : 'Follow'}
          </button>
        )}
        {typeof followers === 'number' && <span style={{ fontSize: 14, opacity: 0.8 }}>{followers} follower{followers === 1 ? '' : 's'}</span>}
      </div>
      {links.length > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {links.map((k) => (
            <a key={k} href={socialUrl(k, partner[k])} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', borderRadius: 999, border: `1.5px solid ${fg}`, color: fg, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
              {ICONS[k](fg)} {LABELS[k]}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
