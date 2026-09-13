import { fail, isAuthorized, ok } from "../lib/respond.js";
import { client, ScanCommand, tables } from "../lib/store.js";

function bump(map, key) {
  map[key] = (map[key] || 0) + 1;
}

export async function handler(event) {
  if (!isAuthorized(event)) {
    return fail(401, "Unauthorized");
  }
  const [subs, views, presence, status, listings] = await Promise.all([
    client.send(new ScanCommand({ TableName: tables().submissions })),
    client.send(new ScanCommand({ TableName: tables().views })),
    client.send(new ScanCommand({ TableName: tables().presence })),
    client.send(new ScanCommand({ TableName: tables().status })),
    client.send(new ScanCommand({ TableName: tables().properties })),
  ]);
  const cutoff = Date.now() - 5 * 60 * 1000;
  const byProp = {};
  function row(id) {
    if (!byProp[id]) {
      byProp[id] = {
        propertyId: id,
        uniqueViews: 0,
        activeSessions: 0,
        enquiry: 0,
        "document-request": 0,
        "site-visit": 0,
        offer: 0,
        status: "",
      };
    }
    return byProp[id];
  }
  (views.Items || []).forEach((item) => {
    row(item.propertyId).uniqueViews += 1;
  });
  (presence.Items || []).forEach((item) => {
    if (Date.parse(item.lastSeen || 0) >= cutoff) {
      row(item.propertyId).activeSessions += 1;
    }
  });
  (subs.Items || []).forEach((item) => {
    const r = row(item.propertyId || "unspecified");
    if (r[item.formType] !== undefined) {
      r[item.formType] += 1;
    }
  });
  (listings.Items || []).forEach((item) => {
    if (item.id) {
      row(item.id).status = item.status || row(item.id).status;
    }
  });
  (status.Items || []).forEach((item) => {
    row(item.propertyId).status = item.status;
  });
  const cities = {};
  (views.Items || []).forEach((item) => {
    const key = `${item.city || "Unknown"}|${item.region || "Unknown"}`;
    bump(cities, key);
  });
  const channels = {};
  (views.Items || []).concat(subs.Items || []).forEach((item) => {
    const utm = item.utm || {};
    const key = `${utm.utm_source || "direct"}|${utm.utm_medium || ""}|${utm.utm_campaign || ""}`;
    bump(channels, key);
  });
  const properties = Object.values(byProp);
  const totals = properties.reduce(
    (acc, p) => {
      acc.uniqueViews += p.uniqueViews;
      acc.activeSessions += p.activeSessions;
      acc.leads += p.enquiry + p["document-request"] + p["site-visit"] + p.offer;
      acc.offers += p.offer;
      return acc;
    },
    { uniqueViews: 0, activeSessions: 0, leads: 0, offers: 0 }
  );
  return ok({
    totals,
    properties,
    cities: Object.entries(cities).map(([k, count]) => {
      const [city, region] = k.split("|");
      return { city, region, count };
    }),
    channels: Object.entries(channels).map(([k, count]) => {
      const [utm_source, utm_medium, utm_campaign] = k.split("|");
      return { utm_source, utm_medium, utm_campaign, count };
    }),
  });
}
