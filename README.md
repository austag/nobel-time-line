# 노벨 실험 노트

노벨 과학상(물리학, 화학, 생리의학)의 핵심 원리를 직접 손으로 움직여 보는 인터랙티브 웹사이트입니다. 2026년에서 시작해 과거로 한 해씩 거슬러 올라갑니다.

> 노벨 재단과 관련 없는 비공식 교육용 프로젝트입니다. 노벨 재단의 로고, 메달 이미지, 수상자 사진은 쓰지 않습니다.

## 지금 상태

- 홈 화면: 소개, 연도 타임라인, 부문과 연도 필터, 연도별 카드 목록, 한국어와 영어 전환, 밝은 테마와 어두운 테마
- 체험 화면: 캔버스, 컨트롤, 관찰, 조작, 이해 탭, 미션, 재생과 초기화
- 완성된 체험: 2026 물리학(IceCube). 나머지 5개는 준비 중 안내가 나옵니다
- 데이터: 2026년, 2025년 (2026년 수상 사유 원문은 아직 nobelprize.org에서 확인하지 않아 `motivation_verified: false`로 표시)

## 실행 방법

```bash
npm install
npm run dev      # 개발 서버
npm test         # 단위 테스트
npm run build    # dist 폴더에 정적 파일 생성
```

## 주소 구조

| 주소 | 화면 |
|---|---|
| `#/` | 홈 |
| `#/?field=physics&year=2025` | 필터가 적용된 홈 |
| `#/2026/physics` | 체험 화면 |
| `#/about` | 프로젝트 소개 |

## 폴더 구조

```
src/
  data/2026.json, 2025.json   연도별 수상 데이터
  data.ts                     데이터 병합과 정렬
  i18n.ts                     한국어, 영어 문구 (사이트 이름도 여기)
  router.ts                   주소 해석
  previews.ts                 카드 미리보기 그림
  experiment.ts               체험 화면 (탭, 미션, 재생)
  sims/                       체험 모듈과 공통 컨트롤
  main.ts                     화면 그리기와 이벤트
  styles.css                  디자인
public/fonts/                 제목 글꼴
```

## 연도 추가하기

1. `src/data/{연도}.json`을 기존 파일과 같은 형식으로 만듭니다.
2. `src/data.ts`의 `YEAR_FILES`에 추가합니다.
3. `src/previews.ts`에 `sim` 값과 같은 이름으로 미리보기 그림을 넣습니다.

## 체험 모듈 추가하기

1. `src/sims/{sim 값}/` 폴더에 `model.ts`(계산), `content.ts`(탭별 해설), `index.ts`(화면과 컨트롤)를 만듭니다. `2026-physics-icecube`가 예시입니다.
2. `index.ts`는 `src/sims/types.ts`의 `SimModule` 형태를 기본 내보내기로 제공합니다.
3. `src/sims/registry.ts`에 한 줄 추가합니다. 체험을 열 때만 불러옵니다.

## 배포

`main` 브랜치에 올리면 GitHub Actions가 테스트와 빌드를 거쳐 GitHub Pages에 배포합니다. 저장소의 Settings, Pages에서 Source를 "GitHub Actions"로 한 번 설정해야 합니다.

## 글꼴

- 제목: 카페24 써라운드 (Cafe24, OFL). `public/fonts/`에 포함
- 본문: 그리운X국한박 고운 (그리운, 국립한글박물관). 파일을 저장소에 넣지 않고 눈누 CDN에서 불러옵니다

## 자료 출처와 라이선스

- 자료 출처: nobelprize.org, Nobel Prize API v2.1
- 코드: MIT
- 글: CC BY 4.0
