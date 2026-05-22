const NOTION_VERSION = "2022-06-28";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

function html(body, init = {}) {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

function redirect(url) {
  return new Response(null, {
    status: 302,
    headers: { location: url }
  });
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function requireEnv(env, key) {
  const value = env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

function getCorsHeaders(env) {
  return {
    "access-control-allow-origin": env.APP_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

function getRedirectUri(env) {
  const baseUrl = requireEnv(env, "WORKER_BASE_URL").replace(/\/$/, "");
  return `${baseUrl}/auth/notion/callback`;
}

async function exchangeNotionCode(env, code) {
  const clientId = requireEnv(env, "NOTION_CLIENT_ID");
  const clientSecret = requireEnv(env, "NOTION_CLIENT_SECRET");
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "authorization": `Basic ${credentials}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(env)
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Notion token exchange failed: ${res.status} ${detail}`);
  }

  return res.json();
}

async function callNotion(token, path, init = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      "authorization": `Bearer ${token}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Notion API failed: ${res.status} ${detail}`);
  }

  return res.json();
}

function normalizeText(value) {
  return value && String(value).trim() ? String(value).trim() : "";
}

function richText(value, annotations = {}) {
  const content = normalizeText(value) || "-";
  const hasAnnotations = Object.keys(annotations).length > 0;
  const chunks = [];
  for (let i = 0; i < content.length; i += 1900) {
    const chunk = {
      type: "text",
      text: { content: content.slice(i, i + 1900) }
    };
    if (hasAnnotations) chunk.annotations = annotations;
    chunks.push(chunk);
  }
  return chunks;
}

function getPlanRows(plan) {
  if (Array.isArray(plan.rows) && plan.rows.length) return plan.rows;
  return [{
    backupDate: plan.backupDate,
    planDate: plan.planDate,
    important: plan.important,
    todo: plan.todos,
    timeline: plan.timeline,
    memo: plan.memo,
    thanks: plan.thanks,
    summary: plan.summary,
    updatedAt: plan.updatedAt
  }];
}

function parseBackupItem(value, endLabel) {
  const text = normalizeText(value);
  const item = { itemNo: null, content: text, start: "", end: "" };
  if (!text) return item;

  text.split("\n").forEach((line) => {
    const trimmed = line.trim();
    const numberMatch = trimmed.match(/^#(\d+)/);
    if (numberMatch) item.itemNo = Number(numberMatch[1]);
    else if (trimmed.startsWith("내용:")) item.content = trimmed.slice(3).trim();
    else if (trimmed.startsWith("시작:")) item.start = trimmed.slice(3).trim();
    else if (trimmed.startsWith(`${endLabel}:`)) item.end = trimmed.slice(endLabel.length + 1).trim();
  });
  return item;
}

function parseNotionDate(value) {
  const text = normalizeText(value);
  const dateTimeMatch = text.match(/^(\d{4}-\d{2}-\d{2})-(\d{2}):(\d{2})$/);
  if (dateTimeMatch) return `${dateTimeMatch[1]}T${dateTimeMatch[2]}:${dateTimeMatch[3]}:00+09:00`;
  const dateMatch = text.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateMatch) return text;
  return text || null;
}

function makeRecord(plan, section, data) {
  return {
    backupDate: plan.backupDate,
    planDate: plan.planDate,
    updatedAt: data.updatedAt || plan.updatedAt,
    section,
    itemNo: data.itemNo || null,
    content: data.content || "",
    start: data.start || "",
    end: data.end || ""
  };
}

function buildNotionRecords(plan) {
  const rows = getPlanRows(plan);
  const records = [];

  rows.forEach((row) => {
    const common = { updatedAt: row.updatedAt || plan.updatedAt };
    if (normalizeText(row.important)) {
      records.push(makeRecord(plan, "Important", { ...common, content: row.important }));
    }
    if (normalizeText(row.todo)) {
      records.push(makeRecord(plan, "TO DO LIST", { ...common, ...parseBackupItem(row.todo, "완료") }));
    }
    if (normalizeText(row.timeline)) {
      records.push(makeRecord(plan, "TIME LINE", { ...common, ...parseBackupItem(row.timeline, "마침") }));
    }
    if (normalizeText(row.memo)) {
      records.push(makeRecord(plan, "MEMO", { ...common, content: row.memo }));
    }
    if (normalizeText(row.thanks)) {
      records.push(makeRecord(plan, "THANKS GOD", { ...common, content: row.thanks }));
    }
    if (normalizeText(row.summary)) {
      records.push(makeRecord(plan, "SUMMARY", { ...common, content: row.summary }));
    }
  });

  return records;
}

function buildDatabaseSchema(parentPageId) {
  return {
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: "Daily Plan Archive DB" } }],
    properties: {
      Name: { title: {} },
      "Backup Date": { date: {} },
      "Plan Date": { date: {} },
      Section: {
        select: {
          options: [
            { name: "Important", color: "yellow" },
            { name: "TO DO LIST", color: "blue" },
            { name: "TIME LINE", color: "purple" },
            { name: "MEMO", color: "gray" },
            { name: "THANKS GOD", color: "green" },
            { name: "SUMMARY", color: "orange" }
          ]
        }
      },
      "Item No": { number: { format: "number" } },
      Content: { rich_text: {} },
      Start: { date: {} },
      End: { date: {} },
      "Updated At": { date: {} }
    }
  };
}

