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

## 사진 올리기

`images/` 폴더에 **도서관 이름 그대로** 파일명을 지어 올리면 자동으로 카드와 상세 화면에 나타납니다. 따로 설정할 것이 없습니다.

| 파일명 | 쓰임 |
|---|---|
| `강서도서관.jpg` | 대표 사진 (목록 썸네일 + 상세 첫 사진) |
| `강서도서관_2.jpg` ~ `강서도서관_4.jpg` | 추가 사진 (상세에서 옆으로 넘겨 봄) |

- 이름은 `data/libraries.json`의 `name`과 정확히 같아야 합니다 (띄어쓰기 포함, 예: `가보자 작은도서관.jpg`). 확장자는 소문자 `.jpg`.
- GitHub 웹에서 `images` 폴더로 들어가 **Add file → Upload files**로 끌어다 놓고 Commit 하면 됩니다. 1~2분 뒤 반영됩니다.
- 사진은 가로 1000px 안팎으로 줄여서 올리세요 (모바일에서 빠릅니다).
- 사진이 없는 도서관은 아이콘과 "네이버지도에서 사진 보기" 버튼이 대신 표시됩니다.
- 사진 출처를 남기려면 아래 `extras.json`에 `photoCredit`만 적으면 됩니다.
- 저작권이 있는 사진(도서관 홈페이지, 지도 서비스 등)은 허락 없이 올리지 마세요. 직접 촬영했거나, 이용 허락을 받았거나, 공공누리 등 이용 조건이 명시된 사진만 사용하세요.

## 부대시설·출처 채우기

`data/extras.json`의 `overrides`에 도서관 이름으로 추가합니다. `libraries.json`을 다시 만들어도 이 파일은 유지됩니다.

```json
{
  "overrides": {
    "도서관이름": {
      "facilities": ["어린이자료실", "카페"],
      "photoCredit": "촬영: 홍길동"
    }
  },
  "additions": []
}
```

- `photos`: `["a.jpg", "b.jpg"]`처럼 적으면 파일명 규칙 대신 이 목록을 사용합니다.
- 전문도서관처럼 표준데이터에 없는 곳은 `additions`에 `libraries.json`과 같은 형식으로 추가하면 `전문도서관` 체크박스가 자동으로 생깁니다.

## 데이터 갱신

```
python3 scripts/build_data.py 전국도서관표준데이터.csv
```

## 배포

GitHub 저장소 Settings → Pages → Branch `main` / `/ (root)` 선택.
