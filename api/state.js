const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const supabaseRequest = async (path, options = {}) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || "Supabase request failed";
    throw new Error(message);
  }
  return data;
};

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 200, { ok: true });
  if (!["GET", "PUT"].includes(req.method)) return json(res, 405, { error: "Method not allowed" });

  const expectedToken = process.env.TRACKER_SYNC_TOKEN;
  const token = req.headers["x-tracker-token"];
  if (!expectedToken) return json(res, 500, { error: "TRACKER_SYNC_TOKEN is not configured" });
  if (token !== expectedToken) return json(res, 401, { error: "Invalid sync token" });

  const workspaceId = process.env.TRACKER_WORKSPACE_ID || "default";

  try {
    if (req.method === "GET") {
      const rows = await supabaseRequest(`tracker_state?id=eq.${encodeURIComponent(workspaceId)}&select=payload,updated_at&limit=1`);
      return json(res, 200, { payload: rows?.[0]?.payload || null, updatedAt: rows?.[0]?.updated_at || null });
    }

    const body = await readBody(req);
    if (!body?.payload || typeof body.payload !== "object") return json(res, 400, { error: "Missing payload" });

    await supabaseRequest("tracker_state?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        id: workspaceId,
        payload: body.payload,
        updated_at: new Date().toISOString(),
      }),
    });

    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error.message || "Cloud sync failed" });
  }
};
