import { fail, isAuthorized, ok, readJson } from "../lib/respond.js";
import { validateProperty } from "../lib/validate.js";
import {
  client,
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  tables,
} from "../lib/store.js";

function publicItem(item) {
  if (!item) {
    return null;
  }
  return {
    id: item.id,
    title: item.title,
    listingDate: item.listingDate,
    status: item.status,
    area: item.area || "",
    dimensions: item.dimensions || "",
    roadAccess: item.roadAccess || "",
    landType: item.landType || "",
    facing: item.facing || "",
    priceGuidance: item.priceGuidance || "",
    location: item.location || "",
    center: item.center,
    boundary: item.boundary || [],
    mapsUrl: item.mapsUrl || "",
    placeUrl: item.placeUrl || "",
    photos: Array.isArray(item.photos) ? item.photos : [],
    pimPdf: "",
    boundaryNote: item.boundaryNote || "",
    hidden: item.hidden === true,
  };
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const pathId = event.pathParameters?.id
    ? String(event.pathParameters.id).toUpperCase()
    : "";

  if (method === "GET") {
    const out = await client.send(new ScanCommand({ TableName: tables().properties }));
    const items = (out.Items || []).map(publicItem);
    if (!isAuthorized(event)) {
      return ok({
        items: items.map(function (item) {
          return item.hidden ? { id: item.id, hidden: true } : item;
        }),
      });
    }
    return ok({ items: items });
  }

  if (!isAuthorized(event)) {
    return fail(401, "Unauthorized");
  }

  if (method === "DELETE") {
    if (!pathId) {
      return fail(400, "Missing property id");
    }
    await client.send(
      new DeleteCommand({ TableName: tables().properties, Key: { id: pathId } })
    );
    return ok({ deleted: pathId });
  }

  if (method === "POST" || method === "PATCH") {
    const body = readJson(event);
    if (body === null) {
      return fail(400, "Invalid JSON");
    }
    if (method === "PATCH") {
      if (!pathId) {
        return fail(400, "Missing property id");
      }
      body.id = pathId;
    }
    const checked = validateProperty(body);
    if (checked.error) {
      return fail(400, checked.error);
    }
    const now = new Date().toISOString();
    const existing = await client.send(
      new GetCommand({ TableName: tables().properties, Key: { id: checked.data.id } })
    );
    if (method === "POST" && existing.Item) {
      return fail(409, "That property ID already exists. Load it to edit, or use a new ID.");
    }
    const item = {
      ...(existing.Item || {}),
      ...checked.data,
      createdAt: existing.Item?.createdAt || now,
      updatedAt: now,
    };
    await client.send(new PutCommand({ TableName: tables().properties, Item: item }));
    await client.send(
      new PutCommand({
        TableName: tables().status,
        Item: {
          propertyId: item.id,
          status: item.status,
          updatedAt: now,
        },
      })
    );
    return ok({ item: publicItem(item) }, method === "POST" ? 201 : 200);
  }

  return fail(405, "Method not allowed");
}
