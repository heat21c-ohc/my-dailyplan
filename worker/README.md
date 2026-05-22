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

`POST /backup/notion`은 Daily Plan 프론트에서 넘긴 `plan.rows` 배열을 기준으로 Notion 하위 페이지를 생성합니다.

- 페이지 제목: `Daily Plan {Plan Date} {Updated At}`
- 상단: Backup Date, Plan Date, Updated At
- 섹션: Important, TO DO LIST, TIME LINE, MEMO, THANKS GOD, SUMMARY
- 완료 항목은 섹션별 bullet block으로 저장
- MEMO/THANKS/SUMMARY는 줄바꿈을 유지한 텍스트로 저장

## 배포 주의

GitHub Pages 배포는 `app.js`만 반영합니다. `worker/notion-backup-worker.js`를 수정한 뒤에는 Cloudflare Worker에도 별도로 배포해야 Notion 백업 형식 변경이 실제로 적용됩니다.

## 보안 메모

`NOTION_CLIENT_SECRET`은 절대 `app.js`에 넣지 않습니다. Cloudflare Worker 환경 변수로만 관리합니다.
