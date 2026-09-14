# Properties

Public map catalogue of land parcels for sale. Tap a pin to inspect a listing, then enquire or book a site visit.

This is a static HTML site (Cloudflare Pages) plus an optional AWS SAM API for leads, unique views, active viewers, and listing status. See [docs/redesign-decisions.md](docs/redesign-decisions.md) and [backend/DEPLOY.md](backend/DEPLOY.md).

## Local preview

```bash
python3 -m http.server 8080
```

Open http://127.0.0.1:8080/

Listings come from [data/properties.json](data/properties.json) and from admin-published records on the API. Do not commit title deeds or public Drive links.

## Configure

Edit [js/config.js](js/config.js) after you have:

- `API_BASE` from `sam deploy`
- a referrer-restricted Google Maps JavaScript API key
- reCAPTCHA v2 site key (optional)
- a public contact email (enables mailto fallback)

Admin: `/admin/` (not in the public menu). Password is the SAM `AdminToken`. Document-preview workflow: [docs/admin-document-pack.md](docs/admin-document-pack.md) and `/documents/`.
