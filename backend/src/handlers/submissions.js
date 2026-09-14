import { fail, isAuthorized, ok } from "../lib/respond.js";
import { storedFormType } from "../lib/validate.js";
import { client, ScanCommand, tables } from "../lib/store.js";

function publicLead(item) {
  return {
    id: item.id,
    createdAt: item.createdAt,
    formType: storedFormType(item.formType),
    propertyId: item.propertyId,
    name: item.name,
    mobile: item.mobile,
    email: item.email,
    buyerType: item.buyerType,
    budgetRange: item.budgetRange,
    budget: item.budget || "",
    funding: item.funding,
    timeline: item.timeline,
    visitDate: item.visitDate,
    message: item.message,
    consent: item.consent,
    source: item.source,
    utm: item.utm,
  };
}

export async function handler(event) {
  if (!isAuthorized(event)) {
    return fail(401, "Unauthorized");
  }
  const out = await client.send(new ScanCommand({ TableName: tables().submissions }));
  const items = (out.Items || [])
    .map(publicLead)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return ok({ items });
}
