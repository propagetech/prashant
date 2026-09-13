import { randomUUID } from "node:crypto";
import { fail, ok, readJson } from "../lib/respond.js";
import { validateSubmission } from "../lib/validate.js";
import { verifyRecaptcha } from "../lib/recaptcha.js";
import { client, PutCommand, tables } from "../lib/store.js";
import { notifyOwner } from "../lib/ses.js";

export async function handler(event) {
  const body = readJson(event);
  if (body === null) {
    return fail(400, "Invalid JSON");
  }
  const checked = validateSubmission(body);
  if (checked.honeypot) {
    return ok({ ok: true });
  }
  if (checked.error) {
    return fail(400, checked.error);
  }
  const captchaOk = await verifyRecaptcha(body.recaptchaToken || body["g-recaptcha-response"]);
  if (!captchaOk) {
    return fail(400, "Captcha failed");
  }
  const item = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...checked.data,
  };
  await client.send(new PutCommand({ TableName: tables().submissions, Item: item }));
  try {
    await notifyOwner(item);
  } catch (err) {
    console.error("SES notify failed", err);
  }
  return ok({ ok: true, id: item.id });
}
