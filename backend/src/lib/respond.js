export function corsHeaders() {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type,x-admin-token",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export function ok(body, statusCode = 200) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

export function fail(statusCode, message) {
  return ok({ error: message }, statusCode);
}

export function readJson(event) {
  if (!event.body) {
    return {};
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthorized(event) {
  const h = event.headers || {};
  const token = h["x-admin-token"] || h["X-Admin-Token"] || "";
  return Boolean(process.env.ADMIN_TOKEN) && token === process.env.ADMIN_TOKEN;
}

export function clientIp(event) {
  return event.requestContext?.http?.sourceIp || "";
}

export function userAgent(event) {
  const h = event.headers || {};
  return h["user-agent"] || h["User-Agent"] || "";
}
