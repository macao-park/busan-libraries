#!/usr/bin/env python3
"""data/extras.json 입력 오류 검사. 올리기 전에 한 번 돌려 보세요.

    python3 scripts/check_extras.py

확인하는 것: 도서관 이름 오타, tags.json에 없는 시설 이름, 없는 사진 파일, 너무 긴 한 줄 특징,
제보 양식(.github/ISSUE_TEMPLATE/library-info.yml)과 tags.json의 시설 목록 불일치.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))


def main():
    libs = {l["name"] for l in load("data/libraries.json")}
    extras = load("data/extras.json")
    groups = load("data/tags.json")["groups"]
    vocab = {t for g in groups for t in g["tags"]}
    problems = []

    names = set(libs)
    for a in extras.get("additions", []):
        names.add(a.get("name", ""))

    for name, o in extras.get("overrides", {}).items():
        if name not in names:
            problems.append(f"[이름] '{name}' 은(는) 도서관 목록에 없습니다 (띄어쓰기·오타 확인)")
        for t in o.get("facilities", []):
            if t not in vocab:
                problems.append(f"[시설] {name}: '{t}' 은(는) tags.json에 없는 이름입니다")
        for p in o.get("photos", []):
            if not re.match(r"^(https?:)?//", p) and not (ROOT / "images" / p).exists():
                problems.append(f"[사진] {name}: images/{p} 파일이 없습니다")
        if len(o.get("highlight", "")) > 40:
            problems.append(f"[특징] {name}: 한 줄 특징이 40자를 넘습니다")

    form = (ROOT / ".github/ISSUE_TEMPLATE/library-info.yml").read_text(encoding="utf-8")
    in_form = set(re.findall(r"- label: (.+)", form))
    if in_form != vocab:
        diff = sorted(vocab ^ in_form)
        problems.append(f"[제보 양식] tags.json과 제보 양식의 시설 목록이 다릅니다: {', '.join(diff)}")

    filled = sum(1 for o in extras.get("overrides", {}).values() if o.get("facilities"))
    print(f"부대시설이 채워진 도서관: {filled}곳 / 전체 {len(libs)}곳")
    if problems:
        print("\n확인이 필요한 항목:")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("문제 없음")


if __name__ == "__main__":
    main()
