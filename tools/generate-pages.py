# Generate path-portable HTML pages for the properties microsite.
from pathlib import Path

# Public brand.
BRAND = "Properties"

ROOT = Path(__file__).resolve().parents[1]

NAV = [
    ("properties", "Properties", "HOME"),
    ("how", "How it works", "how-it-works/"),
    ("faq", "FAQ", "faq/"),
    ("contact", "Contact", "contact/"),
]


def p(depth, rel):
    if rel == "HOME":
        return "./" if depth == 0 else "../"
    prefix = "" if depth == 0 else "../"
    return prefix + rel


def asset(depth, path):
    return ("" if depth == 0 else "../") + path


def header(depth, current):
    home = p(depth, "HOME")
    contact = p(depth, "contact/")
    items = []
    for key, label, rel in NAV:
        href = p(depth, rel)
        cur = ' aria-current="page"' if key == current else ""
        items.append(f'          <li><a href="{href}"{cur}>{label}</a></li>')
    nav = "\n".join(items)
    return f"""<header class="site-header">
  <div class="wrap topbar">
    <a class="brand" href="{home}">{BRAND}</a>
    <button type="button" class="theme-toggle" aria-label="Use light theme">
      <svg class="theme-icon theme-icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M4.93 4.93l1.06 1.06M18.01 18.01l1.06 1.06M3 12h1.5M19.5 12H21M4.93 19.07l1.06-1.06M18.01 5.99l1.06-1.06"/></svg>
      <svg class="theme-icon theme-icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z"/></svg>
    </button>
    <button type="button" class="nav-toggle" aria-controls="site-nav" aria-expanded="false">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Primary">
      <ul>
{nav}
      </ul>
    </nav>
    <a class="btn btn-primary header-cta" href="{contact}">Enquire</a>
  </div>
</header>"""


def footer(depth):
    home = p(depth, "HOME")
    return f"""<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="footer-brand">{BRAND}</p>
      <p>Independent land listings. Public reference IDs only. Title papers stay off this site until a request is approved.</p>
    </div>
    <div>
      <p class="eyebrow">Explore</p>
      <p><a href="{home}">Properties map</a><br>
      <a href="{p(depth, 'how-it-works/')}">How it works</a><br>
      <a href="{p(depth, 'faq/')}">FAQ</a><br>
      <a href="{p(depth, 'contact/')}">Contact</a></p>
    </div>
    <div>
      <p class="eyebrow">Legal</p>
      <p><a href="{p(depth, 'privacy/')}">Privacy</a><br>
      <a href="{p(depth, 'terms/')}">Terms</a><br>
      <a href="{p(depth, 'disclaimer/')}">Disclaimer</a></p>
    </div>
  </div>
  <div class="wrap"><p class="muted">Boundary maps are for location reference only.</p></div>
</footer>
<div class="consent-banner" id="consent-banner" role="dialog" aria-modal="true" aria-labelledby="consent-title">
  <div class="consent-card">
    <p class="eyebrow" id="consent-title">Before you continue</p>
    <p>We use a first-party cookie for unique listing views, active-viewer counts, and anonymous analytics. Agree to continue. See the <a href="{p(depth, 'privacy/')}">privacy notice</a>.</p>
    <div class="action-row">
      <button type="button" class="btn btn-gold" data-consent="all">Agree to analytics</button>
    </div>
  </div>
</div>"""


