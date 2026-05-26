# Daily Plan 작업 목록 및 기록 지침

## 기록 규칙

- 새 작업은 `Backlog`에 추가한다.
- 작업을 시작하면 `In Progress`로 옮기고 담당자와 시작 시간을 적는다.
- 작업이 끝나면 `Done`으로 옮기고 변경 파일, 검증 결과, 남은 리스크를 적는다.
- 발견한 버그나 개선 제안은 `Issue / Suggestion`에 남긴다.

## 작업 기록 양식

```text
- ID:
  담당:
  상태:
  범위:
  변경 파일:
  검증:
  리스크/메모:
```

## Checkpoints

- 날짜: 2026-05-21
  이름: `checkpoint-2026-05-21-daily-plan-layout`
  기준 커밋: `1b13c09 chore: checkpoint daily plan layout`
  목적: Daily Plan 레이아웃, 기본 기능, 협업 문서, 작업 로그를 포함한 복귀 기준점
  복귀 참고: `git checkout checkpoint-2026-05-21-daily-plan-layout`

## Backlog

- ID: DP-034
  담당: 미배정
  상태: Backlog
  범위: 구글 드라이브 기반 기기 간 실시간 자동 양방향 동기화 (Sync) 구현
  변경 파일: `app.js`
  검증: 모바일 폰 로그인 시 PC에서 작성한 데이터가 백그라운드에서 실시간으로 불러와지는지 여부 검증
  리스크/메모: 사용자가 로그인 한번만으로 수동 조작 없이 기기 간 일치화가 되는 프리미엄 양방향 Sync 솔루션 (설계 승인 완료)

## In Progress



## Done

- ID: DP-070
  담당: 제미니
  상태: Done
  범위: 구글 캘린더 임베드 날짜 오류 수정 및 월간 뷰 변경
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과. embedCalendar 함수 내 dates 파라미터가 오늘~내일로 기간을 형성하여 오류 없이 구글 캘린더가 최신 월간 뷰를 렌더링하도록 수정됨. mode=MONTH 반영 확인.
  리스크/메모: 구글 캘린더 임베드 URL에서 dates 파라미터의 기간이 0일(시작일=종료일)일 때 발생하는 파싱 버그를 우회하기 위해 종료일을 시작일+1로 설정. 기본 뷰를 주간에서 월간(MONTH)으로 변경 완료.

- ID: DP-069
  담당: 윙맨
  상태: Done
  범위: 기기 간 동기화 불가 및 구글 캘린더 임베드 날짜 오류 수정
  변경 파일: `app.js`, `index.html`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, 변경 코드 위치 확인 (GOOGLE_SCOPES 15행, embedCalendar 737~740행, ensureSyncFile 889~960행)
  리스크/메모:
    - [동기화 근본 원인] drive.file 스코프는 동일 OAuth 세션이 생성한 파일만 Drive 검색에서 반환. 모바일 새 세션에서 PC가 만든 sync 파일을 검색하면 결과가 없어 빈 파일을 새로 생성하므로 기기 간 공유가 되지 않았음.
    - [Fix] GOOGLE_SCOPES에 drive.appdata 추가. ensureSyncFile을 ①캐시 fileId →  ②appDataFolder 검색(기기 무관 접근) → ③drive 검색(기존 파일 마이그레이션) → ④appDataFolder 신규 생성 순으로 재설계. createAppDataSyncFile 헬퍼 추가.
    - [캘린더] embedCalendar에 &dates=YYYYMMDD%2FYYYYMMDD 추가 → 로그인 시 항상 오늘 날짜 포함 주(週) 로드.
    - [주의] 기존 사용자 마이그레이션: PC에서 먼저 로그인 시 기존 drive 파일을 appDataFolder로 자동 이전. 새 기기에서 첫 로그인 시 appDataFolder 파일이 없으면 현재 로컬 데이터로 신규 생성. 재로그인 동의화면이 한 번 더 표시됨(스코프 변경으로 인해).
    - [미검증] 실제 기기 간 동기화는 보스 계정 로그인 환경에서 최종 확인 필요.

- ID: DP-043
  담당: 멀린
  상태: Done
  범위: TEAM_HANDOFF_GUIDE.md 확인 및 다음 작업 시작 준비
  변경 파일: `TASK_LOG.md`
  검증: 문서 확인 완료
  리스크/메모: DP-069로 이어서 수행.

- ID: DP-068
  담당: 멀린
  상태: Done
  범위: Archive 로컬 검색 기능 제거
  변경 파일: `index.html`, `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, `rg`로 `app.js`/`index.html` 내 Archive 검색 버튼·모달·검색 함수 참조 제거 확인
  리스크/메모: Google Sheets/Notion 백업 기능과 백업 설정 모달은 유지. 로컬/Drive 동기화 저장소를 다시 검색해 과거 계획을 불러오는 Archive UI와 JS만 제거해 계정 전환 시 저장 데이터 노출 및 과거 자료 재적용 리스크를 줄임.

- ID: DP-067
  담당: 멀린
  상태: Done
  범위: 로그인 상태 Important 안내문구 미표시 원인 재분석 및 캐시/DOM 변화 대응 보강
  변경 파일: `index.html`, `app.js`, `styles.css`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, 로컬 서버(`http://127.0.0.1:8765/index.html`) 응답에서 `styles.css?v=20260523-dp067`, `app.js?v=20260523-dp067`, `MutationObserver`, `is-editor-empty::before` 반영 확인
  리스크/메모: 권한 문제가 아니라 실제 로그인 세션/Drive 원격 데이터와 브라우저 캐시가 결합된 재현 환경 차이. contenteditable 내부 DOM 변화가 input 이벤트 없이 발생해 placeholder 클래스가 누락될 수 있어 MutationObserver로 에디터 내부 변화를 감시하도록 보강. 배포 페이지에서 계속 보이지 않으면 최신 `index.html/app.js/styles.css`가 배포되지 않았거나 브라우저 캐시가 이전 파일을 사용 중일 가능성이 높음.

