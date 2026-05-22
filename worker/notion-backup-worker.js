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

function headingBlock(text) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: richText(text) }
  };
}

function paragraphBlock(value) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: richText(value) }
  };
}

function bulletBlock(value) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: richText(value) }
  };
}

function dividerBlock() {
  return { object: "block", type: "divider", divider: {} };
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

function collectItems(rows, key) {
  return rows.map((row) => normalizeText(row[key])).filter(Boolean);
}

function addSection(children, title, items) {
  if (!items.length) return;
  children.push(headingBlock(title));
  items.forEach((item) => children.push(bulletBlock(item)));
}

function buildPageChildren(plan) {
  const rows = getPlanRows(plan);
  const updatedAt = normalizeText(plan.updatedAt) || normalizeText(rows[0]?.updatedAt);
  const children = [
    headingBlock("Backup Info"),
    paragraphBlock([
      `Backup Date: ${plan.backupDate || "-"}`,
      `Plan Date: ${plan.planDate || "-"}`,
      `Updated At: ${updatedAt || "-"}`
    ].join("\n")),
    dividerBlock()
  ];

  addSection(children, "Important", collectItems(rows, "important"));
  addSection(children, "TO DO LIST", collectItems(rows, "todo"));
  addSection(children, "TIME LINE", collectItems(rows, "timeline"));
  addSection(children, "MEMO", collectItems(rows, "memo"));
  addSection(children, "THANKS GOD", collectItems(rows, "thanks"));
  addSection(children, "SUMMARY", collectItems(rows, "summary"));

  return children.slice(0, 100);
}

function buildPageTitle(plan) {
  const date = plan.planDate || plan.backupDate || "No Date";
  const updatedAt = plan.updatedAt ? ` ${plan.updatedAt}` : "";
  return `Daily Plan ${date}${updatedAt}`;
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

  const page = await callNotion(saved.accessToken, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { page_id: saved.parentPageId },
      properties: {
        title: {
          title: [{ type: "text", text: { content: buildPageTitle(plan) } }]
        }
      },
      children: buildPageChildren(plan)
    })
  });

  return json({ ok: true, pageId: page.id, url: page.url }, { headers: corsHeaders });
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
