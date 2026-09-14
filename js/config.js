/**
 * Frontend runtime config. Loaded before main.js.
 *
 * After SAM deploy (backend/DEPLOY.md), set API_BASE to the HttpApi URL.
 * Leave keys empty until the owner supplies them. Empty Maps key: list view only.
 * Empty CONTACT_EMAIL: mailto fallbacks stay disabled; the API form still works.
 *
 * Runtime config for the properties catalogue. Public copy says property or properties.
 */
window.PROPERTIES = window.PROPERTIES || {}; // properties catalogue config
window.PROPERTIES.API_BASE = "https://qa1lggny98.execute-api.ap-south-1.amazonaws.com";
window.PROPERTIES.MAPS_API_KEY = "AIzaSyAJdmK-kXZcOwJIVopmvTsHI8qMJqJ5f64";
window.PROPERTIES.RECAPTCHA_SITE_KEY = "";
window.PROPERTIES.CONTACT_EMAIL = "share.property.documents@gmail.com";
window.PROPERTIES.EXCLUDE_OWNER = false;
