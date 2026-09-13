import { createHash } from "node:crypto";

export function hashIp(ip) {
  if (!ip) {
    return "";
  }
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function lookupGeo(ip) {
  const unknown = { country: "Unknown", region: "Unknown", city: "Unknown" };
  if (!ip || ip.startsWith("127.") || ip === "::1") {
    return unknown;
  }
  try {
    const ctrl = AbortSignal.timeout ? AbortSignal.timeout(1500) : undefined;
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,region,city`, {
      signal: ctrl,
    });
    const json = await res.json();
    if (!json.success) {
      return unknown;
    }
    return {
      country: json.country || "Unknown",
      region: json.region || "Unknown",
      city: json.city || "Unknown",
    };
  } catch (err) {
    console.warn("geo lookup skipped", err);
    return unknown;
  }
}
