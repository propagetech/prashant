# Properties: redesign decisions

Source of truth for facts, IA, art direction, and owner gaps. Do not invent contact details, prices, parcel geometry, testimonials, or credentials.

## Business and buyer

**What it is:** A public map catalogue of land parcels for sale. Buyers inspect approximate boundaries, photos, and a non-sensitive summary, then enquire or book a site visit.

**Buyer:** Self-use buyers, investors, and agents looking at Bengaluru-region plots. Decision weight is high (title, access, dimensions, price).

**Primary action:** Submit a qualified enquiry with a property reference (for example `BLR-PLT-01`). Secondary: a site visit.

**Objections (FAQ drivers):** Is the boundary legal? Can I see title papers? Is the listing current? Who is selling? How do I visit? Why should I trust view counts?

## Competitor scan (live web, September 2026)

| Source | Positioning | Emphasis | Gaps we can own |
| --- | --- | --- | --- |
| 99acres | City-wide marketplace, plots as one tab among flats | Filters, locality pages, volume | Pins and cards, not owner-traced parcel polygons; "verified" is listing hygiene, not title |
| MagicBricks | Same marketplace pattern; BIAAPA / BDA / BMRDA filters | Approval labels, Devanahalli cluster pages | No seller-controlled document workflow; urgency badges are platform-led |
| Housing.com / similar portals | Discovery and lead routing to agents | Photos and price | No controlled due-diligence folder; public IDs mix with survey chatter |
| Direct agent WhatsApp / Facebook | Fast contact | Photos, location pin | No durable listing page, no listing date, no privacy-safe metrics |

**How we differ:** One seller catalogue, clickable **land polygons**, public reference IDs instead of survey numbers, listing dates, real (not theatrical) activity metrics, and title papers kept off the public site. Boundaries are labelled as location reference, not cadastral survey.

## Keywords mapped to pages

| Cluster | Page | Where used |
| --- | --- | --- |
| plots for sale Bengaluru / land parcels map | Home | title, H1, intro, schema |
| plot boundary map / property location | Home, property | H2, disclaimer, alt |
| plot enquiry Bengaluru | contact | H1, form |
| site visit plot Bengaluru | site-visit | H1, form |
| how plot purchase works | how-it-works | H1, steps |
| plot listing FAQ title EC khata | faq | questions matching visible answers |

No keyword stuffing. No locality names in titles until a real parcel is supplied.

## Lead-gen IA

Menu is the buyer journey, not an org chart: Properties (map), How it works, FAQ, Contact. Primary CTA: Enquire.

| Page | One job | Primary CTA |
| --- | --- | --- |
| Home | See every parcel on a map | Open a parcel / enquire |
| Property | Decide if this plot is worth a visit | Enquire |
| Photos | Inspect the land visually | Enquire |
| Site visit | Schedule inspection | Request visit |
| How it works | Reduce process anxiety | View properties |
| FAQ | Handle objections | Contact |
| Contact | Reach the seller | Send enquiry |
| Privacy / terms / disclaimer | Legal and DPDP clarity | (none) |
| Admin | Internal demand | (noindex) |

## Art direction

- **Register:** Ultra-luxury / private-client (substantial land holdings)
- **Type:** Coconat (headings, Collletttivo / Sara Lavazza) + Luxurious Script (one short accent phrase per screen) + Manrope (body, nav, buttons, eyebrows). Self-hosted woff2 only. No Google Fonts CDN.
- **Palette:** Espresso field `hsl(32 18% 7%)`, ivory ink `hsl(38 35% 93%)`, champagne `hsl(39 42% 68%)`, map stroke `#c4a574`. Locked AA pairs in `tools/contrast-audit.mjs`.
- **Motion:** Subtle; map is the signature; `prefers-reduced-motion` respected.
- **Signature element:** Full-width parcel map with champagne polygons.
- **Brand:** Text wordmark until a real logo file is supplied. Do not invent a mark.
- **Icons:** Original thin-line SVGs in champagne. No stock photos passed off as project photos.
- Do not publish a rupee figure unless the owner supplies it for that parcel.

## CDN exceptions (only these)

1. Google Maps JavaScript API on pages that draw the map (home, property).
2. Google reCAPTCHA v2 on forms, when a site key is configured.

No Google Fonts, no other script CDNs.

## AWS (house pattern)

Static site: Cloudflare Pages. API: SAM in `ap-south-1`, stack `properties-backend`, tables `properties-*`. Clone of ProPage forms + Motorover SES invariants + Invoices token-gated admin. Not Cloudflare Workers, not S3 website hosting.

## Honesty rules

- Empty `data/properties.json` until the owner supplies parcels. No Devanahalli demo geometry.
- Title PDFs under other folders must never be committed here.
- Public metrics: unique property-page views; active sessions with a heartbeat in the last five minutes. Never "site visits" for page views. Round low counts.
- Listing dates are not reset to look new.
- Sold parcels must not stay marked Available.

## Owner input (blocks go-live, not the engine)

- Canonical domain
- Logo file
- Phone, email, WhatsApp
- Google Maps JS API key (HTTP referrer restricted)
- reCAPTCHA v2 keys
- SES sender / owner inboxes
- Parcel records: id, title, location text, extent, dimensions, access, type, facing, price guidance, listing date, photos, boundary coordinates
- Private Drive folder per property (preview pack: [admin-document-pack.md](admin-document-pack.md))
- Admin token / notification inbox
- Owner-traffic exclusion list

## Retention (stated on privacy page; implement in ops)

- Anonymous analytics: aggregate or delete after 90 days
- Unqualified enquiries: review after 6 to 12 months
- Serious buyer records: retain as needed for the transaction and law
