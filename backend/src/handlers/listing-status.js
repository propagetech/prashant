import { fail, isAuthorized, ok, readJson } from "../lib/respond.js";
import { client, GetCommand, PutCommand, ScanCommand, tables } from "../lib/store.js";

const STATUSES = new Set(["Available", "Under offer", "Sold"]);

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === "GET") {
    const out = await client.send(new ScanCommand({ TableName: tables().status }));
    return ok({ items: out.Items || [] });
  }
  if (method === "PATCH") {
    if (!isAuthorized(event)) {
      return fail(401, "Unauthorized");
    }
    const propertyId = event.pathParameters?.id;
    const body = readJson(event) || {};
    if (!propertyId || !STATUSES.has(body.status)) {
      return fail(400, "status must be Available, Under offer, or Sold");
    }
    const existing = await client.send(
      new GetCommand({ TableName: tables().status, Key: { propertyId } })
    );
    const item = {
      ...(existing.Item || {}),
      propertyId,
      status: body.status,
      updatedAt: new Date().toISOString(),
    };
    await client.send(new PutCommand({ TableName: tables().status, Item: item }));
    return ok({ item });
  }
  return fail(405, "Method not allowed");
}
