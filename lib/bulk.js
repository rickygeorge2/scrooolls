// Helpers for the Bulk upload page: reading the CSV and understanding dates and times.

// Reads CSV text (as saved by Google Sheets or Excel) into rows of cells.
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const HEADERS = {
  title: ['title'],
  summary: ['summary'],
  link: ['read-more link', 'read more link', 'link', 'url'],
  verse: ['bible verse', 'verse', 'bible reference', 'scripture'],
  theme: ['theme'],
  genre: ['genre'],
  date: ['publish date', 'date'],
  time: ['publish time', 'time'],
  image: ['image link', 'image', 'image url'],
};

// Matches the spreadsheet's header row to the fields we need.
export function mapRows(rows) {
  if (!rows.length) return { error: 'The file is empty.' };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [key, names] of Object.entries(HEADERS)) col[key] = head.findIndex((h) => names.includes(h));
  if (col.title < 0 || col.summary < 0) return { error: 'Couldn’t find the “Title” and “Summary” columns. Please start from the Scrooolls template.' };
  const get = (r, k) => (col[k] >= 0 ? (r[col[k]] || '').trim() : '');
  const items = rows.slice(1)
    .map((r) => ({ title: get(r, 'title'), summary: get(r, 'summary'), link: get(r, 'link'), verse: get(r, 'verse'), theme: get(r, 'theme'), genre: get(r, 'genre'), date: get(r, 'date'), time: get(r, 'time'), image: get(r, 'image') }))
    .filter((x) => !/^example\b/i.test(x.title));
  return { items };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Understands 2026-11-27, 27/11/2026 (day first), 27-11-2026, 27 Nov 2026, Nov 27 2026.
export function parseDate(s) {
  if (!s) return null;
  s = s.trim();
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return [+m[1], +m[2], +m[3]];
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return [y, +m[2], +m[1]];
  }
  if ((m = s.match(/^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})$/i))) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mo >= 0) return [+m[3], mo + 1, +m[1]];
  }
  if ((m = s.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i))) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mo >= 0) return [+m[3], mo + 1, +m[2]];
  }
  return null;
}

// Understands 19:00, 7:00 PM, 7pm, 7.30 am.
export function parseTime(s) {
  if (!s) return [7, 0];
  const m = s.trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = +(m[2] || 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return [h, min];
}

// Combines date + time (in this computer's time zone) into one moment, or null.
export function toMoment(date, time) {
  const d = parseDate(date);
  const t = parseTime(time);
  if (!d || !t) return null;
  const when = new Date(d[0], d[1] - 1, d[2], t[0], t[1]);
  if (when.getMonth() !== d[1] - 1) return null; // e.g. 31/02
  return when;
}

export const wordCount = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