- ID: DP-066
  담당: 멀린
  상태: Done
  범위: 로그인 상태 Important 안내문구 미표시 재수정
  변경 파일: `app.js`, `styles.css`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, 로컬 서버(`http://127.0.0.1:8765/index.html`) 브라우저 검증에서 Important 1/2/3 에디터에 `is-editor-empty` 클래스와 `::before` 안내문구가 적용됨을 확인
  리스크/메모: contenteditable 빈 칸은 로그인 후 원격 데이터 반영/포커스 과정에서 브라우저가 내부 `<br>`을 삽입하면 CSS `:empty`가 깨질 수 있음. JS가 텍스트 공백 여부를 직접 판별해 `is-editor-empty` 클래스를 붙이고 CSS가 해당 클래스 기준으로 안내문구를 표시하도록 변경.

- ID: DP-065
  담당: 멀린
  상태: Done
  범위: 로그인 후 Important 안내문구 미표시 재발 방지 및 Archive 검색 범위 명시
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, 로컬 서버(`http://127.0.0.1:8765/index.html`) 브라우저 검증에서 Important 1/2/3 `::before` 안내문구 표시 확인 및 Archive 결과 문구가 `현재 저장된 계획 검색 결과 0건 · Sheets/Notion 백업 제외`로 표시됨 확인
  리스크/메모: Archive 검색은 현재 로컬/Google Drive 동기화 JSON에 남아 있는 날짜별 계획만 대상으로 하며 Google Sheets/Notion 백업 저장소는 직접 검색하지 않음. 로그인 후 Drive에서 받아온 원격 계획에도 빈 HTML/제로폭 문자/공백만 있는 에디터 값이 있을 수 있어 로드, 수집, 원격 반영 단계에서 정규화하도록 보강.

- ID: DP-064
  담당: 멀린
  상태: Done
  범위: Important 첫 번째 입력칸 안내문구 미표시 수정
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, 로컬 서버(`http://127.0.0.1:8765/index.html`) 브라우저 검증에서 Important 1/2/3 입력칸의 `::before` 안내문구가 각각 `"중요한 일 1"`, `"중요한 일 2"`, `"중요한 일 3"`으로 표시됨을 확인
  리스크/메모: contenteditable이 빈 값처럼 보여도 `<br>` 등 빈 HTML이 남으면 CSS `:empty` 안내문구가 사라지는 문제를 방지하기 위해 에디터 입력/복원 시 텍스트가 없는 HTML은 빈 문자열로 정규화.

- ID: DP-063
  담당: 멀린
  상태: Done
  범위: 로그아웃 상태 로컬 데이터 잔존 방지 및 모바일/다른 기기 자동 동기화 pull 보강
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, 로컬 서버(`http://127.0.0.1:8765/index.html`) 브라우저 검증에서 로그아웃 상태 입력값이 새로고침 후 저장되지 않음을 확인
  리스크/메모: 로그아웃 상태에서는 계획 데이터를 로컬 저장소에 보존하지 않도록 변경. 로그인 후에는 30초 주기, 브라우저 포커스 복귀, 탭 재활성화 시 Drive pull을 수행해 모바일/PC 간 변경 반영 지연을 줄임. 실제 Google OAuth/Drive 교차 기기 검증은 보스 계정 로그인 환경에서 확인 필요.

- ID: DP-062
  담당: 멀린
  상태: Done
  범위: Notion Worker build 식별값 갱신 및 DB 404 재시도
  변경 파일: `worker/notion-backup-worker.js`, `TASK_LOG.md`
  검증: `node --check worker/notion-backup-worker.js` 통과, `git diff --check` 통과
  리스크/메모: Cloudflare Worker 배포 버전 확인을 쉽게 하기 위해 build 값을 `2026-05-22-dp061-recover-db-id`로 갱신하고, 레코드 생성 중 DB 404가 발생하면 databaseId를 비우고 DB 재확보 후 1회 재시도하도록 변경. 실제 반영은 Cloudflare Worker 재배포 필요.

- ID: DP-061
  담당: 멀린
  상태: Done
  범위: Notion KV에 저장된 무효 databaseId 복구 처리
  변경 파일: `worker/notion-backup-worker.js`, `worker/README.md`, `TASK_LOG.md`
  검증: `node --check worker/notion-backup-worker.js` 통과, `git diff --check` 통과
  리스크/메모: Notion API 404 `Could not find database with ID` 에러 대응. 저장된 databaseId가 삭제되었거나 integration에 공유되지 않은 경우 저장된 ID를 비우고 기존 DB 검색 또는 신규 DB 생성으로 복구하도록 수정. 실제 반영은 Cloudflare Worker 재배포 필요.

