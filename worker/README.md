# Daily Plan Backup Worker

Cloudflare Workers용 Notion 백업 서버 초안입니다.

## 필요한 환경 변수

Cloudflare Worker 설정에서 아래 값을 넣어야 합니다.

- `WORKER_BASE_URL`: `https://daily-plan-backup-api.heat21c.workers.dev`
- `APP_ORIGIN`: `https://heat21c-ohc.github.io`
- `NOTION_CLIENT_ID`: Notion에서 발급받은 Client ID
- `NOTION_CLIENT_SECRET`: Notion에서 발급받은 Client Secret

## 필요한 KV 바인딩

KV namespace를 만들고 Worker에 아래 이름으로 바인딩합니다.

- `DAILY_PLAN_USERS`

## Notion Redirect URI

Notion integration 설정의 Redirect URI:

```text
https://daily-plan-backup-api.heat21c.workers.dev/auth/notion/callback
```

## 제공 API

- `GET /health`
- `GET /auth/notion/start?userId=...&userSecret=...&parentPageId=...`
- `POST /backup/notion`

`parentPageId`는 사용자가 Notion에서 만든 `Daily Plan Archive` 페이지 ID입니다.

## 보안 메모

`NOTION_CLIENT_SECRET`은 절대 `app.js`에 넣지 않습니다. Cloudflare Worker의 환경 변수로만 관리합니다.
