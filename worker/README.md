# Daily Plan Backup Worker

Cloudflare Workers 기반 Notion 백업 서버입니다.

## 환경 변수

Cloudflare Worker 설정에 아래 값을 등록해야 합니다.

- `WORKER_BASE_URL`: `https://daily-plan-backup-api.heat21c.workers.dev`
- `APP_ORIGIN`: `https://heat21c-ohc.github.io`
- `NOTION_CLIENT_ID`: Notion에서 발급받은 OAuth Client ID
- `NOTION_CLIENT_SECRET`: Notion에서 발급받은 OAuth Client Secret

## KV 바인딩

KV namespace를 만들고 Worker에 아래 이름으로 바인딩합니다.

- `DAILY_PLAN_USERS`

## Notion Redirect URI

Notion integration 설정의 Redirect URI:

```text
https://daily-plan-backup-api.heat21c.workers.dev/auth/notion/callback
```

## API

- `GET /health`
- `GET /auth/notion/start?userId=...&userSecret=...&parentPageId=...`
- `POST /backup/notion`

`parentPageId`는 사용자가 Notion에서 만든 백업용 상위 페이지 ID입니다.

## 백업 형식

`POST /backup/notion`은 Daily Plan 프론트에서 넘긴 `plan.rows` 배열을 기준으로 Notion 데이터베이스에 행을 추가합니다.

첫 백업 시 `parentPageId` 페이지 아래에 `Daily Plan Archive DB` 데이터베이스를 생성하고, 이후에는 같은 데이터베이스에 계속 누적 저장합니다.
재연결 후에도 같은 상위 페이지에 이미 `Daily Plan Archive DB`가 있으면 기존 데이터베이스를 찾아 재사용합니다.
KV에 저장된 데이터베이스 ID가 삭제되었거나 integration에 공유되지 않아 조회되지 않으면, 저장된 ID를 버리고 기존 DB 검색 또는 신규 DB 생성으로 복구합니다.

데이터베이스 속성:

- `Name`: `{Plan Date} {Section} #{Item No}`
- `Backup Date`: 백업 실행 날짜
- `Plan Date`: Daily Plan 기준 날짜
- `Section`: Important, TO DO LIST, TIME LINE, MEMO, THANKS GOD, SUMMARY
- `Item No`: TO DO/TIME LINE 항목 번호
- `Content`: 항목 내용
- `Start`: 시작 날짜/시간 (date)
- `End`: 완료/마침 날짜/시간 (date)
- `Updated At`: 백업 시각 (date)

Notion 데이터베이스의 각 행은 내부적으로 Notion 페이지이지만, 사용자는 데이터베이스 표/보드/캘린더/필터/검색 방식으로 다룰 수 있습니다.

## 배포 주의

GitHub Pages 배포는 `app.js`만 반영합니다. `worker/notion-backup-worker.js`를 수정한 뒤에는 Cloudflare Worker에도 별도로 배포해야 Notion 백업 형식 변경이 실제로 적용됩니다.

Worker 수정 후에도 Notion 백업 결과가 바뀌지 않으면 GitHub Pages가 아니라 Cloudflare Worker 배포 상태를 먼저 확인해야 합니다.

## 보안 메모

`NOTION_CLIENT_SECRET`은 절대 `app.js`에 넣지 않습니다. Cloudflare Worker 환경 변수로만 관리합니다.
