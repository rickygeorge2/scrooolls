const base = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const Back = ({ c = '#15171C' }) => <svg width="24" height="24" viewBox="0 0 24 24" stroke={c} {...base}><path d="M15 18l-6-6 6-6" /></svg>;
export const Chevron = ({ c = '#15171C' }) => <svg width="20" height="20" viewBox="0 0 24 24" stroke={c} {...base}><path d="M9 18l6-6-6-6" /></svg>;
export const Up = ({ c = '#15171C' }) => <svg width="18" height="18" viewBox="0 0 24 24" stroke={c} {...base}><path d="M18 15l-6-6-6 6" /></svg>;
export const Down = ({ c = '#15171C' }) => <svg width="18" height="18" viewBox="0 0 24 24" stroke={c} {...base}><path d="M6 9l6 6 6-6" /></svg>;
export const Bell = ({ c = '#FFC93C' }) => <svg width="20" height="20" viewBox="0 0 24 24" stroke={c} {...base}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
export const Download = ({ c = '#FFC93C' }) => <svg width="20" height="20" viewBox="0 0 24 24" stroke={c} {...base}><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>;
export const Check = ({ c = '#15171C' }) => <svg width="30" height="30" viewBox="0 0 24 24" stroke={c} {...base} strokeWidth="2.4"><path d="M20 6L9 17l-5-5" /></svg>;
export const Logo = ({ size = 40 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.3, background: '#15171C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" stroke="#FFC93C" {...base} strokeWidth="2.2"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
  </div>
);