def shell(depth, title, description, current, body, extra_head="", schema=None):
    canon = ""
    schema_tag = ""
    if schema:
        import json
        schema_tag = f'\n  <script type="application/ld+json">{json.dumps(schema, ensure_ascii=True)}</script>'
    css = asset(depth, "css/main.css")
    cfg = asset(depth, "js/config.js")
    js = asset(depth, "js/main.js")
    ico = asset(depth, "imgs/icon.svg")
    return f"""<!DOCTYPE html>
<html lang="en" class="consent-pending">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="theme-color" content="#16130f">
  <script>
    (function () {{
      var stored = null;
      try {{
        stored = localStorage.getItem("properties-theme");
      }} catch (err) {{}}
      var theme = stored === "light" || stored === "dark"
        ? stored
        : (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.style.colorScheme = theme;
      try {{
        var agreed = document.cookie.split(";").some(function (part) {{
          return part.trim() === "properties-consent=all";
        }});
        if (agreed) {{
          document.documentElement.classList.remove("consent-pending");
        }}
      }} catch (err) {{}}
    }})();
  </script>
  <link rel="icon" href="{ico}" type="image/svg+xml">
  <link rel="preload" href="{asset(depth, 'fonts/manrope-latin-400-normal.woff2')}" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="{asset(depth, 'fonts/Coconat-Demi.woff2')}" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="{css}">
  {extra_head}{schema_tag}
</head>
<body>
{header(depth, current)}
<main>
{body}
</main>
{footer(depth)}
<script src="{cfg}" defer></script>
<script src="{js}" defer></script>
</body>
</html>
"""


home_schema = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": BRAND,
    "description": "Public map of land parcels for sale. Tap a pin to inspect a listing, then enquire or submit an offer.",
}

faq_qas = [
    (
        "Are the map boundaries a legal survey?",
        "No. The coloured outline is for location reference and visual understanding only. Buyers must independently verify survey, title, dimensions, access, encumbrance, zoning, and approvals before making an offer.",
    ),
    (
        "Why do listings use codes like BLR-PLT-01?",
        "Public pages use a property reference instead of survey numbers or ownership details. Sensitive records stay off this site. Use Contact if you need more information.",
    ),
    (
        "Can I download sale deeds from this site?",
        "No. Sale deeds, encumbrance certificates, RTC extracts, and identity documents are not published here. Use Contact if you need more information.",
    ),
    (
        "What do the view counts mean?",
        "Property-page views are unique sessions for that listing. Active viewers are sessions that sent a heartbeat in the last five minutes. These are not site visits and are not buyer identities.",
    ),
    (
        "How do I visit a plot?",
        "Open the listing and use Request a site visit, or Get directions for the approximate location. Confirm access with us before travelling.",
    ),
]

faq_schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
        for q, a in faq_qas
    ],
}

pages = []

pages.append((
    ROOT / "index.html",
    0,
    "Properties for sale",
    "Map of land parcels for sale. Tap a pin to inspect a listing.",
    "properties",
    """  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Properties for sale</p>
      <h1>Inspect each parcel on the map</h1>
      <p class="lede">Click a coloured land boundary, not just a pin. Each listing uses a public reference ID, photos, and listing date. Title papers stay off this page.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#listings">View listings</a>
        <a class="btn btn-secondary" href="how-it-works/">How it works</a>
      </div>
    </div>
  </section>
  <section class="map-section" id="map">
    <div class="map-bleed">
      <div class="map-shell" id="map-shell">
        <div class="map-chrome">
          <p class="map-hint">Tap a pin</p>
          <button type="button" class="map-full-btn" id="map-full-btn" aria-expanded="false" aria-controls="property-map">Full map</button>
        </div>
        <a class="map-jump" href="#listings">See listings</a>
        <div id="property-map" role="region" aria-label="Property map"></div>
        <div class="map-empty" id="map-empty">
          <p class="eyebrow">Catalogue</p>
          <h2>Listings are being prepared</h2>
          <p>Parcel boundaries and photographs will appear here once they are supplied. You can still read how visits and offers work, or send a general enquiry.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="contact/">Send an enquiry</a>
            <a class="btn btn-secondary" href="how-it-works/">How it works</a>
          </div>
        </div>
        <div class="map-fallback" id="map-fallback" hidden>
          <p class="eyebrow">Map</p>
          <h2>Interactive map is unavailable</h2>
          <p>Listings still appear as cards below. The parcel map loads when Google Maps accepts this domain.</p>
          <p id="map-place-link"></p>
        </div>
      </div>
    </div>
    <div class="wrap">
      <p class="disclaimer-note">Boundary shown is for location reference and visual understanding only. Buyers must independently verify survey, title, dimensions, access, encumbrance, zoning, and approvals before making an offer.</p>
    </div>
  </section>
  <section class="section" id="listings">
    <div class="wrap">
      <p class="eyebrow">All parcels</p>
      <h2>Listings</h2>
      <p class="muted" id="listings-empty">No public parcels are published yet. This list stays empty until real listing data is added. It does not use sample plots.</p>
      <ul class="property-list" id="property-list"></ul>
    </div>
  </section>
""",
    home_schema,
    "",
))

