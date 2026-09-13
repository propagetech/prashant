const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

export function validateSubmission(body) {
  if (!body || typeof body !== "object") {
    return { error: "Invalid JSON" };
  }
  if (clip(body.website_hp, 200)) {
    return { honeypot: true };
  }
  const formType = clip(body.formType, 40);
  const allowed = ["enquiry", "document-request", "site-visit", "offer"];
  if (!allowed.includes(formType)) {
    return { error: "Unknown form type" };
  }
  const name = clip(body.name, 80);
  const mobile = clip(body.mobile, 20);
  const email = clip(body.email, 120);
  if (!name || !mobile) {
    return { error: "Name and mobile are required" };
  }
  if (!email || !EMAIL.test(email)) {
    return { error: "A valid email is required" };
  }
  if (body.consent !== true && body.consent !== "yes") {
    return { error: "Consent is required" };
  }
  const propertyId = clip(body.propertyId, 40);
  if (formType !== "enquiry" && !propertyId) {
    return { error: "Property ID is required" };
  }
  if (formType === "offer" && !clip(body.offerAmount, 80)) {
    return { error: "Offer amount is required" };
  }
  return {
    data: {
      formType,
      propertyId,
      name,
      mobile,
      email,
      buyerType: clip(body.buyerType, 40),
      budgetRange: clip(body.budgetRange, 80),
      offerAmount: clip(body.offerAmount, 80),
      funding: clip(body.funding, 40),
      timeline: clip(body.timeline, 40),
      visitDate: clip(body.visitDate, 40),
      message: clip(body.message, 2000),
      consent: true,
      source: clip(body.source, 200),
      utm: body.utm && typeof body.utm === "object" ? body.utm : {},
    },
  };
}

export function isBot(ua) {
  return /bot|crawler|spider|preview/i.test(ua || "");
}