async function ensureArchiveDatabase(token, saved, env, userId) {
  if (saved.databaseId) return saved.databaseId;

  const database = await callNotion(token, "/databases", {
    method: "POST",
    body: JSON.stringify(buildDatabaseSchema(saved.parentPageId))
  });

  saved.databaseId = database.id;
  await env.DAILY_PLAN_USERS.put(`notion:${userId}`, JSON.stringify(saved));
  return database.id;
}

function buildRecordTitle(record) {
  const suffix = record.itemNo ? ` #${record.itemNo}` : "";
  return `${record.planDate || record.backupDate || "No Date"} ${record.section}${suffix}`;
}

function buildRecordProperties(record) {
  const properties = {
    Name: { title: richText(buildRecordTitle(record)) },
    "Backup Date": { date: record.backupDate ? { start: record.backupDate } : null },
    "Plan Date": { date: record.planDate ? { start: record.planDate } : null },
    Section: { select: { name: record.section } },
    Content: { rich_text: richText(record.content) }
  };

  if (record.itemNo) properties["Item No"] = { number: record.itemNo };
  const start = parseNotionDate(record.start);
  if (start) properties.Start = { date: { start } };
  const end = parseNotionDate(record.end);
  if (end) properties.End = { date: { start: end } };
  const updatedAt = parseNotionDate(record.updatedAt);
  if (updatedAt) properties["Updated At"] = { date: { start: updatedAt } };
  return properties;
}

async function createDatabaseRecord(token, databaseId, record) {
  return callNotion(token, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: buildRecordProperties(record)
    })
  });
}

async function handleNotionStart(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const userSecret = url.searchParams.get("userSecret");
  const parentPageId = url.searchParams.get("parentPageId");

  if (!userId || !userSecret || !parentPageId) {
    return json({ error: "userId, userSecret, parentPageId are required" }, { status: 400 });
  }

  const state = btoa(JSON.stringify({ userId, userSecret, parentPageId }));
  const notionUrl = new URL("https://api.notion.com/v1/oauth/authorize");
  notionUrl.searchParams.set("client_id", requireEnv(env, "NOTION_CLIENT_ID"));
  notionUrl.searchParams.set("response_type", "code");
  notionUrl.searchParams.set("owner", "user");
  notionUrl.searchParams.set("redirect_uri", getRedirectUri(env));
  notionUrl.searchParams.set("state", state);

  return redirect(notionUrl.toString());
}

async function handleNotionCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");

  if (!code || !rawState) {
    return html("<h1>Notion connection failed</h1><p>Missing code or state.</p>", { status: 400 });
  }

  const state = JSON.parse(atob(rawState));
  const token = await exchangeNotionCode(env, code);
  const userSecretHash = await sha256(state.userSecret);

  await env.DAILY_PLAN_USERS.put(`notion:${state.userId}`, JSON.stringify({
    accessToken: token.access_token,
    workspaceId: token.workspace_id,
    parentPageId: state.parentPageId,
    userSecretHash,
    connectedAt: new Date().toISOString()
  }));

  return html(`
    <h1>Notion connected</h1>
    <p>Daily Plan can now back up to Notion.</p>
    <p>You can close this tab and return to Daily Plan.</p>
  `);
}

async function handleNotionBackup(request, env) {
  const corsHeaders = getCorsHeaders(env);
  const body = await request.json();
  const { userId, userSecret, plan } = body;

  if (!userId || !userSecret || !plan) {
    return json({ error: "userId, userSecret, plan are required" }, { status: 400, headers: corsHeaders });
  }

  const savedRaw = await env.DAILY_PLAN_USERS.get(`notion:${userId}`);
  if (!savedRaw) {
    return json({ error: "Notion is not connected" }, { status: 401, headers: corsHeaders });
  }

  const saved = JSON.parse(savedRaw);
  if (saved.userSecretHash !== await sha256(userSecret)) {
    return json({ error: "Invalid user secret" }, { status: 403, headers: corsHeaders });
  }

  const records = buildNotionRecords(plan);
  if (!records.length) {
    return json({ error: "No backup records" }, { status: 400, headers: corsHeaders });
  }

  const databaseId = await ensureArchiveDatabase(saved.accessToken, saved, env, userId);
  const created = [];
  for (const record of records) {
    created.push(await createDatabaseRecord(saved.accessToken, databaseId, record));
  }

  return json({
    ok: true,
    databaseId,
    count: created.length,
    url: created[0]?.url
  }, { headers: corsHeaders });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(env) });

    try {
      const url = new URL(request.url);
      if (url.pathname === "/health") return json({ ok: true });
      if (url.pathname === "/auth/notion/start") return handleNotionStart(request, env);
      if (url.pathname === "/auth/notion/callback") return handleNotionCallback(request, env);
      if (url.pathname === "/backup/notion" && request.method === "POST") return handleNotionBackup(request, env);
      return json({ error: "Not found" }, { status: 404 });
    } catch (error) {
      return json({ error: error.message || "Unknown error" }, { status: 500, headers: getCorsHeaders(env) });
    }
  }
};
