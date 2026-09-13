import { clientIp, fail, ok, readJson, userAgent } from "../lib/respond.js";
import { isBot } from "../lib/validate.js";
import { client, GetCommand, PutCommand, tables } from "../lib/store.js";
import { hashIp, lookupGeo } from "../lib/geo.js";

export async function handler(event) {
  const body = readJson(event);
  if (!body || !body.propertyId || !body.sessionId) {
    return fail(400, "propertyId and sessionId are required");
  }
  if (isBot(userAgent(event))) {
    return ok({ ok: true, skipped: "bot" });
  }
  const propertyId = String(body.propertyId).slice(0, 40);
  const sessionId = String(body.sessionId).slice(0, 80);
  const existing = await client.send(
    new GetCommand({
      TableName: tables().views,
      Key: { propertyId, sessionId },
    })
  );
  if (existing.Item) {
    return ok({ ok: true, unique: false });
  }
  const geo = await lookupGeo(clientIp(event));
  const item = {
    propertyId,
    sessionId,
    createdAt: new Date().toISOString(),
    page: String(body.page || "").slice(0, 200),
    ipHash: hashIp(clientIp(event)),
    country: geo.country,
    region: geo.region,
    city: geo.city,
    utm: body.utm && typeof body.utm === "object" ? body.utm : {},
  };
  await client.send(new PutCommand({ TableName: tables().views, Item: item }));
  return ok({ ok: true, unique: true });
}
