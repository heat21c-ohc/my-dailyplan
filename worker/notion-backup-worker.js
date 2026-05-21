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

function textBlock(label, value) {
  const content = value && String(value).trim() ? String(value).trim() : "-";
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        { type: "text", text: { content: `${label}: ` }, annotations: { bold: true } },
        { type: "text", text: { content } }
      ]
    }
  };
}

function buildPageChildren(plan) {
  return [
    textBlock("Backup Date", plan.backupDate),
    textBlock("Plan Date", plan.planDate),
    textBlock("Important", plan.important),
    textBlock("TO DO LIST", plan.todos),
    textBlock("TIME LINE", plan.timeline),
    textBlock("MEMO", plan.memo),
    textBlock("THANKS GOD", plan.thanks),
    textBlock("SUMMARY", plan.summary)
  ];
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
          title: [{ type: "text", text: { content: `Daily Plan ${plan.planDate || plan.backupDate}` } }]
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