pages.append((
    ROOT / "property" / "index.html",
    1,
    "Property dossier",
    "Public summary for a land parcel: extent, location, listing date, and next steps.",
    "properties",
    """  <section class="hero">
    <div class="wrap">
      <p class="eyebrow" id="prop-id">Property</p>
      <h1 id="prop-title">Property dossier</h1>
      <p class="lede" id="prop-lede">Open a listing from the map. This page shows the public summary only.</p>
      <p><span class="status status-available" id="prop-status" hidden></span></p>
      <div class="card-grid" id="prop-facts"></div>
      <details class="more-facts" id="prop-stats">
        <summary>Listing activity</summary>
        <div class="stats-row muted">
          <p>Listed: <span id="stat-listed">Not published</span></p>
          <p>Property-page views: <span id="stat-views">Not yet counted</span></p>
          <p>Active viewers: <span id="stat-live">Defined as sessions with a heartbeat in the last five minutes</span></p>
        </div>
      </details>
      <div class="hero-actions action-row" id="prop-actions"></div>
    </div>
  </section>
  <section class="map-section" id="map">
    <div class="map-bleed">
      <div class="map-shell" id="map-shell">
        <div class="map-chrome">
          <p class="map-hint">This parcel on the map</p>
          <button type="button" class="map-full-btn" id="map-full-btn" aria-expanded="false" aria-controls="property-map">Full map</button>
        </div>
        <a class="map-jump" href="#prop-title">Parcel details</a>
        <div id="property-map" role="region" aria-label="This parcel on the map"></div>
        <div class="map-empty" id="map-empty">
          <h2>Select a listing</h2>
          <p>This page needs a property id in the address, for example <code>?id=BLR-PLT-01</code>.</p>
          <a class="btn btn-primary" href="../">Back to the map</a>
        </div>
        <div class="map-fallback" id="map-fallback" hidden>
          <p class="eyebrow">Map</p>
          <h2>Open this pin on Google Maps</h2>
          <p>The interactive map is unavailable on this domain. Use the place link until Maps is authorised.</p>
          <p id="map-place-link"></p>
        </div>
      </div>
    </div>
    <div class="wrap">
      <p class="disclaimer-note">Boundary shown is for location reference and visual understanding only. Buyers must independently verify survey, title, dimensions, access, encumbrance, zoning, and approvals before making an offer.</p>
    </div>
  </section>
""",
    None,
    "",
))

pages.append((
    ROOT / "photos" / "index.html",
    1,
    "Property photographs",
    "Photograph gallery for a public land listing.",
    "properties",
    """  <section class="hero">
    <div class="wrap">
      <p class="eyebrow" id="prop-id">Photos</p>
      <h1 id="prop-title">Photographs</h1>
      <p class="lede">Public photos only. Layout sketches and legal plans are not published here.</p>
      <div class="gallery" id="photo-gallery"></div>
      <p class="muted" id="photos-empty">No photographs are published for this reference yet.</p>
      <p><a class="btn btn-secondary" href="../">Back to the map</a></p>
    </div>
  </section>
""",
    None,
    "",
))


