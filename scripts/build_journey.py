"""Builds the "Read the Gospels in 100 days" reading files in public/journey/.

Usage:
  python3 scripts/build_journey.py                 # even split of the four Gospels over 100 days
  python3 scripts/build_journey.py plan.csv        # custom plan: one line per day, e.g.  1,Matthew 1:1-2:23
                                                   # (a day can list several ranges separated by ';')
Verse text: World English Bible (public domain), from scripts/gospels-web.json.
"""
import csv, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'journey')
verses = json.load(open(os.path.join(HERE, 'gospels-web.json'), encoding='utf-8'))
index = {(v['book'], v['chapter'], int(v['verse'])): v['seq'] for v in verses}
by_seq = {v['seq']: v for v in verses}
BOOKS = {'matthew': 'Matthew', 'matt': 'Matthew', 'mt': 'Matthew', 'mark': 'Mark', 'mk': 'Mark',
         'luke': 'Luke', 'lk': 'Luke', 'john': 'John', 'jn': 'John'}

def ref(v):
    return f"{v['book']} {v['chapter']}:{v['verse']}"

def label(a, b):
    va, vb = by_seq[a], by_seq[b]
    if va['book'] != vb['book']:
        return f"{ref(va)} – {ref(vb)}"
    if va['chapter'] != vb['chapter']:
        return f"{va['book']} {va['chapter']}:{va['verse']} – {vb['chapter']}:{vb['verse']}"
    return f"{va['book']} {va['chapter']}:{va['verse']}–{vb['verse']}"

def last_verse(book, chapter):
    return max(int(v['verse']) for v in verses if v['book'] == book and v['chapter'] == chapter)

def parse_range(text):
    """'Matthew 1:1-2:23', 'Mark 3', 'Luke 4:1-13' -> list of seqs."""
    m = re.match(r'^\s*([1-3]?\s*[A-Za-z]+)\.?\s+(\d+)(?::(\d+))?\s*(?:[-–]\s*(?:(\d+):)?(\d+))?\s*$', text)
    if not m:
        raise ValueError(f'Cannot read reference: {text!r}')
    book = BOOKS.get(m.group(1).lower().replace(' ', ''))
    if not book:
        raise ValueError(f'Only the four Gospels are supported: {text!r}')
    c1 = int(m.group(2)); v1 = int(m.group(3) or 1)
    if m.group(5) is None:                      # "Mark 3" or "Mark 3:5"
        c2, v2 = c1, (v1 if m.group(3) else last_verse(book, c1))
    elif m.group(4):                            # "1:1-2:23"
        c2, v2 = int(m.group(4)), int(m.group(5))
    elif m.group(3):                            # "4:1-13"
        c2, v2 = c1, int(m.group(5))
    else:                                       # "3-5" (chapters)
        c2 = int(m.group(5)); v2 = last_verse(book, c2)
    start = index[(book, c1, v1)]
    end = index.get((book, c2, v2))
    while end is None and v2 > 0:               # verse missing in WEB (e.g. Luke 17:36)
        v2 -= 1; end = index.get((book, c2, v2))
    return list(range(start, end + 1))

def even_plan(days=100):
    n = len(verses); plan = []
    for d in range(days):
        a = round(d * n / days) + 1; b = round((d + 1) * n / days)
        plan.append(list(range(a, b + 1)))
    return plan

def csv_plan(path):
    plan = []
    for row in csv.reader(open(path, encoding='utf-8-sig')):
        if not row or not row[0].strip().isdigit():
            continue
        seqs = []
        for part in ';'.join(row[1:]).split(';'):
            if part.strip():
                seqs += parse_range(part)
        plan.append(seqs)
    return plan

plan = csv_plan(sys.argv[1]) if len(sys.argv) > 1 else even_plan()
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
summary = []
for i, seqs in enumerate(plan, start=1):
    items = [{'ref': ref(by_seq[s]), 'text': by_seq[s]['text']} for s in seqs]
    lab = label(seqs[0], seqs[-1])
    json.dump({'day': i, 'label': lab, 'verses': items}, open(os.path.join(OUT, f'day-{i}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    summary.append({'day': i, 'label': lab, 'count': len(items)})
json.dump({'translation': 'World English Bible', 'days': summary}, open(os.path.join(OUT, 'plan.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(f'{len(plan)} days, {sum(s["count"] for s in summary)} verses; day 1 = {summary[0]["label"]} ({summary[0]["count"]}), day {len(plan)} = {summary[-1]["label"]} ({summary[-1]["count"]})')
