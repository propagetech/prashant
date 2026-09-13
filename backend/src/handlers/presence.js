import { fail, ok, readJson, userAgent } from "../lib/respond.js";
import { isBot } from "../lib/validate.js";
import { client, PutCommand, tables } from "../lib/store.js";

export async function handler(event) {
  const body = readJson(event);
  if (!body || !body.propertyId || !body.sessionId) {
    return fail(400, "propertyId and sessionId are required");
  }
  if (isBot(userAgent(event))) {
    return ok({ ok: true, skipped: "bot" });
  }
  const now = Math.floor(Date.now() / 1000);
  const item = {
    propertyId: String(body.propertyId).slice(0, 40),
    sessionId: String(body.sessionId).slice(0, 80),
    lastSeen: new Date().toISOString(),
    lastSeenUnix: now,
    event: String(body.event || "heartbeat").slice(0, 40),
    page: String(body.page || "").slice(0, 200),
    expiresAt: now + 86400,
  };
  await client.send(new PutCommand({ TableName: tables().presence, Item: item }));
  return ok({ ok: true });
}
