import { fail, ok } from "../lib/respond.js";
import { client, QueryCommand, tables } from "../lib/store.js";

function bandCount(n, unit) {
  if (!n) {
    return unit === "views" ? "None yet" : "No sessions in the last five minutes";
  }
  if (n <= 3) {
    return unit === "views"
      ? "1 to 3 unique property-page views"
      : "1 to 3 sessions in the last five minutes";
  }
  return unit === "views"
    ? `${n} unique property-page views`
    : `${n} sessions in the last five minutes`;
}

export async function handler(event) {
  const id = event.queryStringParameters?.id || "";
  if (!id) {
    return fail(400, "id is required");
  }
  const views = await client.send(
    new QueryCommand({
      TableName: tables().views,
      KeyConditionExpression: "propertyId = :id",
      ExpressionAttributeValues: { ":id": id },
      Select: "COUNT",
    })
  );
  const presence = await client.send(
    new QueryCommand({
      TableName: tables().presence,
      KeyConditionExpression: "propertyId = :id",
      ExpressionAttributeValues: { ":id": id },
    })
  );
  const cutoff = Date.now() - 5 * 60 * 1000;
  const active = (presence.Items || []).filter((row) => {
    const t = Date.parse(row.lastSeen || 0);
    return t >= cutoff;
  }).length;
  const uniqueViews = views.Count || 0;
  return ok({
    propertyId: id,
    uniqueViews,
    activeSessions: active,
    uniqueViewsLabel: bandCount(uniqueViews, "views"),
    activeLabel: bandCount(active, "live"),
    lastUpdated: new Date().toISOString(),
    definition: "Active viewers are sessions with a heartbeat in the last five minutes.",
  });
}
