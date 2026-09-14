import { fail, isAuthorized, ok, readJson } from "../lib/respond.js";
import { normalizeStatus } from "../lib/validate.js";
import { client, GetCommand, PutCommand, ScanCommand, tables } from "../lib/store.js";

const STATUSES = new Set(["Available", "Reserved", "Sold"]);

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === "GET") {
    const out = await client.send(new ScanCommand({ TableName: tables().status }));
    return ok({
      items: (out.Items || []).map(function (item) {
        return Object.assign({}, item, { status: normalizeStatus(item.status) });
      }),
    });
  }
  if (method === "PATCH") {
    if (!isAuthorized(event)) {
      return fail(401, "Unauthorized");
    }
    const propertyId = event.pathParameters?.id;
    const body = readJson(event) || {};
    const status = normalizeStatus(body.status);
    if (!propertyId || !STATUSES.has(status)) {
      return fail(400, "status must be Available, Reserved, or Sold");
    }
    const existing = await client.send(
      new GetCommand({ TableName: tables().status, Key: { propertyId } })
    );
    const item = {
      ...(existing.Item || {}),
      propertyId,
      status,
      updatedAt: new Date().toISOString(),
    };
    await client.send(new PutCommand({ TableName: tables().status, Item: item }));
    return ok({ item });
  }
  return fail(405, "Method not allowed");
}