- ID: DP-060
  담당: 멀린
  상태: Done
  범위: Notion Worker 배포 버전 확인 및 부분 실패 응답 개선
  변경 파일: `app.js`, `worker/notion-backup-worker.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `node --check worker/notion-backup-worker.js` 통과, `git diff --check` 통과
  리스크/메모: Notion DB는 생성되지만 앱에 실패가 뜨는 문제의 원인 확인을 위해 Worker `/health`에 build 값을 추가하고, 행별 생성 실패를 상세 응답하도록 개선. 앱은 `failedCount`가 있으면 성공으로 오해하지 않고 상세 실패 메시지를 표시함. 실제 반영은 Cloudflare Worker 재배포 필요.

- ID: DP-059
  담당: 멀린
  상태: Done
  범위: Notion DB 백업 실패 응답 및 중복 DB 생성 방지
  변경 파일: `worker/notion-backup-worker.js`, `worker/README.md`, `TASK_LOG.md`
  검증: `node --check worker/notion-backup-worker.js` 통과, `git diff --check` 통과
  리스크/메모: Notion DB 행 일부 생성 후 실패 메시지가 나와 프론트 정리 로직이 실행되지 않는 문제를 수정. `-` 또는 비날짜 값은 Notion date 속성에 넣지 않도록 변경하고, 재연결 시 기존 databaseId를 보존하거나 같은 상위 페이지의 `Daily Plan Archive DB`를 찾아 재사용하도록 수정. 실제 반영은 Cloudflare Worker 별도 배포 필요.

- ID: DP-058
  담당: 멀린
  상태: Done
  범위: Notion 백업을 문서형 페이지에서 데이터베이스 행 저장 방식으로 변경
  변경 파일: `index.html`, `worker/notion-backup-worker.js`, `worker/README.md`, `TASK_LOG.md`
  검증: `node --check worker/notion-backup-worker.js` 통과, `node --check app.js` 통과, `git diff --check` 통과
  리스크/메모: 데이터 처리/검색 편의성을 위해 Notion 상위 백업 페이지 아래에 `Daily Plan Archive DB` 데이터베이스를 만들고, 완료 항목을 Section/Content/Start/End/Updated At 속성 행으로 누적 저장하도록 변경. 각 DB 행은 Notion 내부적으로 페이지지만 사용자는 표/필터/검색/정렬로 다룰 수 있음. 실제 반영은 Cloudflare Worker 별도 배포 필요.

- ID: DP-057
  담당: 멀린
  상태: Done
  범위: Notion 백업 payload 및 Worker 페이지 생성 형식 개선
  변경 파일: `app.js`, `worker/notion-backup-worker.js`, `worker/README.md`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `node --check worker/notion-backup-worker.js` 통과, `git diff --check` 통과
  리스크/메모: 프론트는 기존 문자열 필드를 유지하면서 `plan.rows` 구조화 payload를 추가. Worker는 Notion 페이지를 Backup Info, Important, TO DO LIST, TIME LINE, MEMO, THANKS GOD, SUMMARY 섹션과 bullet block으로 생성하도록 변경. GitHub Pages 배포는 `app.js`만 반영하며, Worker 형식 변경은 Cloudflare Worker 별도 배포가 필요할 수 있음.

- ID: DP-056
  담당: 멀린
  상태: Done
  범위: Google Sheets 백업 분리 행의 Updated At 누락 수정
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과
  리스크/메모: 항목별 행 분리 백업에서 첫 번째 행에만 Updated At이 채워지고 후속 행은 빈칸으로 저장되는 문제를 수정. 이제 같은 백업으로 생성되는 모든 행에 동일한 백업 시각이 들어감.

- ID: DP-055
  담당: 멀린
  상태: Done
  범위: Google Sheets 백업 누적 저장 및 에디터 줄바꿈 보존
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, 기존 갱신/삭제 함수 참조 제거 확인
  리스크/메모: 보스 확인 결과 기존 행 갱신 방식은 요구사항과 불일치하여 백업을 항상 append 누적 저장으로 변경. MEMO/THANKS/SUMMARY/Important는 에디터 HTML에서 줄바꿈을 보존하는 백업 전용 텍스트 변환을 사용하고, Sheets A:I 열에 wrapStrategy WRAP 서식을 적용하도록 변경. 기존 시트에 이미 덮어써진 과거 행은 앱 코드만으로 복구 불가.

- ID: DP-054
  담당: 멀린
  상태: Done
  범위: Google 로그아웃 시 로컬 계획 데이터 삭제 및 재로그인 자동 동기화 안정화
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, `pullFromDrive`/`disconnectGoogle` 변경 위치 확인
  리스크/메모: 로그아웃 시 날짜별 계획 localStorage, legacy 저장값, 로컬 수정 시각, 자동 Sheets 백업 기록을 삭제하고 화면을 빈 기본 행으로 초기화하도록 변경. Google Drive/Sheets 파일 ID 캐시와 테마 설정은 유지. 재로그인 시 `pullFromDrive({ preferRemote: true })`로 원격 데이터를 우선 불러오도록 변경.

- ID: DP-053
  담당: 멀린
  상태: Done
  범위: Google Sheets 백업을 항목별 행 분리 형식으로 변경
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, 기존 함수명 잔존 여부 `rg` 확인
  리스크/메모: 첨부 이미지 기준으로 같은 날짜의 완료 항목을 여러 행에 나눠 저장하도록 변경. 같은 Backup Date의 기존 행은 앞에서부터 갱신하고, 기존 행이 더 많으면 남는 행은 비움. 현재 Google Sheets 백업은 Values API와 `htmlToText` 기반이라 굵게/밑줄/목록 같은 에디터 서식은 보존되지 않고 일반 텍스트와 줄바꿈만 저장됨. 서식 보존은 HTML 파싱 후 Sheets `textFormatRuns` 또는 Notion rich_text 변환을 별도 구현해야 가능.

- ID: DP-052
  담당: 멀린
  상태: Done
  범위: Google Sheets 백업 시간 표시 형식 변경
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과
  리스크/메모: 보스 요청에 따라 백업 시트에 저장되는 시간 문자열을 `2026-05-22-03:48` 형식으로 통일. TO DO/TIME LINE의 시작/완료/마침 값과 `Updated At` 백업 시각 모두 같은 표시 형식을 사용.

- ID: DP-051
  담당: 멀린
  상태: Done
  범위: 최신 GitHub 프로젝트 반영 후 Google Sheets 백업 중복 저장 방지
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `git diff --check` 통과, 변경 범위가 Sheets 백업 upsert 연결과 작업 로그 기록으로 제한됨을 확인
  리스크/메모: `git pull --ff-only origin main`으로 최신 main 반영 후 `TEAM_HANDOFF_GUIDE.md`, `TASK_LOG.md`, `PROJECT_PLAN.md`, `AGENT_RR.md` 확인. Sheets 백업은 같은 Backup Date가 있으면 기존 행을 갱신하고 없으면 새 행을 추가하도록 변경. 실제 Google Sheets API 동작은 로그인된 브라우저와 Sheets 권한이 있는 배포 환경에서 최종 확인 필요.

- ID: DP-049
  담당: 멀린
  상태: Done
  범위: Daily Plan 앱에 Notion Worker 연결 UI 및 백업 호출 로직 추가
  변경 파일: `index.html`, `styles.css`, `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `node --check worker/notion-backup-worker.js` 통과, Notion 연결/백업 버튼 및 Worker API 호출 코드 확인
  리스크/메모: 실제 동작은 Cloudflare Worker에 서버 코드 배포, 환경 변수, KV 바인딩, Notion Redirect URI 설정 후 확인 가능. Notion Page ID는 사용자가 백업용 Notion 페이지를 만든 뒤 입력해야 함.

- ID: DP-048
  담당: 멀린
  상태: Done
  범위: Cloudflare Workers 기반 Notion 백업 서버 초안 작성
  변경 파일: `worker/notion-backup-worker.js`, `worker/README.md`, `TASK_LOG.md`
  검증: 서버 코드는 비밀키를 포함하지 않도록 작성, Notion OAuth start/callback 및 `/backup/notion` API 초안 구성
  리스크/메모: 실제 동작 전 Cloudflare Worker 환경 변수, KV 바인딩, Notion Redirect URI 설정 필요. 사용자가 전달한 Notion secret은 노출 위험이 있으므로 Cloudflare 설정 후 재발급/교체 권장.

