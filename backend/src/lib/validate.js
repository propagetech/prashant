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

const FORBIDDEN_LISTING = /survey\s*no|survey\s*number|sale\s*deed|encumbrance|drive\.google|docs\.google|aadhaar|\bpan\b/i;
const ID_RE = /^[A-Z0-9][A-Z0-9._-]{1,39}$/;
const MAPS_LINK = /^https:\/\/(www\.google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl)\b/i;

function parsePoint(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

export function parseMapsPlace(url) {
  const text = String(url || "");
  const place3d = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const at = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)([mz]))?/i);
  const dest = text.match(/[?&](?:destination|q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  let lat = null;
  let lng = null;
  if (place3d) {
    lat = Number(place3d[1]);
    lng = Number(place3d[2]);
  } else if (at) {
    lat = Number(at[1]);
    lng = Number(at[2]);
  } else if (dest) {
    lat = Number(dest[1]);
    lng = Number(dest[2]);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  let zoom = 17;
  if (at && at[3] && at[4]) {
    const amount = Number(at[3]);
    if (at[4].toLowerCase() === "z" && Number.isFinite(amount)) {
      zoom = Math.min(21, Math.max(3, Math.round(amount)));
    } else if (at[4].toLowerCase() === "m" && Number.isFinite(amount)) {
      zoom = amount <= 40 ? 20 : amount <= 80 ? 19 : amount <= 150 ? 18 : 17;
    }
  }
  const nameMatch = text.match(/\/maps\/place\/([^/?@]+)/);
  let name = "";
  if (nameMatch) {
    try {
      name = decodeURIComponent(nameMatch[1].replace(/\+/g, " ")).trim();
    } catch (err) {
      name = nameMatch[1].replace(/\+/g, " ").trim();
    }
  }
  return { lat, lng, zoom, name };
}

function rectangleFrom(a, b) {
  const north = Math.max(a.lat, b.lat);
  const south = Math.min(a.lat, b.lat);
  const east = Math.max(a.lng, b.lng);
  const west = Math.min(a.lng, b.lng);
  return [
    { lat: north, lng: west },
    { lat: north, lng: east },
    { lat: south, lng: east },
    { lat: south, lng: west },
  ];
}

function boundaryFromPoints(points, given) {
  if (points.length >= 3) {
    return points;
  }
  if (points.length === 2) {
    return rectangleFrom(points[0], points[1]);
  }
  if (Array.isArray(given) && given.length >= 3) {
    return given.map(parsePoint).filter(Boolean);
  }
  return [];
}

function mapsDir(center) {
  return (
    "https://www.google.com/maps/dir/?api=1&destination=" +
    center.lat +
    "," +
    center.lng
  );
}

export function validateProperty(body) {
  if (!body || typeof body !== "object") {
    return { error: "Invalid JSON" };
  }
  const id = clip(body.id, 40).toUpperCase();
  if (!ID_RE.test(id)) {
    return { error: "Property ID must be 2 to 40 letters, numbers, dots, or hyphens" };
  }
  const title = clip(body.title, 120);
  if (!title) {
    return { error: "Title is required" };
  }
  const location = clip(body.location, 200);
  const placeUrl = clip(body.placeUrl, 800);
  const fields = [title, location, clip(body.area, 80), clip(body.message, 200), placeUrl];
  if (fields.some((value) => FORBIDDEN_LISTING.test(value))) {
    return { error: "Do not include survey numbers, deeds, or Drive links" };
  }
  if (placeUrl && !MAPS_LINK.test(placeUrl)) {
    return { error: "Place link must be a Google Maps URL" };
  }
  const status = clip(body.status, 20) || "Available";
  if (!["Available", "Under offer", "Sold"].includes(status)) {
    return { error: "Status must be Available, Under offer, or Sold" };
  }
  const points = Array.isArray(body.points)
    ? body.points.map(parsePoint).filter(Boolean)
    : [];
  const fromUrl = parseMapsPlace(placeUrl);
  const boundary = boundaryFromPoints(points, body.boundary);
  if (boundary.length > 80) {
    return { error: "Use at most 80 boundary corners" };
  }
  const center =
    parsePoint(body.center) ||
    (fromUrl ? { lat: fromUrl.lat, lng: fromUrl.lng } : null) ||
    points[0] ||
    (boundary.length
      ? {
          lat: boundary.reduce((sum, point) => sum + point.lat, 0) / boundary.length,
          lng: boundary.reduce((sum, point) => sum + point.lng, 0) / boundary.length,
        }
      : null);
  if (!center) {
    return { error: "Paste a Google Maps place URL or add a map point" };
  }
  let listingDate = clip(body.listingDate, 10);
  if (!listingDate) {
    listingDate = new Date().toISOString().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(listingDate)) {
    return { error: "Listing date must be YYYY-MM-DD" };
  }
  const mapsUrl = clip(body.mapsUrl, 500) || mapsDir(center);
  if (mapsUrl && !MAPS_LINK.test(mapsUrl)) {
    return { error: "Directions link must be a Google Maps URL" };
  }
  let boundaryNote = clip(body.boundaryNote, 400);
  if (!boundaryNote && points.length === 2) {
    boundaryNote =
      "Rectangle from two map points. Not a traced or surveyed parcel boundary.";
  }
  return {
    data: {
      id,
      title,
      listingDate,
      status,
      area: clip(body.area, 80),
      dimensions: clip(body.dimensions, 80),
      roadAccess: clip(body.roadAccess, 120),
      landType: clip(body.landType, 80),
      facing: clip(body.facing, 40),
      priceGuidance: clip(body.priceGuidance, 80),
      location,
      center,
      boundary,
      mapsUrl,
      placeUrl,
      photos: [],
      pimPdf: "",
      boundaryNote,
      hidden: body.hidden === true,
    },
  };
}
