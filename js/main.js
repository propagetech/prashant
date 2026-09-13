(function () {
  "use strict";

  const cfg = window.PRASHANT || {};
  const SESSION_KEY = "prashant-session";
  const CONSENT_KEY = "prashant-consent";
  const OWNER_KEY = "prashant-owner";
  const UTM_KEY = "prashant-utm";
  const HEARTBEAT_MS = 60000;
  const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
  let mapInstance = null;
  let mapExpandBound = false;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function assetUrl(rel) {
    const script = document.querySelector('script[src*="js/main.js"]');
    const base = script ? script.src : new URL("js/main.js", location.href).href;
    return new URL("../" + rel, base).href;
  }

  function pageUrl(rel, query) {
    const url = new URL(rel, assetUrl(""));
    if (query) {
      Object.entries(query).forEach(function ([k, v]) {
        if (v) {
          url.searchParams.set(k, v);
        }
      });
    }
    return url.href;
  }

  function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function isOwnerTraffic() {
    return Boolean(cfg.EXCLUDE_OWNER) || localStorage.getItem(OWNER_KEY) === "1";
  }

  function captureUtm() {
    const params = new URLSearchParams(location.search);
    const utm = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (key) {
      const v = params.get(key);
      if (v) {
        utm[key] = v;
      }
    });
    if (Object.keys(utm).length) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
    }
  }

  function readUtm() {
    try {
      return JSON.parse(sessionStorage.getItem(UTM_KEY) || "{}");
    } catch (err) {
      return {};
    }
  }

  function apiUrl(path) {
    const base = (cfg.API_BASE || "").replace(/\/$/, "");
    return base ? base + path : "";
  }

  async function apiSend(path, options) {
    const url = apiUrl(path);
    if (!url) {
      return null;
    }
    const headers = Object.assign({}, options && options.headers);
    if (options && options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, Object.assign({}, options, { headers }));
    if (!res.ok) {
      const err = new Error("Request failed");
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  function formatDate(iso) {
    if (!iso) {
      return "Not published";
    }
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  }

  function statusClass(status) {
    if (status === "Sold") {
      return "status-sold";
    }
    if (status === "Under offer") {
      return "status-offer";
    }
    return "status-available";
  }

  function statusStyle(status) {
    if (status === "Sold") {
      return { strokeColor: "#64748b", fillColor: "#94a3b8" };
    }
    if (status === "Under offer") {
      return { strokeColor: "#c4893c", fillColor: "#8a5a24" };
    }
    return { strokeColor: "#c4a574", fillColor: "#8a7349" };
  }

  function queryId() {
    return new URLSearchParams(location.search).get("id") || "";
  }

  let catalog = { properties: [] };
  let statusOverlay = {};
  let activePropertyId = "";
  let heartbeatTimer = null;

  function mergedProperty(raw) {
    const overlay = statusOverlay[raw.id] || {};
    return Object.assign({}, raw, overlay.status ? { status: overlay.status } : {});
  }

  function mergeCatalog(fileProps, apiProps) {
    const byId = {};
    (fileProps || []).forEach(function (prop) {
      if (prop && prop.id) {
        byId[prop.id] = prop;
      }
    });
    (apiProps || []).forEach(function (prop) {
      if (prop && prop.id) {
        byId[prop.id] = Object.assign({}, byId[prop.id] || {}, prop);
      }
    });
    return Object.keys(byId)
      .sort()
      .map(function (id) {
        return mergedProperty(byId[id]);
      });
  }

  async function loadCatalog() {
    let fileProps = [];
    try {
      const res = await fetch(assetUrl("data/properties.json"), { cache: "no-store" });
      catalog = await res.json();
      fileProps = catalog.properties || [];
    } catch (err) {
      catalog = { properties: [] };
    }
    let apiProps = [];
    try {
      const live = await apiSend("/properties", { method: "GET" });
      if (live && live.items) {
        apiProps = live.items;
      }
    } catch (err) {
      apiProps = [];
    }
    try {
      const overlay = await apiSend("/listing-status", { method: "GET" });
      if (overlay && overlay.items) {
        overlay.items.forEach(function (row) {
          statusOverlay[row.propertyId] = row;
        });
      }
    } catch (err) {
      statusOverlay = {};
    }
    return mergeCatalog(fileProps, apiProps);
  }

  function renderList(properties) {
    const list = $("#property-list");
    const empty = $("#listings-empty");
    if (!list) {
      return;
    }
    list.innerHTML = "";
    if (!properties.length) {
      if (empty) {
        empty.hidden = false;
      }
      return;
    }
    if (empty) {
      empty.hidden = true;
    }
    properties.forEach(function (prop) {
      const li = document.createElement("li");
      li.className = "card property-card";
      li.innerHTML =
        '<p class="property-id">' +
        escapeHtml(prop.id) +
        '</p><h2>' +
        escapeHtml(prop.title || prop.id) +
        '</h2><p>' +
        escapeHtml(prop.location || "") +
        '</p><p><span class="status ' +
        statusClass(prop.status) +
        '">' +
        escapeHtml(prop.status || "Available") +
        "</span></p><p><a class=\"btn btn-primary\" href=\"" +
        escapeHtml(pageUrl("property/", { id: prop.id })) +
        '">Open dossier</a></p>';
      list.appendChild(li);
    });
  }

  function popupHtml(prop) {
    return (
      '<article class="property-popup">' +
      '<p class="property-id">' +
      escapeHtml(prop.id) +
      "</p><h3>" +
      escapeHtml(prop.title || prop.id) +
      "</h3><p>" +
      escapeHtml(prop.location || "") +
      "</p><p><strong>Extent:</strong> " +
      escapeHtml(prop.area || "On request") +
      (prop.boundaryNote
        ? "</p><p>" + escapeHtml(prop.boundaryNote)
        : "") +
      "</p><p><strong>Listed:</strong> " +
      escapeHtml(formatDate(prop.listingDate)) +
      '</p><p><strong>Views:</strong> <span id="views-' +
      escapeHtml(prop.id) +
      '">Loading</span></p><p><strong>Active viewers:</strong> <span id="live-' +
      escapeHtml(prop.id) +
      '">Loading</span></p><div class="popup-actions">' +
      (prop.mapsUrl
        ? '<a class="btn btn-secondary" href="' +
          escapeHtml(prop.mapsUrl) +
          '" target="_blank" rel="noopener">Get directions</a>'
        : "") +
      '<a class="btn btn-secondary" href="' +
      escapeHtml(pageUrl("photos/", { id: prop.id })) +
      '">View photos</a>' +
      '<a class="btn btn-secondary" href="' +
      escapeHtml(pageUrl("request-documents/", { id: prop.id })) +
      '">Request documents</a>' +
      '<a class="btn btn-primary" href="' +
      escapeHtml(pageUrl("submit-offer/", { id: prop.id })) +
      '">Make an offer</a></div></article>'
    );
  }

  async function loadPropertyStats(propertyId) {
    try {
      const data = await apiSend("/property-stats?id=" + encodeURIComponent(propertyId), { method: "GET" });
      if (!data) {
        return;
      }
      const views = $("#views-" + propertyId) || $("#stat-views");
      const live = $("#live-" + propertyId) || $("#stat-live");
      if (views) {
        views.textContent = data.uniqueViewsLabel || "Not yet counted";
      }
      if (live) {
        live.textContent = data.activeLabel || "No active sessions in the last five minutes";
      }
    } catch (err) {
      const views = $("#views-" + propertyId) || $("#stat-views");
      if (views) {
        views.textContent = "Unavailable";
      }
    }
  }

  async function recordView(propertyId) {
    if (!propertyId || isOwnerTraffic()) {
      return;
    }
    try {
      await apiSend("/property-view", {
        method: "POST",
        body: JSON.stringify({
          propertyId: propertyId,
          sessionId: getSessionId(),
          page: location.pathname,
          occurredAt: new Date().toISOString(),
          utm: readUtm(),
        }),
      });
    } catch (err) {
      /* ignore */
    }
  }

  async function sendPresence(propertyId, eventName) {
    if (!propertyId || isOwnerTraffic() || document.visibilityState !== "visible") {
      return;
    }
    try {
      await apiSend("/presence", {
        method: "POST",
        body: JSON.stringify({
          propertyId: propertyId,
          sessionId: getSessionId(),
          event: eventName || "heartbeat",
          page: location.pathname,
          occurredAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      /* ignore */
    }
  }

  function startPresence(propertyId) {
    activePropertyId = propertyId;
    sendPresence(propertyId, "view_start");
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(function () {
      if (document.visibilityState === "visible" && activePropertyId) {
        sendPresence(activePropertyId, "heartbeat");
      }
    }, HEARTBEAT_MS);
  }

  function drawMap(properties, focusId) {
    const empty = $("#map-empty");
    const fallback = $("#map-fallback");
    const mapEl = $("#property-map");
    if (!mapEl) {
      return;
    }
    const drawable = properties.filter(function (p) {
      return p.boundary && p.boundary.length >= 3;
    });
    if (!drawable.length) {
      if (empty) {
        empty.hidden = false;
      }
      return;
    }
    if (empty) {
      empty.hidden = true;
    }
    if (!cfg.MAPS_API_KEY) {
      if (fallback) {
        fallback.hidden = false;
      }
      const placeBox = $("#map-place-link");
      if (placeBox) {
        const withPlace = drawable.filter(function (p) {
          return p.placeUrl || p.mapsUrl;
        });
        placeBox.innerHTML = withPlace
          .map(function (p) {
            const href = p.placeUrl || p.mapsUrl;
            return (
              '<a class="btn btn-primary" href="' +
              escapeHtml(href) +
              '" target="_blank" rel="noopener">' +
              escapeHtml(p.title || p.id) +
              " on Google Maps</a>"
            );
          })
          .join(" ");
      }
      return;
    }
    if (fallback) {
      fallback.hidden = true;
    }
    loadMapsScript(function () {
      const focus = drawable.find(function (p) {
        return p.id === focusId;
      }) || drawable[0];
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const compact = window.innerWidth < 900;
      const map = new google.maps.Map(mapEl, {
        center: focus.center || focus.boundary[0],
        zoom: drawable.length === 1 ? 17 : 12,
        mapTypeControl: !compact,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
          position: google.maps.ControlPosition.LEFT_BOTTOM,
        },
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: coarse ? "greedy" : "cooperative",
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_BOTTOM,
        },
      });
      mapInstance = map;
      const info = new google.maps.InfoWindow({
        maxWidth: Math.min(320, window.innerWidth - 48),
      });
      drawable.forEach(function (prop) {
        const colors = statusStyle(prop.status);
        const polygon = new google.maps.Polygon({
          paths: prop.boundary,
          strokeColor: colors.strokeColor,
          strokeOpacity: 0.95,
          strokeWeight: 2,
          fillColor: colors.fillColor,
          fillOpacity: 0.28,
          clickable: true,
          map: map,
        });
        polygon.addListener("click", function (event) {
          recordView(prop.id);
          startPresence(prop.id);
          info.setContent(popupHtml(prop));
          info.setPosition(event.latLng);
          info.open({ map: map });
          loadPropertyStats(prop.id);
        });
      });
      setupMapExpand();
    });
  }

  const mapsWaiters = [];

  function loadMapsScript(onReady) {
    if (!cfg.MAPS_API_KEY) {
      return;
    }
    if (window.google && window.google.maps) {
      onReady();
      return;
    }
    mapsWaiters.push(onReady);
    if (document.querySelector("script[data-prashant-maps]")) {
      return;
    }
    window.prashantMapsReady = function () {
      mapsWaiters.splice(0).forEach(function (fn) {
        fn();
      });
    };
    const s = document.createElement("script");
    s.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(cfg.MAPS_API_KEY) +
      "&callback=prashantMapsReady";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-prashant-maps", "1");
    document.head.appendChild(s);
  }

  function fillPropertyPage(properties) {
    const id = queryId();
    const prop = properties.find(function (p) {
      return p.id === id;
    });
    if (!prop) {
      return;
    }
    const empty = $("#map-empty");
    if (empty) {
      empty.hidden = true;
    }
    $("#prop-id").textContent = prop.id;
    $("#prop-title").textContent = prop.title || prop.id;
    $("#prop-lede").textContent = prop.location || "";
    const badge = $("#prop-status");
    badge.hidden = false;
    badge.textContent = prop.status || "Available";
    badge.className = "status " + statusClass(prop.status);
    $("#stat-listed").textContent = formatDate(prop.listingDate);
    const facts = [
      ["Extent", prop.area],
      ["Dimensions", prop.dimensions],
      ["Road access", prop.roadAccess],
      ["Land type", prop.landType],
      ["Facing", prop.facing],
      ["Price guidance", prop.priceGuidance],
      ["Boundary", prop.boundaryNote],
    ];
    const box = $("#prop-facts");
    box.innerHTML = facts
      .filter(function (row) {
        return row[1];
      })
      .map(function (row) {
        return '<article class="card"><h2>' + escapeHtml(row[0]) + "</h2><p>" + escapeHtml(row[1]) + "</p></article>";
      })
      .join("");
    const actions = $("#prop-actions");
    actions.innerHTML =
      (prop.placeUrl
        ? '<a class="btn btn-secondary" href="' + escapeHtml(prop.placeUrl) + '" target="_blank" rel="noopener">Open Google Maps pin</a>'
        : "") +
      (prop.mapsUrl
        ? '<a class="btn btn-secondary" href="' + escapeHtml(prop.mapsUrl) + '" target="_blank" rel="noopener">Get directions</a>'
        : "") +
      '<a class="btn btn-secondary" href="' +
      escapeHtml(pageUrl("photos/", { id: prop.id })) +
      '">View photos</a>' +
      '<a class="btn btn-secondary" href="' +
      escapeHtml(pageUrl("request-documents/", { id: prop.id })) +
      '">Request documents</a>' +
      '<a class="btn btn-secondary" href="' +
      escapeHtml(pageUrl("site-visit/", { id: prop.id })) +
      '">Request a site visit</a>' +
      '<a class="btn btn-primary" href="' +
      escapeHtml(pageUrl("submit-offer/", { id: prop.id })) +
      '">Make an offer</a>';
    recordView(prop.id);
    startPresence(prop.id);
    loadPropertyStats(prop.id);
    drawMap([prop], prop.id);
  }

  function fillPhotos(properties) {
    const id = queryId();
    const prop = properties.find(function (p) {
      return p.id === id;
    });
    const gallery = $("#photo-gallery");
    const empty = $("#photos-empty");
    if (!gallery) {
      return;
    }
    if (prop) {
      $("#prop-id").textContent = prop.id;
      $("#prop-title").textContent = (prop.title || prop.id) + " photographs";
    }
    const photos = (prop && prop.photos) || [];
    if (!photos.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    gallery.innerHTML = photos
      .map(function (src, i) {
        const href = src.indexOf("http") === 0 ? src : assetUrl(src.replace(/^\//, ""));
        return (
          '<a href="' +
          escapeHtml(href) +
          '"><figure><img src="' +
          escapeHtml(href) +
          '" alt="Photograph ' +
          (i + 1) +
          " of " +
          escapeHtml(prop.id) +
          '"><figcaption>Photograph ' +
          (i + 1) +
          "</figcaption></figure></a>"
        );
      })
      .join("");
    if (prop) {
      recordView(prop.id);
      startPresence(prop.id);
    }
  }

  function resizeMap() {
    if (mapInstance && window.google && window.google.maps) {
      google.maps.event.trigger(mapInstance, "resize");
    }
  }

  function setupMapExpand() {
    const shell = $("#map-shell");
    const btn = $("#map-full-btn");
    const jump = $(".map-jump");
    if (!shell || !btn || mapExpandBound) {
      return;
    }
    mapExpandBound = true;
    let isFull = false;
    let pushedHash = false;

    function applyFull(next) {
      isFull = next;
      shell.classList.toggle("is-full", isFull);
      document.body.classList.toggle("is-map-full", isFull);
      btn.setAttribute("aria-expanded", isFull ? "true" : "false");
      btn.textContent = isFull ? "Close map" : "Full map";
      if (mapInstance) {
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        mapInstance.setOptions({
          gestureHandling: isFull || coarse ? "greedy" : "cooperative",
        });
      }
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(resizeMap);
      });
    }

    function openFull() {
      if (isFull) {
        return;
      }
      applyFull(true);
      if (location.hash !== "#map-full") {
        history.pushState({ mapFull: true }, "", "#map-full");
        pushedHash = true;
      }
      btn.focus();
    }

    function closeFull(fromPop) {
      if (!isFull) {
        return;
      }
      applyFull(false);
      if (!fromPop && pushedHash && location.hash === "#map-full") {
        pushedHash = false;
        history.back();
      }
    }

    btn.addEventListener("click", function () {
      if (isFull) {
        closeFull(false);
      } else {
        openFull();
      }
    });

    if (jump) {
      jump.addEventListener("click", function (event) {
        if (!isFull) {
          return;
        }
        event.preventDefault();
        const href = jump.getAttribute("href");
        closeFull(false);
        const target = href ? document.querySelector(href) : null;
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    window.addEventListener("popstate", function () {
      if (isFull && location.hash !== "#map-full") {
        pushedHash = false;
        closeFull(true);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isFull) {
        closeFull(false);
      }
    });

    window.addEventListener("resize", resizeMap);
    window.addEventListener("orientationchange", resizeMap);

    if (location.hash === "#map-full") {
      applyFull(true);
    }
  }

  function setupNav() {
    const toggle = $(".nav-toggle");
    const nav = $("#site-nav");
    if (!toggle || !nav) {
      return;
    }
    toggle.addEventListener("click", function () {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function setupConsent() {
    const banner = $("#consent-banner");
    if (!banner) {
      return;
    }
    if (!localStorage.getItem(CONSENT_KEY)) {
      banner.hidden = false;
    }
    $$("[data-consent]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        localStorage.setItem(CONSENT_KEY, btn.getAttribute("data-consent"));
        banner.hidden = true;
      });
    });
  }

  function mailtoBody(form) {
    const data = new FormData(form);
    const lines = ["Property enquiry from the website", ""];
    data.forEach(function (value, key) {
      if (key === "website_hp" || key === "g-recaptcha-response") {
        return;
      }
      lines.push(key + ": " + value);
    });
    return lines.join("\n");
  }

  function setupRecaptcha() {
    if (!cfg.RECAPTCHA_SITE_KEY) {
      $$(".g-recaptcha").forEach(function (el) {
        el.hidden = true;
      });
      return;
    }
    $$(".g-recaptcha").forEach(function (el) {
      el.setAttribute("data-sitekey", cfg.RECAPTCHA_SITE_KEY);
    });
    const s = document.createElement("script");
    s.src = "https://www.google.com/recaptcha/api.js";
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  function setupForms() {
    const id = queryId();
    $$("#field-property-id").forEach(function (input) {
      if (id) {
        input.value = id;
      }
    });
    setupRecaptcha();
    $$(".js-lead-form").forEach(function (form) {
      const fallback = $(".js-mailto-fallback", form);
      if (fallback && cfg.CONTACT_EMAIL) {
        const subject = encodeURIComponent(form.getAttribute("data-form-type") + " " + (id || ""));
        fallback.innerHTML =
          'Email starter: <a href="mailto:' +
          encodeURIComponent(cfg.CONTACT_EMAIL).replace("%40", "@") +
          "?subject=" +
          subject +
          '">' +
          escapeHtml(cfg.CONTACT_EMAIL) +
          "</a>";
        fallback.hidden = false;
      }
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const status = $(".form-status", form);
        const data = Object.fromEntries(new FormData(form).entries());
        data.formType = form.getAttribute("data-form-type");
        data.source = location.pathname;
        data.consent = data.consent === "yes";
        data.utm = readUtm();
        if (window.grecaptcha && cfg.RECAPTCHA_SITE_KEY) {
          data.recaptchaToken = window.grecaptcha.getResponse();
        }
        if (!apiUrl("/submit")) {
          if (cfg.CONTACT_EMAIL) {
            const href =
              "mailto:" +
              cfg.CONTACT_EMAIL +
              "?subject=" +
              encodeURIComponent(data.formType + " " + (data.propertyId || "")) +
              "&body=" +
              encodeURIComponent(mailtoBody(form));
            location.href = href;
            return;
          }
          status.className = "form-status is-error";
          status.textContent = "The enquiry service is not configured yet. Please try again later.";
          return;
        }
        try {
          await apiSend("/submit", { method: "POST", body: JSON.stringify(data) });
          status.className = "form-status is-ok";
          status.textContent = "Received. We will use the contact details you supplied.";
          form.reset();
          if (id) {
            const field = $("#field-property-id", form);
            if (field) {
              field.value = id;
            }
          }
        } catch (err) {
          status.className = "form-status is-error";
          status.textContent = "Could not send just now. Wait a moment and try again.";
        }
      });
    });
  }

  function parseCoordText(text) {
    return String(text || "")
      .split(/\n/)
      .map(function (line) {
        const parts = line.split(/[,\s;]+/).filter(Boolean);
        if (parts.length < 2) {
          return null;
        }
        const lat = Number(parts[0]);
        const lng = Number(parts[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return null;
        }
        return { lat: lat, lng: lng };
      })
      .filter(Boolean);
  }

  function formatCoordText(points) {
    return (points || [])
      .map(function (point) {
        return point.lat + ", " + point.lng;
      })
      .join("\n");
  }

  function setupPropertyEditor(listings, apiIds, onSaved) {
    const form = $("#admin-property-form");
    const mapEl = $("#admin-editor-map");
    if (!form || !mapEl) {
      return;
    }
    form._listings = listings || [];
    form._onSaved = onSaved;
    const status = $(".form-status", form);
    const loadSel = $("#admin-load-id");
    const coords = $("#admin-coords");
    const search = $("#admin-map-search");
    let editorMap = form._editorMap || null;
    let editorMarkers = form._editorMarkers || [];
    let editorPolygon = form._editorPolygon || null;
    let editorPoints = form._editorPoints || [];
    const liveIds = {};
    (apiIds || []).forEach(function (id) {
      liveIds[id] = true;
    });

    function setStatus(ok, message) {
      status.className = "form-status " + (ok ? "is-ok" : "is-error");
      status.textContent = message;
    }

    function redrawEditor() {
      if (!editorMap) {
        return;
      }
      editorMarkers.forEach(function (marker) {
        marker.setMap(null);
      });
      editorMarkers = [];
      if (editorPolygon) {
        editorPolygon.setMap(null);
        editorPolygon = null;
      }
      editorPoints.forEach(function (point, index) {
        const marker = new google.maps.Marker({
          position: point,
          map: editorMap,
          label: String(index + 1),
          draggable: true,
        });
        marker.addListener("dragend", function () {
          const pos = marker.getPosition();
          editorPoints[index] = { lat: pos.lat(), lng: pos.lng() };
          coords.value = formatCoordText(editorPoints);
          redrawEditor();
        });
        editorMarkers.push(marker);
      });
      if (editorPoints.length >= 3) {
        editorPolygon = new google.maps.Polygon({
          paths: editorPoints,
          strokeColor: "#c4a574",
          strokeOpacity: 0.95,
          strokeWeight: 2,
          fillColor: "#8a7349",
          fillOpacity: 0.28,
          map: editorMap,
        });
      } else if (editorPoints.length === 2) {
        editorPolygon = new google.maps.Rectangle({
          bounds: {
            north: Math.max(editorPoints[0].lat, editorPoints[1].lat),
            south: Math.min(editorPoints[0].lat, editorPoints[1].lat),
            east: Math.max(editorPoints[0].lng, editorPoints[1].lng),
            west: Math.min(editorPoints[0].lng, editorPoints[1].lng),
          },
          strokeColor: "#c4a574",
          strokeOpacity: 0.95,
          strokeWeight: 2,
          fillColor: "#8a7349",
          fillOpacity: 0.28,
          map: editorMap,
        });
      }
      coords.value = formatCoordText(editorPoints);
      form._editorPoints = editorPoints;
      form._editorMarkers = editorMarkers;
      form._editorPolygon = editorPolygon;
    }

    function addPoint(point) {
      editorPoints.push(point);
      redrawEditor();
      if (editorMap) {
        editorMap.panTo(point);
      }
    }

    function fillForm(prop) {
      $("#admin-prop-id").value = prop.id || "";
      $("#admin-prop-title").value = prop.title || "";
      $("#admin-prop-location").value = prop.location || "";
      $("#admin-prop-status").value = prop.status || "Available";
      $("#admin-prop-date").value = prop.listingDate || "";
      $("#admin-prop-area").value = prop.area || "";
      $("#admin-prop-dimensions").value = prop.dimensions || "";
      $("#admin-prop-road").value = prop.roadAccess || "";
      $("#admin-prop-type").value = prop.landType || "";
      $("#admin-prop-facing").value = prop.facing || "";
      $("#admin-prop-price").value = prop.priceGuidance || "";
      $("#admin-prop-place").value = prop.placeUrl || "";
      $("#admin-prop-note").value = prop.boundaryNote || "";
      editorPoints = (prop.boundary && prop.boundary.length ? prop.boundary : []).map(function (point) {
        return { lat: Number(point.lat), lng: Number(point.lng) };
      });
      redrawEditor();
      if (editorMap && editorPoints[0]) {
        editorMap.panTo(editorPoints[0]);
        editorMap.setZoom(16);
      }
      $("#admin-delete-prop").hidden = !liveIds[prop.id];
    }

    if (loadSel) {
      const current = loadSel.value;
      loadSel.innerHTML =
        '<option value="">New listing</option>' +
        (listings || [])
          .map(function (prop) {
            return (
              '<option value="' +
              escapeHtml(prop.id) +
              '">' +
              escapeHtml(prop.id + " · " + (prop.title || "Untitled")) +
              "</option>"
            );
          })
          .join("");
      loadSel.value = current;
    }

    if (form._editorReady) {
      return;
    }
    form._editorReady = true;

    loadMapsScript(function () {
      editorMap = new google.maps.Map(mapEl, {
        center: { lat: 12.9716, lng: 77.5946 },
        zoom: 11,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: "greedy",
      });
      form._editorMap = editorMap;
      editorMap.addListener("click", function (event) {
        addPoint({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
      redrawEditor();
    });

    if (loadSel) {
      loadSel.addEventListener("change", function () {
        const id = loadSel.value;
        if (!id) {
          form.reset();
          editorPoints = [];
          redrawEditor();
          $("#admin-delete-prop").hidden = true;
          setStatus(true, "");
          return;
        }
        const prop = (form._listings || []).find(function (row) {
          return row.id === id;
        });
        if (prop) {
          fillForm(prop);
        }
      });
    }

    $("#admin-undo-point").addEventListener("click", function () {
      editorPoints.pop();
      redrawEditor();
    });
    $("#admin-clear-points").addEventListener("click", function () {
      editorPoints = [];
      redrawEditor();
    });
    coords.addEventListener("change", function () {
      editorPoints = parseCoordText(coords.value);
      redrawEditor();
    });
    $("#admin-map-find").addEventListener("click", function () {
      const query = (search.value || "").trim();
      if (!query || !window.google || !window.google.maps) {
        return;
      }
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: query }, function (results, geocodeStatus) {
        if (geocodeStatus !== "OK" || !results || !results[0]) {
          setStatus(false, "Google Maps could not find that place.");
          return;
        }
        const loc = results[0].geometry.location;
        const point = { lat: loc.lat(), lng: loc.lng() };
        if (editorMap) {
          editorMap.panTo(point);
          editorMap.setZoom(17);
        }
        addPoint(point);
        if (!$("#admin-prop-location").value) {
          $("#admin-prop-location").value = results[0].formatted_address || query;
        }
        if (!$("#admin-prop-title").value) {
          $("#admin-prop-title").value = query;
        }
      });
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const points = editorPoints.length ? editorPoints : parseCoordText(coords.value);
      const payload = {
        id: ($("#admin-prop-id").value || "").trim().toUpperCase(),
        title: $("#admin-prop-title").value,
        location: $("#admin-prop-location").value,
        status: $("#admin-prop-status").value,
        listingDate: $("#admin-prop-date").value,
        area: $("#admin-prop-area").value,
        dimensions: $("#admin-prop-dimensions").value,
        roadAccess: $("#admin-prop-road").value,
        landType: $("#admin-prop-type").value,
        facing: $("#admin-prop-facing").value,
        priceGuidance: $("#admin-prop-price").value,
        placeUrl: $("#admin-prop-place").value,
        boundaryNote: $("#admin-prop-note").value,
        points: points,
      };
      const existing = liveIds[payload.id];
      try {
        const saved = await apiSend(existing ? "/properties/" + encodeURIComponent(payload.id) : "/properties", {
          method: existing ? "PATCH" : "POST",
          headers: tokenHeader(),
          body: JSON.stringify(payload),
        });
        if (!saved || !saved.item) {
          throw new Error("save failed");
        }
        liveIds[saved.item.id] = true;
        setStatus(true, existing ? "Listing updated on the live map." : "Listing published to the live map.");
        $("#admin-delete-prop").hidden = false;
        if (typeof form._onSaved === "function") {
          form._onSaved();
        }
      } catch (err) {
        setStatus(false, err.status === 409 ? "That property ID already exists. Load it to edit." : "Could not save this listing. Check the ID, title, and map points.");
      }
    });

    $("#admin-delete-prop").addEventListener("click", async function () {
      const id = ($("#admin-prop-id").value || "").trim();
      if (!id || !liveIds[id.toUpperCase()]) {
        return;
      }
      if (!window.confirm("Remove " + id + " from the live catalogue?")) {
        return;
      }
      try {
        await apiSend("/properties/" + encodeURIComponent(id), {
          method: "DELETE",
          headers: tokenHeader(),
        });
        delete liveIds[id.toUpperCase()];
        form.reset();
        editorPoints = [];
        redrawEditor();
        $("#admin-delete-prop").hidden = true;
        setStatus(true, "Removed from the live catalogue.");
      } catch (err) {
        setStatus(false, "Could not remove that listing.");
      }
    });
  }

  function tokenHeader() {
    const token = sessionStorage.getItem("prashant-admin-token") || "";
    return { "x-admin-token": token };
  }

  function setupAdmin() {
    const login = $("#admin-login");
    if (!login) {
      return;
    }
    const app = $("#admin-app");
    const status = $(".form-status", login);
    async function loadDash() {
      const summary = await apiSend("/analytics-summary", {
        method: "GET",
        headers: tokenHeader(),
      });
      const leads = await apiSend("/submissions", {
        method: "GET",
        headers: tokenHeader(),
      });
      let catalogProps = [];
      let apiItems = [];
      try {
        catalogProps = await loadCatalog();
        const live = await apiSend("/properties", { method: "GET" });
        apiItems = (live && live.items) || [];
      } catch (err) {
        catalogProps = [];
      }
      app.hidden = false;
      login.hidden = true;
      setupPropertyEditor(
        catalogProps,
        apiItems.map(function (row) {
          return row.id;
        }),
        loadDash
      );
      const kpis = $("#admin-kpis");
      kpis.innerHTML = [
        ["Unique views", summary.totals.uniqueViews],
        ["Active now", summary.totals.activeSessions],
        ["Leads", summary.totals.leads],
        ["Offers", summary.totals.offers],
      ]
        .map(function (row) {
          return '<article class="kpi"><span>' + row[0] + "</span><strong>" + escapeHtml(row[1]) + "</strong></article>";
        })
        .join("");
      const tbody = $("#admin-listings tbody");
      tbody.innerHTML = (summary.properties || [])
        .map(function (row) {
          return (
            "<tr><td>" +
            escapeHtml(row.propertyId) +
            "</td><td>" +
            escapeHtml(row.status || "") +
            "</td><td>" +
            escapeHtml(row.uniqueViews) +
            "</td><td>" +
            escapeHtml(row.activeSessions) +
            "</td><td>" +
            escapeHtml(row.enquiry) +
            "</td><td>" +
            escapeHtml(row["document-request"]) +
            "</td><td>" +
            escapeHtml(row["site-visit"]) +
            "</td><td>" +
            escapeHtml(row.offer) +
            '</td><td><select data-status-id="' +
            escapeHtml(row.propertyId) +
            '"><option>Available</option><option>Under offer</option><option>Sold</option></select></td></tr>'
          );
        })
        .join("");
      $$("select[data-status-id]").forEach(function (sel) {
        const id = sel.getAttribute("data-status-id");
        const row = (summary.properties || []).find(function (r) {
          return r.propertyId === id;
        });
        if (row && row.status) {
          sel.value = row.status;
        }
        sel.addEventListener("change", async function () {
          await apiSend("/listing-status/" + encodeURIComponent(id), {
            method: "PATCH",
            headers: tokenHeader(),
            body: JSON.stringify({ status: sel.value }),
          });
        });
      });
      $("#admin-cities tbody").innerHTML = (summary.cities || [])
        .map(function (row) {
          return "<tr><td>" + escapeHtml(row.city) + "</td><td>" + escapeHtml(row.region) + "</td><td>" + escapeHtml(row.count) + "</td></tr>";
        })
        .join("");
      $("#admin-utm tbody").innerHTML = (summary.channels || [])
        .map(function (row) {
          return (
            "<tr><td>" +
            escapeHtml(row.utm_source) +
            "</td><td>" +
            escapeHtml(row.utm_medium) +
            "</td><td>" +
            escapeHtml(row.utm_campaign) +
            "</td><td>" +
            escapeHtml(row.count) +
            "</td></tr>"
          );
        })
        .join("");
      $("#admin-leads tbody").innerHTML = ((leads && leads.items) || [])
        .slice(0, 40)
        .map(function (row) {
          return (
            "<tr><td>" +
            escapeHtml(row.createdAt) +
            "</td><td>" +
            escapeHtml(row.formType) +
            "</td><td>" +
            escapeHtml(row.propertyId) +
            "</td><td>" +
            escapeHtml(row.name) +
            "</td><td>" +
            escapeHtml(row.mobile) +
            "</td></tr>"
          );
        })
        .join("");
    }
    login.addEventListener("submit", async function (event) {
      event.preventDefault();
      sessionStorage.setItem("prashant-admin-token", $("#admin-token").value);
      try {
        await loadDash();
      } catch (err) {
        status.className = "form-status is-error";
        status.textContent = err.status === 401 ? "That token was not accepted." : "Dashboard is not reachable yet.";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    captureUtm();
    getSessionId();
    setupNav();
    setupConsent();
    setupForms();
    setupAdmin();
    let properties = [];
    try {
      properties = await loadCatalog();
    } catch (err) {
      properties = [];
    }
    renderList(properties);
    if ($("#photo-gallery")) {
      fillPhotos(properties);
    } else if ($("#prop-facts")) {
      fillPropertyPage(properties);
    } else {
      drawMap(properties);
    }
  });
})();