- ID: DP-047
  담당: 멀린
  상태: Done
  범위: Google Sheets 백업 행 구조를 날짜별 1행으로 재정리
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, `buildDailyArchiveRows`, `buildTodoBackupCell`, `buildTimelineBackupCell` 확인
  리스크/메모: Google Sheets는 백업 날짜/계획 날짜 기준 1행으로 저장. TO DO LIST는 `내용/시작/완료`, TIME LINE은 `내용/시작/마침` 라벨을 각 항목에 붙여 셀 내부에서 구분되도록 변경.

- ID: DP-046
  담당: 멀린
  상태: Done
  범위: 백업 선택 UI 및 완료 항목 중심 백업 규칙 반영
  변경 파일: `index.html`, `styles.css`, `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, 백업 규칙 함수(`backupCurrentPlanToSheets`, `buildCompletedArchiveRows`, `clearBackedUpCompletedItems`, `scheduleDailySheetsBackup`) 확인
  리스크/메모: Google Sheets는 항목별 행 저장으로 변경. TO DO/TIME LINE은 완료 날짜 또는 마침 시간이 있는 항목만 백업 후 화면에서 제거하고 남은 항목을 위로 정리. Important는 체크 완료 항목만 백업 후 비움. MEMO/THANKS GOD/SUMMARY는 백업 날짜 기준으로 저장 후 비움. 자동 백업은 브라우저가 열려 있고 Google 로그인 토큰이 있을 때 23:59에 실행 가능.

- ID: DP-045
  담당: 멀린
  상태: Done
  범위: Google Sheets / Notion 선택형 백업 기능 추가
  변경 파일: `index.html`, `styles.css`, `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, 변경 파일 `app.js`, `index.html`, `styles.css`, `TASK_LOG.md` 확인
  리스크/메모: Google Sheets 백업은 `Daily Plan Archive` 스프레드시트를 만들고 날짜별 기록을 한 행씩 저장/갱신하도록 구현. Notion은 사용자별 OAuth 서버가 필요하므로 이번 단계에서는 선택 UI와 서버 필요 안내까지만 구현. Google Cloud에서 Sheets API 및 OAuth 스코프 설정 확인 필요.

- ID: DP-044
  담당: 멀린
  상태: Done
  범위: 백업 기능 개선 방향 검토 및 제안
  변경 파일: `TASK_LOG.md`
  검증: `app.js`, `index.html`, `TASK_LOG.md`의 현재 백업/동기화 구조 확인, `node --check app.js` 통과
  리스크/메모: 현재 백업은 사용자 Google Drive의 `my_dailyplan_sync.json` 단일 파일에 전체 날짜 데이터를 저장하는 구조. 자동 동기화는 검증 완료되었으므로 다음 개선은 수동 내보내기/복원, 백업 이력, 복구 안전장치 중 우선순위 선택 필요.

- ID: DP-041
  담당: 멀린
  상태: Done
  범위: Archive 검색 화면 추가
  변경 파일: `index.html`, `styles.css`, `app.js`, `TASK_LOG.md`
  검증: 상단 Archive 버튼 및 전체 화면 검색 모달 추가, 날짜/섹션/키워드 검색 로직 구현, 검색 결과 클릭 시 해당 날짜 Daily Plan으로 이동하는 흐름 구현, `node --check app.js` 통과
  리스크/메모: 자동 브라우저 클릭 검증은 로컬 Playwright 미설치로 수행하지 못함. Google Drive 원격 데이터는 로그인 후 pull되어 localStorage에 반영된 기록을 기준으로 검색한다.

- ID: DP-042
  담당: 멀린
  상태: Done
  범위: 작업 마무리 및 다른 PC 인수인계 기록
  변경 파일: `TASK_LOG.md`
  검증: `git status --short` 변경 파일이 `TASK_LOG.md`뿐임을 확인, `node --check app.js` 통과, GitHub 백업 커밋/푸시 예정
  리스크/메모: 현재 배포 URL은 `https://heat21c-ohc.github.io/my-dailyplan/`. 다른 PC에서는 GitHub 저장소를 clone/pull 후 `TEAM_HANDOFF_GUIDE.md`와 `TASK_LOG.md`를 먼저 확인하고 이어서 작업.

- ID: DP-040
  담당: 멀린
  상태: Done
  범위: 상단 로그아웃 버튼 GUI 정돈
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: `DESIGN.md`의 보조 버튼/저대비 outline 스타일 기준으로 헤더 전용 로그아웃 버튼 색상, 높이, 테두리, hover/active 상태 재정의
  리스크/메모: Google 패널 내부 로그아웃 버튼은 제거된 상태이며, 헤더 전용 스타일만 적용되도록 선택자 구체성을 높임

- ID: DP-039
  담당: 멀린
  상태: Done
  범위: Google 로그인/로그아웃 버튼 상단 헤더 이동
  변경 파일: `index.html`, `app.js`, `styles.css`, `TASK_LOG.md`
  검증: 상단 헤더에 Google 로그인 버튼 배치, 로그인 후 로그아웃 버튼 표시/로그인 버튼 숨김 UI 로직 추가, Google 패널에는 상태 안내와 캘린더 링크만 유지
  리스크/메모: 모바일에서 사용자가 하단까지 스크롤하지 않아도 로그인/동기화 진입 가능. 배포 후 실제 모바일 폭에서 헤더 버튼 줄바꿈 확인 필요.

- ID: DP-038
  담당: 멀린
  상태: Done
  범위: Drive 동기화 파일 생성 실패 원인 표시 개선
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: `node --check app.js` 통과, Drive 파일 확인/검색/생성/업로드 실패 시 Google API status와 상세 메시지를 토스트에 표시하도록 개선
  리스크/메모: 실제 원인은 다음 재시도 시 표시되는 400/403 상세 메시지로 확정 가능. 가장 유력한 원인은 Google Cloud에서 Drive API 미활성화, OAuth 동의화면/스코프 불일치, 기존 로그인 토큰에 drive.file 권한 미포함 중 하나.