def form_page(title_text, h1, lede, form_type, extra_fields, submit_label):
    extra = "\n".join(extra_fields)
    return f"""  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Buyers</p>
      <h1>{h1}</h1>
      <p class="lede">{lede}</p>
      <form class="form js-lead-form" method="post" data-form-type="{form_type}" action="../contact/">
        <input class="hp" type="text" name="website_hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label>Property ID
          <input name="propertyId" id="field-property-id" required maxlength="40" placeholder="BLR-PLT-01">
        </label>
        <label>Name
          <input name="name" required maxlength="80" autocomplete="name">
        </label>
        <label>Mobile number
          <input name="mobile" required maxlength="20" autocomplete="tel">
        </label>
        <label>Email
          <input name="email" type="email" required maxlength="120" autocomplete="email">
        </label>
        {extra}
        <label>Message
          <textarea name="message" maxlength="2000"></textarea>
        </label>
        <label class="consent"><input type="checkbox" name="consent" value="yes" required> I agree to be contacted about this property and to the processing described in the privacy notice. This box is not pre-ticked.</label>
        <div class="g-recaptcha" data-sitekey=""></div>
        <button class="btn btn-primary" type="submit">{submit_label}</button>
        <p class="form-status" role="status"></p>
        <p class="muted js-mailto-fallback" hidden></p>
      </form>
    </div>
  </section>
"""


pages.append((
    ROOT / "submit-offer" / "index.html",
    1,
    "Submit an offer",
    "Send an offer amount and contact details for a public property reference.",
    "contact",
    form_page(
        "Submit an offer",
        "Submit an offer",
        "Include the property reference, your offer, and how you plan to fund it. Offers are reviewed privately. This page does not publish other buyers' bids.",
        "offer",
        [
            """<label>Buyer type
          <select name="buyerType" required>
            <option value="">Select</option>
            <option>Self-use</option>
            <option>Investor</option>
            <option>Broker</option>
          </select>
        </label>""",
            """<label>Budget range
          <input name="budgetRange" maxlength="80">
        </label>""",
            """<label>Offer amount
          <input name="offerAmount" required maxlength="80">
        </label>""",
            """<label>Funding
          <select name="funding" required>
            <option value="">Select</option>
            <option>Cash</option>
            <option>Loan</option>
            <option>Mixed</option>
          </select>
        </label>""",
            """<label>Purchase timeline
          <select name="timeline">
            <option value="">Select</option>
            <option>Immediate</option>
            <option>Within 3 months</option>
            <option>3 to 6 months</option>
            <option>Exploring</option>
          </select>
        </label>""",
        ],
        "Submit offer",
    ),
    None,
    "",
))

pages.append((
    ROOT / "site-visit" / "index.html",
    1,
    "Request a site visit",
    "Ask to inspect a listed parcel in person.",
    "contact",
    form_page(
        "Site visit",
        "Request a site visit",
        "Tell us which parcel and a preferred date. A page view is not a site visit. We confirm access before you travel.",
        "site-visit",
        [
            """<label>Preferred site-visit date
          <input name="visitDate" type="date">
        </label>""",
            """<label>Buyer type
          <select name="buyerType">
            <option value="">Select</option>
            <option>Self-use</option>
            <option>Investor</option>
            <option>Broker</option>
          </select>
        </label>""",
        ],
        "Request visit",
    ),
    None,
    "",
))

pages.append((
    ROOT / "how-it-works" / "index.html",
    1,
    "How it works",
    "How to inspect a parcel on the map, enquire, visit, and offer.",
    "how",
    """  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Process</p>
      <h1>From map click to offer</h1>
      <p class="lede">A short path designed for serious buyers. No public Drive links. No manufactured urgency.</p>
      <ol class="steps">
        <li>
          <h2>Open the map</h2>
          <p>Every published parcel is a pin. Click the pin. If a boundary has been added, the outline appears then.</p>
        </li>
        <li>
          <h2>Read the public card</h2>
          <p>You see the reference ID, location text, extent, listing date, and real view figures when the API is live.</p>
        </li>
        <li>
          <h2>Inspect photos and the dossier</h2>
          <p>Photographs and a basic summary can be public. Original legal files are not.</p>
        </li>
        <li>
          <h2>Send an enquiry</h2>
          <p>Use Contact or I am interested on a listing. We reply privately. Legal files stay off the public site.</p>
        </li>
        <li>
          <h2>Visit and offer</h2>
          <p>Book a site visit, then submit an offer with funding and timeline. Status may move from Available to Under offer to Sold.</p>
        </li>
      </ol>
      <p><a class="btn btn-primary" href="../">View properties</a></p>
    </div>
  </section>
""",
    None,
    "",
))

