// Start of a local calendar day, `daysAgo` days back (0 = today).
export function dayStart(daysAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

export function daysAgoOf(date) {
  const a = dayStart(0).getTime();
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((a - d.getTime()) / 86400000);
}

export function dayName(daysAgo) {
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return dayStart(daysAgo).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}
