import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function notifyOwner(item) {
  if (process.env.EMAILS_ENABLED !== "true") {
    return;
  }
  const to = process.env.OWNER_EMAIL;
  const from = process.env.SENDER_EMAIL;
  if (!to || !from) {
    return;
  }
  const rows = Object.entries(item)
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(typeof v === "object" ? JSON.stringify(v) : v)}</td></tr>`)
    .join("");
  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `Property lead: ${item.formType} ${item.propertyId || ""}`.trim() }, // public noun: property, not the project key
        Body: {
          Html: { Data: `<table>${rows}</table>` },
          Text: { Data: JSON.stringify(item, null, 2) },
        },
      },
    })
  );
}
