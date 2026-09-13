import { fail, isAuthorized, ok } from "../lib/respond.js";
import { client, ScanCommand, tables } from "../lib/store.js";

export async function handler(event) {
  if (!isAuthorized(event)) {
    return fail(401, "Unauthorized");
  }
  const out = await client.send(new ScanCommand({ TableName: tables().submissions }));
  const items = (out.Items || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return ok({ items });
}
