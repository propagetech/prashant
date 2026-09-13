/**
 * Frontend runtime config. Loaded before main.js.
 *
 * After SAM deploy (backend/DEPLOY.md), set API_BASE to the HttpApi URL.
 * Leave keys empty until the owner supplies them. Empty Maps key: list view only.
 * Empty CONTACT_EMAIL: mailto fallbacks stay disabled; the API form still works.
 */
window.PRASHANT = window.PRASHANT || {};
window.PRASHANT.API_BASE = "";
window.PRASHANT.MAPS_API_KEY = "";
window.PRASHANT.RECAPTCHA_SITE_KEY = "";
window.PRASHANT.CONTACT_EMAIL = "";
window.PRASHANT.EXCLUDE_OWNER = false;
