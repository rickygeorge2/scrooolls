import re, json, sys
src = open(sys.argv[1], encoding='utf-8').read()
books = [('MAT', 'Matthew'), ('MRK', 'Mark'), ('LUK', 'Luke'), ('JHN', 'John')]
out = []
for code, name in books:
    m = re.search(r'<book id="%s">(.*?)</book>' % code, src, re.S)
    body = m.group(1)
    body = re.sub(r'<f\b.*?</f>', '', body, flags=re.S)       # footnotes
    body = re.sub(r'<x\b.*?</x>', '', body, flags=re.S)       # cross references
    body = re.sub(r'<(h|toc|id|ide)\b.*?</\1>', '', body, flags=re.S)
    body = re.sub(r'<p sfm="(mt|ms|s|d)[^"]*"[^>]*>.*?</p>', '', body, flags=re.S)  # titles/headings
    chapter = 0
    for tok in re.split(r'(<c id="\d+"/>|<v id="[^"]+"/>)', body):
        cm = re.match(r'<c id="(\d+)"/>', tok)
        vm = re.match(r'<v id="([^"]+)"/>', tok)
        if cm: chapter = int(cm.group(1)); continue
        if vm: cur = vm.group(1); continue
        if chapter and 'cur' in dir():
            pass
    # second pass, simpler: iterate tokens with state
    chapter = 0; verse = None; buf = []
    def flush():
        if verse is not None:
            text = re.sub(r'<[^>]+>', ' ', ''.join(buf))
            text = re.sub(r'\s+', ' ', text).strip()
            if text:
                out.append({'book': name, 'chapter': chapter, 'verse': verse, 'text': text})
    for tok in re.split(r'(<c id="\d+"/>|<v id="[^"]+"/>|<ve/>)', body):
        cm = re.match(r'<c id="(\d+)"/>', tok)
        vm = re.match(r'<v id="([^"]+)"/>', tok)
        if cm:
            flush(); verse = None; buf = []; chapter = int(cm.group(1))
        elif vm:
            flush(); buf = []; verse = vm.group(1)
        elif tok == '<ve/>':
            flush(); verse = None; buf = []
        elif verse is not None:
            buf.append(tok)
    flush()
for i, v in enumerate(out): v['seq'] = i + 1
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
from collections import Counter
print(len(out), Counter((v['book']) for v in out))
print(out[0]); print(out[22]); print([v for v in out if v['book']=='John' and v['chapter']==3 and v['verse']=='16'])
print('non-numeric verse ids:', [v['verse'] for v in out if not v['verse'].isdigit()][:10])