faq_items = "\n".join(
    f"""      <article class="card">
        <h2>{q}</h2>
        <p>{a}</p>
      </article>"""
    for q, a in faq_qas
)

pages.append((
    ROOT / "faq" / "index.html",
    1,
    "FAQ",
    "Answers about boundaries, documents, view counts, and site visits.",
    "faq",
    f"""  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Questions</p>
      <h1>FAQ</h1>
      <div class="card-grid">
{faq_items}
      </div>
    </div>
  </section>
""",
    faq_schema,
    "",
))

pages.append((
    ROOT / "contact" / "index.html",
    1,
    "Contact",
    "Send an enquiry about a land listing. Include the property ID if you have one.",
    "contact",
    form_page(
        "Contact",
        "Contact",
        "Use this form to enquire about a listing. Include the property ID if you have one. We will reply using the mobile number and email you provide.",
        "enquiry",
        [
            """<label>Buyer type
          <select name="buyerType">
            <option value="">Select</option>
            <option>Self-use</option>
            <option>Investor</option>
            <option>Broker</option>
          </select>
        </label>""",
        ],
        "Send enquiry",
    ),
    None,
    "",
))

pages.append((
    ROOT / "privacy" / "index.html",
    1,
    "Privacy notice",
    "What this site collects, why, how long, and how to withdraw consent.",
    "contact",
    """  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Legal</p>
      <h1>Privacy notice</h1>
      <p class="lede">This notice covers cookies, form submissions, and anonymous listing analytics on this site.</p>
      <h2>What we collect</h2>
      <p>When you open a listing we create an anonymous session ID in your browser and may record a unique view and a heartbeat while the tab is visible. Forms collect name, mobile, email, property ID, commercial fields you type, and consent. We derive a coarse city or region from IP address for internal demand only. We do not store the raw IP in public interfaces. We do not ask for precise GPS unless you press a control such as Show distance from me.</p>
      <h2>Why</h2>
      <p>To show the listing, count unique views, show active sessions in the last five minutes, answer enquiries, and share documents with people who asked for them.</p>
      <h2>Consent</h2>
      <p>Using this site requires agreeing to anonymous analytics. That choice is stored in a first-party cookie on your browser. Marketing contact still needs a separate, unticked action on forms.</p>
      <h2>Retention</h2>
      <p>Anonymous analytics: delete or aggregate after 90 days. Unqualified enquiries: review after 6 to 12 months. Serious buyer records: retain only as needed for the transaction and legal duties.</p>
      <h2>Your choices</h2>
      <p>The overlay stays until you press Agree to analytics. To withdraw later, delete that cookie in your browser or use the contact form.</p>
    </div>
  </section>
""",
    None,
    "",
))

pages.append((
    ROOT / "terms" / "index.html",
    1,
    "Terms",
    "Terms for using the public listing map and sending enquiries.",
    "contact",
    """  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Legal</p>
      <h1>Terms of use</h1>
      <p>This website is an information and enquiry channel for land listings. It is not a completed sale, allotment, or legal advice.</p>
      <p>You must not scrape personal data, attempt to bypass document controls, or submit false offers. We may refuse or delete submissions that look like spam.</p>
      <p>Listing status can change. Sold means the public catalogue should no longer present the parcel as available.</p>
    </div>
  </section>
""",
    None,
    "",
))

