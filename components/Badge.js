// A round medal for the 100-day journey. Greyed out until earned.
export default function Badge({ badge, earned, size = 72 }) {
  const fill = earned ? badge.color : '#ECE9E1';
  const ink = earned ? badge.ink : '#9A9DA6';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: size + 16, textAlign: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 72 72" role="img" aria-label={`${badge.name}: ${badge.note}${earned ? ', earned' : ', not earned yet'}`}>
        <path d="M24 4 L36 14 L48 4 L48 22 L24 22 Z" fill={earned ? ink : '#D6D3CA'} opacity={earned ? 0.85 : 1} />
        <circle cx="36" cy="42" r="26" fill={fill} stroke={earned ? ink : '#D6D3CA'} strokeWidth="3" />
        <circle cx="36" cy="42" r="19" fill="none" stroke={ink} strokeWidth="1.5" strokeDasharray="2 3" opacity="0.6" />
        <text x="36" y="48" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize={badge.days === 100 ? 17 : 19} fill={ink}>{badge.days}</text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, color: earned ? 'var(--ink)' : 'var(--soft)' }}>{badge.name}</div>
    </div>
  );
}
