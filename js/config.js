/**
 * Frontend runtime config. Loaded before main.js.
 *
 * After SAM deploy (backend/DEPLOY.md), set API_BASE to the HttpApi URL.
 * Leave keys empty until the owner supplies them. Empty Maps key: list view only.
 * Empty CONTACT_EMAIL: mailto fallbacks stay disabled; the API form still works.
 *
 * PRASHANT is the internal project key. Public copy says property or properties.
 */
window.PRASHANT = window.PRASHANT || {}; // properties catalogue config
window.p.API_BASE = "https://qa1lggny98.execute-api.ap-south-1.amazonaws.com";
window.p.MAPS_API_KEY = "AIzaSyAJdmK-kXZcOwJIVopmvTsHI8qMJqJ5f64";
window.p.RECAPTCHA_SITE_KEY = "";
window.p.CONTACT_EMAIL = "share.property.documents@gmail.com";
window.p.EXCLUDE_OWNER = false;
