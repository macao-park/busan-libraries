#!/usr/bin/env python3
"""공공데이터포털 「전국도서관표준데이터」 CSV에서 부산 도서관만 추려 data/libraries.json 생성.

사용법:  python3 scripts/build_data.py 전국도서관표준데이터.csv
(수작업 정보인 부대시설·사진은 data/extras.json에 따로 적으므로, 이 스크립트를 다시 돌려도 지워지지 않습니다.)
"""
import csv
import json
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "libraries.json"


def read_rows(path):
    for enc in ("utf-8-sig", "cp949"):
        try:
            with open(path, encoding=enc, newline="") as fh:
                return list(csv.DictReader(fh))
        except UnicodeDecodeError:
            continue
    raise SystemExit("CSV 인코딩을 읽을 수 없습니다.")


def num(v):
    v = (v or "").strip().replace(",", "")
    try:
        f = float(v)
    except ValueError:
        return None
    return int(f) if f == int(f) else f


def hours(start, end):
    s, e = (start or "").strip(), (end or "").strip()
    if not s or not e or (s == "00:00" and e == "00:00"):
        return None
    return [s, e]


def url(v):
    v = (v or "").strip()
    if not v:
        return ""
    if not re.match(r"^https?://", v, re.I):
        v = "http://" + v
    return v


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    rows = [r for r in read_rows(sys.argv[1]) if r["시도명"].startswith("부산")]
    libs = []
    for r in rows:
        try:
            lat, lng = float(r["위도"]), float(r["경도"])
        except ValueError:
            continue
        libs.append({
            "name": r["도서관명"].strip(),
            "type": r["도서관유형"].strip(),
            "district": r["시군구명"].strip(),
            "address": r["소재지도로명주소"].strip(),
            "phone": r["도서관전화번호"].strip(),
            "url": url(r["홈페이지주소"]),
            "lat": lat,
            "lng": lng,
            "closed": r["휴관일"].strip(),
            "hours": {
                "weekday": hours(r["평일운영시작시각"], r["평일운영종료시각"]),
                "sat": hours(r["토요일운영시작시각"], r["토요일운영종료시각"]),
                "holiday": hours(r["공휴일운영시작시각"], r["공휴일운영종료시각"]),
            },
            "seats": num(r["열람좌석수"]),
            "books": num(r["자료수(도서)"]),
            "loanBooks": num(r["대출가능권수"]),
            "loanDays": num(r["대출가능일수"]),
            "area": num(r["건물면적"]),
            "org": r["운영기관명"].strip(),
            "updated": r["데이터기준일자"].strip(),
        })
    libs.sort(key=lambda x: (x["district"], x["name"]))
    for i, l in enumerate(libs, 1):
        l["id"] = i
    OUT.write_text(json.dumps(libs, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(libs)}개 도서관 → {OUT}")


if __name__ == "__main__":
    main()
