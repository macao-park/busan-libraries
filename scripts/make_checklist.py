#!/usr/bin/env python3
"""공공도서관 부대시설 체크리스트 CSV 생성 (구글시트 업로드용).
usage: python3 scripts/make_checklist.py [out.csv]
"""
import csv, json, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
libs = json.loads((root/'data/libraries.json').read_text(encoding='utf-8'))
tags = json.loads((root/'data/tags.json').read_text(encoding='utf-8'))
extras = json.loads((root/'data/extras.json').read_text(encoding='utf-8')).get('overrides', {})
tag_names = [t if isinstance(t, str) else t['name'] for g in tags['groups'] for t in g['tags']]
rows = sorted([l for l in libs if l['type'] == '공공도서관'], key=lambda l: (l['district'], l['name']))
head = ['구·군', '도서관', '홈페이지'] + tag_names + ['한 줄 특징', '확인 방법/출처', '확인일', '메모']
out = []
out.append(['부산 공공도서관 부대시설 체크리스트'] + [''] * (len(head) - 1))
out.append(['작성법: 직접 확인한 시설만 칸에 O 를 적어요. 못 봤거나 모르면 비워두세요(없다는 뜻이 아니라 미확인).'] + [''] * (len(head) - 1))
out.append(['확인일은 2026-10-07 처럼 적고, 확인 방법/출처에는 "방문" 또는 홈페이지 주소를 적어요. 예시 줄은 지우지 않아도 됩니다.'] + [''] * (len(head) - 1))
out.append([''] * len(head))
out.append(head)
ex = ['예시', '예시도서관', ''] + ['O' if t in ('북카페', '와이파이') else '' for t in tag_names] + ['1층에 북카페가 있어요', '방문', '2026-10-07', '']
out.append(ex)
for l in rows:
    e = extras.get(l['name'], {})
    fac = set(e.get('facilities', []))
    out.append([l['district'], l['name'], l.get('url') or ''] + ['O' if t in fac else '' for t in tag_names]
               + [e.get('highlight', ''), e.get('source', ''), e.get('checked', ''), ''])
w = csv.writer(open(sys.argv[1] if len(sys.argv) > 1 else 'checklist.csv', 'w', encoding='utf-8', newline=''))
w.writerows(out)
print(len(rows), 'libraries,', len(tag_names), 'tags')
