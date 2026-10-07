# 부산 도서관

부산의 공공·작은·어린이 도서관 위치, 이용시간, 홈페이지를 지도와 목록으로 보여주는 정적 웹페이지입니다. 모바일에서도 볼 수 있는 반응형입니다.

## 구성

| 파일 | 역할 |
|---|---|
| `index.html`, `style.css`, `app.js` | 화면 (Leaflet + OpenStreetMap/CARTO 지도, 키 불필요) |
| `data/libraries.json` | 공공데이터포털 「전국도서관표준데이터」에서 추린 부산 도서관 (자동 생성) |
| `data/extras.json` | 부대시설·사진 등 직접 채우는 정보 |
| `images/` | 도서관 사진 |
| `scripts/build_data.py` | CSV → `libraries.json` 변환 스크립트 |

## 부대시설·사진 채우기

`data/extras.json`의 `overrides`에 도서관 이름으로 추가합니다. `libraries.json`을 다시 만들어도 이 파일은 유지됩니다.

```json
{
  "overrides": {
    "도서관이름": {
      "facilities": ["어린이자료실", "카페"],
      "photos": ["파일명.jpg"],
      "photoCredit": "촬영: 홍길동"
    }
  },
  "additions": []
}
```

- 사진 파일은 `images/` 폴더에 넣고 파일명만 적습니다 (가로 1000px 안팎으로 줄이면 모바일에서 빠릅니다).
- 전문도서관처럼 표준데이터에 없는 곳은 `additions`에 `libraries.json`과 같은 형식으로 추가하면 `전문도서관` 체크박스가 자동으로 생깁니다.

## 데이터 갱신

```
python3 scripts/build_data.py 전국도서관표준데이터.csv
```

## 배포

GitHub 저장소 Settings → Pages → Branch `main` / `/ (root)` 선택.
