// "Read the Gospels in 100 days": badge details and small helpers.
export const TOTAL_DAYS = 100;

export const BADGES = [
  { days: 10, name: 'First Steps', note: '10 days of reading', color: '#A8D5B0', ink: '#1F6A42' },
  { days: 25, name: 'Faithful Walker', note: '25 days of reading', color: '#9CC8EE', ink: '#24508F' },
  { days: 50, name: 'Halfway There', note: '50 days of reading', color: '#FFD666', ink: '#7A5600' },
  { days: 75, name: 'Steadfast', note: '75 days of reading', color: '#F4A7BB', ink: '#8A2847' },
  { days: 100, name: 'Gospel Finisher', note: 'All four Gospels in 100 days', color: '#FFC93C', ink: '#15171C' },
];

export const REMINDER_HOURS = [5, 6, 7, 8, 9, 12, 18, 20, 21, 22];

export function hourLabel(h) {
  if (h === 0) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  return (h > 12 ? h - 12 : h) + ':00 ' + (h >= 12 ? 'PM' : 'AM');
}

let planCache = null;
export async function loadPlan() {
  if (!planCache) planCache = await fetch('/journey/plan.json').then((r) => r.json());
  return planCache;
}
export async function loadDay(day) {
  return fetch(`/journey/day-${day}.json`).then((r) => r.json());
}