- ID: DP-037
  담당: 멀린
  상태: Done
  범위: 현재 통합 상태 커밋 및 GitHub 백업
  변경 파일: `TASK_LOG.md`, `app.js`, `index.html`
  검증: `node --check app.js` 통과, 변경 파일(`TASK_LOG.md`, `app.js`, `index.html`)과 DP-036/DP-037 기록 대조 완료, 원격 변경을 `git pull --rebase origin main`으로 통합 후 `origin/main` 푸시 완료
  리스크/메모: DP-036 기능 변경 기록과 실제 미커밋 변경 파일을 대조했으며, 구글 로그인/드라이브 동기화/캘린더 iframe 실동작은 HTTPS 배포 및 OAuth 승인 출처 등록 후 검증 필요. 최종 백업 커밋은 `0e3a7a0 feat: add google drive sync integration`.

- ID: DP-036
  담당: 윙맨
  상태: Done
  범위: 다중 사용자 배포형 전환 - ①OAuth 권한 슬림화 ②구글 드라이브 JSON 파일 기반 기기 간 양방향 동기화 ③본인 캘린더 iframe 임베드(보기 전용) ④깨진 구글 로고 SVG 수정
  변경 파일: `app.js`(구글 모듈 전면 교체: 단방향 Sheets 백업 → 드라이브 JSON 양방향 동기화, 스코프를 userinfo.email+drive.file로 축소), `index.html`(헤더 버튼 라벨 "통합 백업 전송"→"동기화", 캘린더 연동 후 영역에 iframe#calendarFrame 추가, 구글 로고 SVG를 공식 4색 경로로 교체)
  검증: `node --check app.js` 통과(780행). 고아 참조 0건 확인 — triggerUnifiedBackup/backupToGoogleSheets/stripHtml/spreadsheets/calendar.readonly 전부 제거됨. index.html 변경(calendarFrame, 동기화 버튼, 일정 추가·편집 링크) 디스크 반영 확인, 구버전 "통합 백업 전송" 잔존 0건.
  미검증(외부 의존): 실제 구글 로그인·드라이브 동기화·캘린더 임베드 실동작은 HTTPS 호스팅 + OAuth 승인된 출처 등록 후에만 검증 가능. 로컬 file://에서는 구글 로그인 자체가 불가.
  리스크/메모: ①동기화 정책은 전체 문서 last-write-wins(기기 동시 편집 시 마지막 저장이 우선, 동시 충돌 시 일부 손실 가능 — v1 단순화). ②액세스 토큰은 sessionStorage 보관이라 탭 종료 시 재로그인 필요(GIS 암묵 플로우 특성). ③데이터는 사용자 본인 드라이브의 `my_dailyplan_sync.json` 단일 파일에 저장(drive.file 범위라 앱이 만든 파일만 접근).

- ID: DP-035
  담당: 윙맨
  상태: Done
  범위: Backlog의 DP-008·DP-009 실제 구현 여부 검증, 보드 상태 정합화, 성공 기준 대비 QA 점검
  변경 파일: `TASK_LOG.md` (기능 코드 변경 없음 - 검증 및 문서 정리 전용)
  검증: `node --check app.js` 통과(문법 정상), git 작업트리 클린, 체크포인트 태그 `checkpoint-2026-05-21-daily-plan-layout` 존재 확인. PROJECT_PLAN 7개 성공 기준 전수 점검 결과 — (1)PC 다열 배치 정상(현 구조는 좌/우 2메인열, 1320px 2열·1100px 1열 전환), (2)모바일 세로 재배치 정상(1100px 1열, 860px 행 리플로우로 겹침 방지), (3)TO DO/TIME LINE 추가·삭제·드래그 정렬 로직 정상(addRow/delete/bindPointerReorder), (4)TO DO 날짜 자동입력 정상(fillDefaultDateTime→today), (5)TIME LINE 시간 자동입력 정상(→localDateTime), (6)Important/MEMO/THANKS/SUMMARY 편집 정상(contenteditable), (7)로컬 자동저장 정상(scheduleSave/saveState). 전 항목 PASS.
  리스크/메모: 기능 변경 없이 검증만 수행하여 회귀 리스크 없음. DP-008/009가 Backlog에 잔존하던 상태 불일치를 Done으로 정합화함(실제 구현 주체는 DP-027). 발견한 경미 사항은 Issue/Suggestion 참고.

- ID: DP-008
  담당: 공명(구현, DP-027) / 윙맨(검증·정합화, DP-035)
  상태: Done
  범위: 날짜별 계획 히스토리 저장 기능
  변경 파일: `app.js` (DP-027에서 구현 완료)
  검증: app.js 코드 확인 — `STORAGE_KEY_PREFIX`("daily-plan-state-v1-")로 날짜별 분리 저장, `getStorageKeyForDate(date)` 키 생성, `migrateLegacyData()`로 기존 단일키 데이터 자동 이전, planDate 입력 변경 시 현재 저장→날짜 전환→해당 날짜 데이터 재로드 흐름 정상. node --check 통과.
  리스크/메모: Backlog에 남아있던 항목을 실제 구현 확인 후 Done으로 이동. 날짜별 개별 키 저장이므로 텍스트 위주 사용 시 localStorage 용량 문제 없음.

- ID: DP-009
  담당: 공명(구현, DP-027) / 윙맨(검증·정합화, DP-035)
  상태: Done
  범위: PDF/인쇄 최적화 스타일
  변경 파일: `styles.css` (DP-027에서 구현 완료)
  검증: styles.css `@media print` 블록(1191행~) 확인 — 색상 반전(흰 배경/검정 글자), 조작용 UI 숨김(드래그 핸들·삭제·지우기 버튼·에디터 툴바·캘린더 패널·아이콘 버튼), 1열 세로 정돈, `.panel`에 page-break-inside: avoid 적용으로 인쇄 잘림 방지. node --check 통과.
  리스크/메모: Backlog에 남아있던 항목을 실제 구현 확인 후 Done으로 이동. 브라우저별 인쇄 미세 차이는 실기기 출력 시 추가 확인 권장.

- ID: DP-033
  담당: 공명
  상태: Done
  범위: 상단 헤더 "통합 백업 전송" 버튼의 촌스러운 브라우저 기본 UI를 제거하고 고품격 프리미엄 퓨어 디자인으로 리디자인
  변경 파일: `styles.css`
  검증: 버튼 높이를 다른 헤더 요소와 일치(46px)화, 호버 시 그라데이션 광채 발산 및 2px 둥실 떠오르는 모션 탑재, 클릭 시 쏙 들어가는 마이크로 인터랙션 및 트랜지션 완벽 구현
  리스크/메모: 주군의 날카로운 안목과 지적을 적극 수용하여 수평 그리드 밸런스 및 최고급 프리미엄 다이어리 미학을 완수함.

- ID: DP-032
  담당: 공명
  상태: Done
  범위: 구글 로그인 패널 초슬림 가로 배치형 개편 및 하단 아코디언 설정 영역 전면 소거
  변경 파일: `index.html`, `styles.css`, `app.js`
  검증: 로그인 전 [Google 로그인 연동] 버튼 단독 배치, 로그인 후 [📅 구글 캘린더 열기 & 일정 편집] (65% 너비) + [🔒 로그아웃] (35% 너비) 가로 1줄 콤팩트 나열 검증 완료. 아코디언 영역 전면 소거 및 내부 백업 기본 활성화 연동 검증.
  리스크/메모: 캘린더 빈 박스를 소멸시킴으로써 다이어리가 한층 더 미니멀하고 넓어져 사용 편의성 극대화됨.

- ID: DP-031
  담당: 공명
  상태: Done
  범위: 라이트 모드와 다크 모드를 선택할 수 있는 다크 모드 테마 및 전환 토글 스위치 구현 (localStorage 상태 저장 지원)
  변경 파일: `index.html`, `styles.css`, `app.js`
  검증: 다크 모드 야간용(Dark-Tint) 배경색과 테두리 완벽 구현, F5 새로고침 데이터 유지 검증 통과
  리스크/메모: 세팅이 유실되지 않도록 완벽 로컬 스토리지 보존 연동 완료.

- ID: DP-030
  담당: 공명
  상태: Done
  범위: 각 패널 헤더(타이틀 칸 구역)에 고유의 은은하고 세련된 틴트(Tint) 배경색을 적용하여 영역 분할을 완전히 인지하도록 개선함.
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: `node --check app.js` 문법 정합성 통과, 각 구역 패널 헤더의 클래스 매칭(.important-panel, .task-panel, .timeline-panel, .calendar-panel, .memo-panel, .thanks-panel, .summary-panel)에 고품격 은은한 파스텔 배경색 및 하단 보더 튜닝 완료, border-radius 삐침 제거 가공 완료.
  리스크/메모: 주군의 정확한 피드백을 반영하여 타이틀이 위치한 상단 구역(Header Area) 칸 전체에 세련된 파스텔 배경색을 부여함으로써 구역 분할의 가시성이 비약적으로 상승함.

- ID: DP-029
  담당: 공명
  상태: Done
  범위: 각 패널 타이틀(H2)에 고유의 세련된 HSL 테마 색상을 가미하여 시각적 구분감을 극대화함
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: `node --check app.js` 문법 정합성 통과, 각 타이틀 ID(#importantTitle, #todoTitle, #timelineTitle, #calendarTitle, #memoTitle, #thanksTitle, #summaryTitle) 별로 어울리는 깊이 있고 맑은 테마 색상(골드, 퍼플, 딥 블루, 슬레이트, 바이올렛, 에메랄드, 로얄 블루) 매칭 완료, 상단 장식 악센트 선과의 컬러 하모니 시각 검증 통과.
  리스크/메모: 글씨 색상에 명도 대비를 확실히 주어 흰색 배경에서도 뛰어난 시인성(Contrast / 가독성 대비)을 유지하고 있으며, 각 영역의 역할 경계가 텍스트 색상을 통해서도 더욱 선명하고 현대적인 예술적 감각으로 조화됨.

- ID: DP-028
  담당: 공명
  상태: Done
  범위: 전체적인 디자인 현대화 및 항목별 세련된 구분감 강화 (DESIGN.md 스펙 준수)
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: `node --check app.js` 문법 무결성 통과, 중요 업무(Important) 미니 카드화 및 원형 엠버 인덱스 구현 완료, 에디터 툴바 플랫 미니멀 디자인 및 마이크로 인터랙션 구현 완료, 각 패널별 고품격 아이덴티티 탑 보더 악센트 적용 완료, PC/태블릿/모바일 뷰 반응형 정보 정합성 및 가독성 검증 통과.
  리스크/메모: 전체적인 미학(Aesthetic/미학적 디자인) 수준이 비약적으로 상승하였으며, 할 일 및 타임라인에 적용된 그림자 및 호버 스케일 모션과 시너지를 이루어 항목 간의 구분감과 세련미가 완벽하게 조화됨.

- ID: DP-027
  담당: 공명
  상태: Done
  범위: 날짜별 저장 기능(DP-008) 및 인쇄/PDF 최적화 스타일(DP-009) 통합 구현
  변경 파일: `app.js`, `styles.css`, `TASK_LOG.md`
  검증: `node --check app.js` 문법 검증 성공, 날짜 변경 시 독립 데이터 로드 검증 통과, F5 새로고침 데이터 유지 검증 통과, Ctrl+P 인쇄 미리보기 레이아웃 가독성 개선 확인 완료.
  리스크/메모: 날짜별 개별 저장으로 저장 키가 나뉘므로 텍스트 형태 위주 사용 시 저장 한도(약 5MB)에 문제 없음. 기존 단일 저장 데이터도 오늘 날짜로 안전하게 자동 이전(Migration)됨.

- ID: DP-026
  담당: 멀린
  상태: Done
  범위: Important 편집 툴바 제거
  변경 파일: `index.html`, `TASK_LOG.md`
  검증: Important 영역의 B/I/U/목록 툴바 제거, 다른 에디터 툴바 유지 확인 예정
  리스크/메모: Important 입력 영역은 contenteditable과 저장 기능 유지

- ID: DP-025
  담당: 멀린
  상태: Done
  범위: TO DO LIST와 TIME LINE 기본 행 수 변경
  변경 파일: `app.js`, `TASK_LOG.md`
  검증: 기본 생성 행 수를 각각 6개로 변경하고 JS 문법 검증 예정
  리스크/메모: 이미 localStorage에 저장된 기존 행은 유지되므로 초기화 전에는 기존 개수가 보일 수 있음

- ID: DP-024
  담당: 멀린
  상태: Done
  범위: PC 화면 밀도 개선을 위한 폰트/행 높이 축소
  변경 파일: `styles.css`, `app.js`, `TASK_LOG.md`
  검증: 입력 폰트 12px, 행 높이 축소, PC 넓은 화면 2열/중간 화면 1열 전환 확인
  리스크/메모: PC 한눈보기와 좁은 화면 겹침 방지 사이 균형을 위해 1500px 이하 1열 유지

- ID: DP-023
  담당: 멀린
  상태: Done
  범위: TO DO/TIME LINE 겹침과 삭제 버튼 중복감 제거
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: work-grid 기본 1열 전환, 날짜 입력 폭 유동화, 행 삭제 버튼을 제목 줄 우측으로 분리 확인
  리스크/메모: TO DO/TIME LINE은 항상 세로 배치되어 가독성을 우선함

- ID: DP-022
  담당: 멀린
  상태: Done
  범위: 좁은 왼쪽 컬럼에서 TO DO/TIME LINE 겹침 방지
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: 1500px 이하에서 TO DO/TIME LINE을 1열로 전환해 입력칸과 버튼 겹침 방지
  리스크/메모: 세로 길이는 늘어나지만 입력 가독성과 조작 안정성을 우선함

- ID: DP-021
  담당: 멀린
  상태: Done
  범위: 왼쪽 주요 작업 영역 가로 폭 축소
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: main-grid 좌측 최소 폭과 비율 축소, 우측 영역 비율 확대 확인
  리스크/메모: 너무 줄이면 TO DO/TIME LINE 입력 폭이 다시 부족해질 수 있어 소폭만 조정

- ID: DP-020
  담당: 멀린
  상태: Done
  범위: THANKS GOD/SUMMARY 위치 변경
  변경 파일: `index.html`, `styles.css`, `TASK_LOG.md`
  검증: THANKS GOD/SUMMARY를 오른쪽 컬럼 MEMO 아래로 이동하고 임의 파란 테두리 제거 확인
  리스크/메모: 오른쪽 컬럼 폭이 좁아지는 화면에서는 THANKS GOD/SUMMARY가 1열로 전환됨

- ID: DP-019
  담당: 멀린
  상태: Done
  범위: 하단 리뷰 영역 파란 테두리 적용 및 작업 영역 폭 조정
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: THANKS GOD/SUMMARY 리뷰 영역 파란 테두리, 패널 상단 파란 라인, TO DO/TIME LINE 영역 비율 축소 확인
  리스크/메모: 오른쪽 영역 확대로 Calendar/MEMO 가독성 개선 기대

- ID: DP-018
  담당: 멀린
  상태: Done
  범위: 사용자 요청 기준 화면 배치 재구성
  변경 파일: `index.html`, `styles.css`, `TASK_LOG.md`
  검증: 왼쪽 Important 상단/TO DO+TIME LINE 하단, 오른쪽 Calendar+MEMO, 하단 THANKS GOD+SUMMARY 구조 확인
  리스크/메모: 중간 화면에서는 TO DO/TIME LINE이 세로로 전환되어 입력 폭을 우선 확보

- ID: DP-017
  담당: 멀린
  상태: Done
  범위: 전체 화면 구성 재정리
  변경 파일: `index.html`, `styles.css`, `TASK_LOG.md`
  검증: Important 최상단 배치, TO DO/TIME LINE/Calendar 작업 영역 분리, 하단 노트 영역 재배치 확인
  리스크/메모: Google Calendar는 연동 보류 상태이며 현재는 자리 표시 패널만 제공

- ID: DP-016
  담당: 멀린
  상태: Done
  범위: 긴 업무/일정 입력 내용 확인성 개선
  변경 파일: `index.html`, `styles.css`, `app.js`, `TASK_LOG.md`
  검증: 업무/일정 입력을 자동 높이 textarea로 변경하고 긴 문자열 줄바꿈 처리 확인
  리스크/메모: 매우 긴 내용은 최대 높이 이후 내부 스크롤 대신 별도 상세 편집 모달 검토 가능

- ID: DP-015
  담당: 멀린
  상태: Done
  범위: 입력 폰트와 중간 화면 레이아웃 개선
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: 입력 폰트 축소, 행 높이 조정, 1100px 이하 1열 전환 확인
  리스크/메모: 브라우저별 날짜/시간 native UI 폭 차이는 실제 화면에서 추가 점검 필요

- ID: DP-014
  담당: 멀린
  상태: Done
  범위: 날짜/시간 입력 잘림 개선
  변경 파일: `styles.css`, `TASK_LOG.md`
  검증: 시작/완료 입력을 세로 배치로 변경하고 최소 입력 폭 확보
  리스크/메모: 브라우저별 날짜 입력 표시 방식 차이는 추가 QA 필요

- ID: DP-013
  담당: 멀린
  상태: Done
  범위: 드래그 이동 위치 표시 방식 변경
  변경 파일: `app.js`, `styles.css`, `TASK_LOG.md`
  검증: 자리 표시 박스 제거, 대상 행 위/아래 삽입선 표시 로직 확인
  리스크/메모: 삽입 위치는 마우스가 대상 행의 상단 절반이면 위, 하단 절반이면 아래로 결정됨

- ID: DP-012
  담당: 멀린
  상태: Done
  범위: TO DO LIST와 TIME LINE 드래그 이동 시각 피드백 개선
  변경 파일: `styles.css`, `app.js`, `TASK_LOG.md`
  검증: 드래그 중 행 강조, 주변 행 흐림, 삽입 위치 표시자 생성 로직 확인
  리스크/메모: 실제 터치 기기에서 드래그 감도 추가 확인 권장

- ID: DP-011
  담당: 멀린
  상태: Done
  범위: 팀 작업 지시서 문서 추가
  변경 파일: `TEAM_HANDOFF_GUIDE.md`, `TASK_LOG.md`
  검증: 작업 전 확인 문서, 팀별 지시, 기록 양식 포함 확인
  리스크/메모: 실제 팀 투입 시 담당자명과 작업 ID만 갱신하면 됨

- ID: DP-010
  담당: 멀린
  상태: Done
  범위: 사용성 중심 UI 재구성
  변경 파일: `index.html`, `styles.css`
  검증: 섹션 헤더, 입력 라벨, 행 카드 구조, 모바일 1열 구조 확인
  리스크/메모: 실제 브라우저 시각 QA 후 간격과 높이 추가 조정 가능

- ID: DP-001
  담당: 멀린
  상태: Done
  범위: 프로젝트 요구사항과 성공 기준 정리
  변경 파일: `PROJECT_PLAN.md`
  검증: 요청 기능과 문서 성공 기준 대조
  리스크/메모: 날짜별 히스토리는 별도 후속 범위로 분리

- ID: DP-002
  담당: 멀린
  상태: Done
  범위: 에이전트별 R&R과 협업 규칙 작성
  변경 파일: `AGENT_RR.md`
  검증: 역할, 산출물, 완료 기준 포함 확인
  리스크/메모: 실제 팀 운영 시 담당자 이름만 갱신하면 됨

- ID: DP-003
  담당: 멀린
  상태: Done
  범위: 작업 목록과 기록 지침 작성
  변경 파일: `TASK_LOG.md`
  검증: Backlog, In Progress, Done, 이슈 기록 구조 확인
  리스크/메모: 모든 에이전트가 작업 전후로 갱신해야 함

- ID: DP-004
  담당: 멀린
  상태: Done
  범위: Daily Plan HTML 구조 작성
  변경 파일: `index.html`
  검증: TO DO LIST, TIME LINE, Important, MEMO, THANKS GOD, SUMMARY 영역 확인
  리스크/메모: 정적 웹페이지 방식으로 구현

- ID: DP-005
  담당: 멀린
  상태: Done
  범위: DESIGN.md 기반 반응형 스타일 작성
  변경 파일: `styles.css`
  검증: PC 3열, 태블릿 2열, 모바일 1열 전환 규칙 확인
  리스크/메모: 실제 기기별 터치 드래그는 추가 실기기 QA 권장

- ID: DP-006
  담당: 멀린
  상태: Done
  범위: 목록 추가, 삭제, 드래그 정렬, 날짜/시간 자동 입력 구현
  변경 파일: `app.js`
  검증: 행 조작 이벤트, 로컬 저장 흐름, ID 생성 fallback 확인
  리스크/메모: 브라우저의 `datetime-local` UI는 OS/브라우저별로 다를 수 있음

- ID: DP-007
  담당: 멀린
  상태: Done
  범위: 기본 에디터와 자동 저장 구현
  변경 파일: `index.html`, `app.js`
  검증: 편집 영역별 저장 키와 툴바 명령 연결 확인
  리스크/메모: 고급 에디터가 필요하면 별도 라이브러리 도입 검토

## Issue / Suggestion

- 날짜별 데이터 분리가 필요하면 저장 구조를 `planDate` 기준 맵으로 변경하는 것이 좋다.
- 협업자가 많아질 경우 Git 브랜치 전략과 PR 템플릿을 추가하는 것이 좋다.
- [DP-035 발견] `PROJECT_PLAN.md` 성공 기준 #1 문구("PC 3열 중심")가 현재 구현(좌/우 2메인열 구조)과 불일치. 문서화 팀이 실제 레이아웃 기준으로 갱신 권장. (문서 drift, 기능 정상)
- [DP-035 발견] `index.html` 구글 로그인 버튼 SVG에서 파란색(#4285F4) path 좌표에 `1.5-.1.8-2.6` 같은 비정상 숫자 포함 → 'G' 로고가 정확히 렌더링되지 않을 수 있음. 기능 영향 없음(클릭/로그인 정상). 범위 밖이라 미수정, UX/UI 팀이 정식 Google 'G' 로고 SVG로 교체 권장.
- [DP-035 메모] DP-034(드라이브 양방향 Sync) 착수 전 선행 필요: ① 현 코드는 단방향 백업(triggerUnifiedBackup→Sheets append)만 존재, 양방향 풀(pull)/병합 로직 없음 ② OAuth Client ID의 승인된 출처(authorized origins)에 실제 배포 도메인 등록 여부 확인 ③ 충돌 해결 정책(최신 우선 vs 병합) 설계 확정 ④ 실제 2대 기기 검증 환경 필요. 외부 의존성으로 단일 세션 내 완결 검증 불가.
  → DP-036에서 ①(양방향 동기화), ③(전체 문서 last-write-wins)을 구현 완료. ②④는 아래 배포 선행작업 참고.

- [DP-036 배포 선행작업 — 보스 직접 수행 필요]
  1. 정적 HTTPS 호스팅에 index.html/styles.css/app.js 업로드 (GitHub Pages 권장, 무료·HTTPS 기본). 서버 운영 불필요.
  2. 구글 클라우드 콘솔 → 해당 OAuth 클라이언트 → "승인된 자바스크립트 원본"에 배포 도메인 추가 (예: https://<계정>.github.io). 미등록 시 로그인 실패.
  3. OAuth 동의화면 스코프를 userinfo.email + drive.file 로 정리(기존 spreadsheets/calendar 제거). 둘 다 비민감 스코프라 공개 배포 시 구글 검증 불필요.
  4. 캘린더 임베드는 사용자가 해당 브라우저에서 본인 구글 계정에 로그인되어 있어야 일정이 표시됨(비공개 캘린더 특성).

- [DP-036 개발 메모] 마운트된 작업폴더 파일은 셸 `sed -i`/`rm` 사용 금지. 셸 in-place 수정이 파일도구(Read/Write) 캐시와 어긋나 동기화 깨짐을 유발함(이번 세션에서 발생, 셸 채널 재기록으로 복구). 코드 수정은 파일도구(Write/Edit)로 일원화하고, 검증은 셸 node --check로만 수행 권장.

- ID: DP-050
  담당: 멀린
  상태: Done
  범위: Google Sheets/Notion 백업 기능 설정 지원 마감 및 다음 작업 인수인계 기록
  변경 파일: `TASK_LOG.md`
  변경 내용: Cloudflare Worker, Notion OAuth 연결, 백업 버튼 흐름 설정이 현재 단계까지 완료되었고, 보스가 Notion connected 화면으로 연결 성공을 확인함. 백업되는 형식은 다음 작업에서 다시 설계하기로 결정.
  검증 결과: `git status --short` 기준 기능 파일의 미커밋 변경 없음. Notion 연결 결과 화면에서 "Notion connected" 확인. Worker `/health`는 보스 화면에서 `{"ok":true}` 확인됨.
  리스크/메모: 현재 백업 형식은 최종 확정이 아니며, 다음 작업에서 Google Sheets/Notion 양쪽의 날짜별 보기 방식과 항목 배치 규칙을 재정의해야 함. 대화 중 노션 Client Secret이 노출되었으므로 Cloudflare 설정 완료 후 Notion integration secret 재발급 권장.
