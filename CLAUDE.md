# Properties

Static map microsite + AWS SAM backend (`properties-backend`).
Public copy says property or properties.
GitHub repository: https://github.com/propagetech/prashant

- Public listings: `data/properties.json` plus admin-created records from `GET /properties`. No survey numbers, deeds, or Drive URLs.
- Do not invent contact details, prices, or sample parcels.
- Forms: honeypot `website_hp`, store before SES, admin via `x-admin-token`.
- CDN exceptions: Maps JS API and reCAPTCHA only.
- No em or en dashes. Path-portable relative URLs. Contrast audit: `node tools/contrast-audit.mjs`.