pages.append((
    ROOT / "disclaimer" / "index.html",
    1,
    "Disclaimer",
    "Map boundaries are not a cadastral survey. Buyers must verify title independently.",
    "contact",
    """  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Legal</p>
      <h1>Disclaimer</h1>
      <p>Boundary shown is for location reference and visual understanding only. Buyers must independently verify survey, title, dimensions, access, encumbrance, zoning, and approvals before making an offer.</p>
      <p>Photographs, extents, and price guidance are as supplied for marketing. They may be approximate. Public view counts are unique listing sessions, not a promise of demand and not a record of physical visits.</p>
      <p>Controlled documents, when shared, are for due diligence. They may be watermarked. Forwarding them without permission is not allowed.</p>
    </div>
  </section>
""",
    None,
    "",
))

admin_body = """  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Internal</p>
      <h1>Demand desk</h1>
      <p class="lede">Password is the API admin token. This page is not linked from the public menu and should stay out of search. <a href="../documents/">Collect document previews</a> is the Drive pack guide.</p>
      <form class="form" id="admin-login">
        <label>Admin token
          <input type="password" id="admin-token" autocomplete="current-password" required>
        </label>
        <button class="btn btn-primary" type="submit">Open dashboard</button>
        <p class="form-status" role="status"></p>
      </form>
      <div id="admin-app" hidden>
        <div class="kpi-grid" id="admin-kpis"></div>
        <p><a class="btn btn-secondary" href="../documents/">Document preview guide</a></p>
        <h2>Listings</h2>
        <div class="listings-toolbar">
          <button type="button" class="btn btn-primary" id="admin-add-listing">Add listing</button>
          <label class="listings-search">Search
            <input id="admin-listing-search" type="search" autocomplete="off" placeholder="ID, title, or place">
          </label>
          <label>Sort
            <select id="admin-listing-sort">
              <option value="id">Property ID</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
              <option value="listingDate">Listing date</option>
              <option value="uniqueViews">Views</option>
              <option value="leads">Leads</option>
            </select>
          </label>
        </div>
        <div class="table-scroll"><table id="admin-listings">
          <thead>
            <tr>
              <th><button type="button" class="sort-btn" data-sort="id" aria-sort="ascending">ID</button></th>
              <th><button type="button" class="sort-btn" data-sort="title" aria-sort="none">Title</button></th>
              <th><button type="button" class="sort-btn" data-sort="location" aria-sort="none">Location</button></th>
              <th><button type="button" class="sort-btn" data-sort="status" aria-sort="none">Status</button></th>
              <th><button type="button" class="sort-btn" data-sort="uniqueViews" aria-sort="none">Views</button></th>
              <th><button type="button" class="sort-btn" data-sort="leads" aria-sort="none">Leads</button></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table></div>
        <form class="form admin-editor" id="admin-property-form">
          <h2>Add or edit a listing</h2>
          <p class="muted">Paste a Google Maps place URL to drop a pin. The public map shows that pin until someone clicks it. Click the map to add boundary corners only if you have a traced outline. Two points make a rectangle. Three or more make a parcel outline. Do not enter survey numbers, deeds, or Drive links.</p>
          <label>Load existing
            <select id="admin-load-id">
              <option value="">New listing</option>
            </select>
          </label>
          <div class="admin-editor-grid">
            <div class="admin-editor-fields">
              <label>Property ID
                <input id="admin-prop-id" name="id" required maxlength="40" autocomplete="off" placeholder="BLR-PLT-02">
              </label>
              <label>Title
                <input id="admin-prop-title" name="title" required maxlength="120" autocomplete="off">
              </label>
              <label>Location text
                <input id="admin-prop-location" name="location" maxlength="200" autocomplete="off">
              </label>
              <label>Status
                <select id="admin-prop-status">
                  <option>Available</option>
                  <option>Under offer</option>
                  <option>Sold</option>
                </select>
              </label>
              <label>Listing date
                <input id="admin-prop-date" type="date">
              </label>
              <label>Extent
                <input id="admin-prop-area" maxlength="80" autocomplete="off">
              </label>
              <label>Dimensions
                <input id="admin-prop-dimensions" maxlength="80" autocomplete="off">
              </label>
              <label>Road access
                <input id="admin-prop-road" maxlength="120" autocomplete="off">
              </label>
              <label>Land type
                <input id="admin-prop-type" maxlength="80" autocomplete="off">
              </label>
              <label>Facing
                <input id="admin-prop-facing" maxlength="40" autocomplete="off">
              </label>
              <label>Price guidance
                <input id="admin-prop-price" maxlength="80" autocomplete="off" placeholder="Call for price">
              </label>
              <label>Google Maps place URL
                <input id="admin-prop-place" type="url" maxlength="800" autocomplete="off">
              </label>
              <label>Boundary note
                <textarea id="admin-prop-note" maxlength="400"></textarea>
              </label>
              <label class="consent"><input type="checkbox" id="admin-prop-hidden"> Hide from the public map</label>
            </div>
            <div class="admin-editor-map-col">
              <label>Find a place
                <span class="admin-search-row">
                  <input id="admin-map-search" maxlength="200" autocomplete="off" placeholder="Place name or address">
                  <button type="button" class="btn btn-secondary" id="admin-map-find">Find on map</button>
                </span>
              </label>
              <div class="map-shell admin-map-shell" id="admin-map-shell">
                <div class="map-chrome">
                  <p class="map-hint" id="admin-map-hint">Tap to add a corner</p>
                  <button type="button" class="map-full-btn" id="admin-map-full-btn" aria-expanded="false" aria-controls="admin-editor-map">Full map</button>
                </div>
                <div id="admin-editor-map" role="region" aria-label="Listing map editor"></div>
                <div class="coord-toolbar admin-map-tools">
                  <button type="button" class="btn btn-secondary" id="admin-undo-point">Undo last point</button>
                  <button type="button" class="btn btn-secondary" id="admin-clear-points">Clear points</button>
                </div>
              </div>
              <label>Latitude, longitude
                <textarea id="admin-coords" rows="6" placeholder="12.9321855, 77.8694882"></textarea>
              </label>
            </div>
          </div>
          <div class="action-row">
            <button class="btn btn-primary" type="submit">Publish listing</button>
            <button class="btn btn-secondary" type="button" id="admin-delete-prop" hidden>Remove from catalogue</button>
          </div>
          <p class="form-status" role="status"></p>
        </form>
        <h2>Cities (internal)</h2>
        <div class="table-scroll"><table id="admin-cities"><thead><tr><th>City</th><th>Region</th><th>Views</th></tr></thead><tbody></tbody></table></div>
        <h2>Channels</h2>
        <div class="table-scroll"><table id="admin-utm"><thead><tr><th>Source</th><th>Medium</th><th>Campaign</th><th>Count</th></tr></thead><tbody></tbody></table></div>
        <h2>Recent leads</h2>
        <div class="table-scroll"><table id="admin-leads"><thead><tr><th>When</th><th>Type</th><th>Property</th><th>Name</th><th>Mobile</th></tr></thead><tbody></tbody></table></div>
      </div>
    </div>
  </section>
"""

pages.append((
    ROOT / "admin" / "index.html",
    1,
    "Demand desk",
    "Internal demand dashboard.",
    "admin",
    admin_body,
    None,
    '<meta name="robots" content="noindex, nofollow">\n  ',
))

# documents/index.html is hand-maintained. Do not overwrite it here.

for path, depth, title, desc, current, body, schema, extra in pages:
    path.parent.mkdir(parents=True, exist_ok=True)
    html = shell(depth, title, desc, current, body, extra_head=extra, schema=schema)
    path.write_text(html, encoding="utf-8")
    print("wrote", path.relative_to(ROOT))

print("done", len(pages))
