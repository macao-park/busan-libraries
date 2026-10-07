#!/usr/bin/env python3
"""구글시트(CSV로 내보낸 파일)의 체크리스트를 data/extras.json 에 합칩니다.
usage: python3 scripts/import_sheet.py <sheet.csv> [--dry]
시트: 파일 > 다운로드 > 쉼표로 구분된 값(.csv)
- 'O' 표시된 시설만 facilities 로 들어갑니다. 시설이 하나도 없는 줄은 건너뜁니다.
- 확인일이 비어 있으면 오늘 날짜, 확인 방법/출처가 http 로 시작하면 source 로 저장합니다.
- 시트에 없는 도서관과 photos 등 기존 필드는 그대로 둡니다.
"""
import csv, json, re, sys, pathlib, datetime
root = pathlib.Path(__file__).resolve().parent.parent
tags = json.loads((root/'data/tags.json').read_text(encoding='utf-8'))
tag_names = [t for g in tags['groups'] for t in g['tags']]
src = next((a for a in sys.argv[1:] if not a.startswith('--')), None)
if not src:
    sys.exit(__doc__)
dry = '--dry' in sys.argv
rows = list(csv.reader(open(src, encoding='utf-8-sig')))
hi = next(i for i, r in enumerate(rows) if '도서관' in r and '구·군' in r)
col = {name: j for j, name in enumerate(rows[hi])}
miss = [t for t in tag_names if t not in col]
if miss:
    sys.exit('시트에 없는 태그 열: %s' % miss)
path = root/'data/extras.json'
data = json.loads(path.read_text(encoding='utf-8'))
ov = data.setdefault('overrides', {})
known = {l['name'] for l in json.loads((root/'data/libraries.json').read_text(encoding='utf-8'))}

def cell(r, name):
    j = col.get(name)
    return r[j].strip() if j is not None and j < len(r) else ''

def norm_date(s):
    m = re.search(r'(\d{4})\D+(\d{1,2})\D+(\d{1,2})', s)
    return '%s-%02d-%02d' % (m[1], int(m[2]), int(m[3])) if m else ''

n = 0
for r in rows[hi+1:]:
    name = cell(r, '도서관')
    if not name or cell(r, '구·군') == '예시':
        continue
    if name not in known:
        print('모르는 도서관 이름, 건너뜀:', name); continue
    fac = [t for t in tag_names if cell(r, t).upper() in ('O', 'ㅇ', 'V', 'TRUE', '1')]
    if not fac:
        continue
    e = ov.setdefault(name, {})
    e['facilities'] = fac
    hl = cell(r, '한 줄 특징')
    if hl: e['highlight'] = hl
    how = cell(r, '확인 방법/출처')
    if how.startswith('http'): e['source'] = how
    e['checked'] = norm_date(cell(r, '확인일')) or datetime.date.today().isoformat()
    n += 1
print('반영한 도서관: %d곳' % n)
if not dry:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
