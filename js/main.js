(function () {
  "use strict";

  const cfg = window.PRASHANT || {}; // properties catalogue config
  const SESSION_KEY = "prashant-session"; // first-party id for property views
  const CONSENT_KEY = "prashant-consent"; // cookie choice for the properties site
  const OWNER_KEY = "prashant-owner"; // owner-traffic flag, not a public property field
  const UTM_KEY = "prashant-utm"; // campaign tags on property leads
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
      return { strokeColor: "#C41E3A", fillColor: "#8B1428" };
    }
    if (status === "Under offer") {
      return { strokeColor: "#D55E00", fillColor: "#9a3f00" };
    }
    return { strokeColor: "#178A4A", fillColor: "#0F5C32" };
  }

  function queryId() {
    return new URLSearchParams(location.search).get("id") || "";
  }

  function parseMapsPlace(url) {
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
    return { lat: lat, lng: lng, zoom: zoom, name: name };
  }

  function pinOf(prop) {
    if (prop && prop.center && Number.isFinite(Number(prop.center.lat))) {
      return { lat: Number(prop.center.lat), lng: Number(prop.center.lng) };
    }
    const fromUrl = prop ? parseMapsPlace(prop.placeUrl) : null;
    if (fromUrl) {
      return { lat: fromUrl.lat, lng: fromUrl.lng };
    }
    if (prop && prop.boundary && prop.boundary[0]) {
      return { lat: Number(prop.boundary[0].lat), lng: Number(prop.boundary[0].lng) };
    }
    return null;
  }

  function outlineOf(prop) {
    const path = prop && prop.boundary ? prop.boundary : [];
    return path.length >= 3 ? path : null;
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

  async function loadCatalog(options) {
    const opts = options || {};
    let fileProps = [];
    try {
      const res = await fetch(assetUrl("data/properties.json"), { cache: "no-store" });
      catalog = await res.json();
      fileProps = catalog.properties || [];
    } catch (err) {
      catalog = { properties: [] };
    }
    catalog.fileIds = {};
    fileProps.forEach(function (prop) {
      if (prop && prop.id) {
        catalog.fileIds[prop.id] = true;
      }
    });
    let apiProps = [];
    try {
      const live = await apiSend("/properties", {
        method: "GET",
        headers: opts.admin ? tokenHeader() : {},
      });
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
    const merged = mergeCatalog(fileProps, apiProps);
    if (opts.includeHidden) {
      return merged;
    }
    return merged.filter(function (prop) {
      return !prop.hidden;
    });
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

  function canUseIwHeader(info) {
    return Boolean(info && typeof info.setHeaderContent === "function");
  }

  function popupHeaderEl(view, prop) {
    if (view === "interest") {
      const bar = document.createElement("div");
      bar.className = "popup-interest-bar";
      bar.innerHTML =
        '<button type="button" class="popup-back" data-popup-back aria-label="Back to listing">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6"/></svg>' +
        "</button><h3>I'm interested</h3>";
      return bar;
    }
    const title = document.createElement("h3");
    title.className = "popup-iw-title";
    title.textContent = (prop && (prop.title || prop.id)) || "Listing";
    return title;
  }

  function relayoutPopup(root) {
    const iwBody = root && root.closest(".gm-style-iw-d");
    const iwCard = root && root.closest(".gm-style-iw-c");
    if (iwBody) {
      iwBody.style.maxHeight = "none";
      iwBody.style.height = "";
      iwBody.style.overflow = "auto";
    }
    if (iwCard) {
      iwCard.style.height = "";
    }
  }

  function setPopupOpen(isOpen) {
    const shell = $("#map-shell");
    if (shell) {
      shell.classList.toggle("is-popup-open", Boolean(isOpen));
    }
  }

  function popupHtml(prop, opts) {
    const id = escapeHtml(prop.id);
    const useHeader = Boolean(opts && opts.useHeader);
    const summaryTitle = useHeader ? "" : "<h3>" + escapeHtml(prop.title || prop.id) + "</h3>";
    const interestBar = useHeader
      ? ""
      : '<div class="popup-interest-bar">' +
        '<button type="button" class="popup-back" data-popup-back aria-label="Back to listing">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6"/></svg>' +
        "</button><h3>I'm interested</h3></div>";
    return (
      '<article class="property-popup" data-property-id="' +
      id +
      '" data-view="summary">' +
      '<div class="popup-view" data-popup-view="summary">' +
      '<p class="property-id">' +
      id +
      "</p>" +
      summaryTitle +
      "<p>" +
      escapeHtml(prop.location || "") +
      "</p><p><strong>Extent:</strong> " +
      escapeHtml(prop.area || "On request") +
      (prop.boundaryNote
        ? "</p><p>" + escapeHtml(prop.boundaryNote)
        : "") +
      '</p><details class="more-facts">' +
      '<summary aria-label="More listing details">...</summary>' +
      '<div class="more-facts-body">' +
      "<p><strong>Listed:</strong> " +
      escapeHtml(formatDate(prop.listingDate)) +
      '</p><p><strong>Views:</strong> <span id="views-' +
      id +
      '">Loading</span></p><p><strong>Active viewers:</strong> <span id="live-' +
      id +
      '">Loading</span></p></div></details><div class="popup-actions">' +
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
      '<button type="button" class="btn btn-primary" data-popup-interest>I\'m interested</button></div></div>' +
      '<div class="popup-view" data-popup-view="interest" hidden>' +
      interestBar +
      '<form class="popup-interest-form" data-popup-form>' +
      '<input class="hp" type="text" name="website_hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="popup-interest-context">' +
      '<p class="property-id">' +
      id +
      '</p><p class="popup-listing-name">' +
      escapeHtml(prop.title || prop.id) +
      "</p></div>" +
      '<label>Name<input name="name" required maxlength="80" autocomplete="name"></label>' +
      '<label>Mobile number<input name="mobile" type="tel" required maxlength="20" autocomplete="tel" inputmode="tel"></label>' +
      '<label class="consent"><input type="checkbox" name="consent" value="yes" required> <span>I agree to be contacted about this listing. See the <a href="' +
      escapeHtml(pageUrl("privacy/")) +
      '">privacy notice</a>.</span></label>' +
      '<button class="btn btn-primary" type="submit">Submit</button>' +
      '<p class="form-status" role="status"></p></form></div></article>'
    );
  }

  function bindPopupInterestForm(info, prop) {
    const root = document.querySelector(".property-popup");
    if (!root || root.dataset.bound === "1") {
      return;
    }
    root.dataset.bound = "1";
    relayoutPopup(root);
    const iwCard = root.closest(".gm-style-iw-c");
    if (iwCard) {
      iwCard.addEventListener("pointerdown", function (event) {
        event.stopPropagation();
      });
    }
    const summary = $('[data-popup-view="summary"]', root);
    const interest = $('[data-popup-view="interest"]', root);
    const form = $("[data-popup-form]", root);
    const status = $(".form-status", form);
    const nameInput = $("input[name=name]", form);
    const openBtn = $("[data-popup-interest]", root);
    const propertyId = root.getAttribute("data-property-id") || "";
    const useHeader = canUseIwHeader(info);

    function bindHeaderBack(header) {
      const back = header && header.querySelector("[data-popup-back]");
      if (!back) {
        return;
      }
      back.addEventListener("click", function () {
        showView("summary");
      });
    }

    function showView(name) {
      summary.hidden = name !== "summary";
      interest.hidden = name !== "interest";
      root.dataset.view = name;
      if (useHeader) {
        const header = popupHeaderEl(name, prop);
        info.setHeaderContent(header);
        bindHeaderBack(header);
      }
      relayoutPopup(root);
      const focusEl = name === "interest" ? nameInput : openBtn;
      if (focusEl) {
        focusEl.focus();
      }
    }

    openBtn.addEventListener("click", function () {
      showView("interest");
    });
    const fallbackBack = $("[data-popup-back]", root);
    if (fallbackBack) {
      fallbackBack.addEventListener("click", function () {
        showView("summary");
      });
    }
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.formType = "interest";
      data.propertyId = propertyId;
      data.source = location.pathname;
      data.consent = data.consent === "yes";
      data.utm = readUtm();
      const submitBtn = $("button[type=submit]", form);
      if (submitBtn) {
        submitBtn.disabled = true;
      }
      if (!apiUrl("/submit")) {
        status.className = "form-status is-error";
        status.textContent = "The enquiry service is not configured yet. Please try again later.";
        if (submitBtn) {
          submitBtn.disabled = false;
        }
        return;
      }
      try {
        await apiSend("/submit", { method: "POST", body: JSON.stringify(data) });
        status.className = "form-status is-ok";
        status.textContent = "Received. We will call you on the number you supplied.";
        form.reset();
      } catch (err) {
        status.className = "form-status is-error";
        status.textContent = "Could not send just now. Wait a moment and try again.";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    });
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
      return Boolean(pinOf(p));
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
      const focusPin = pinOf(focus);
      const focusPlace = parseMapsPlace(focus.placeUrl);
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const compact = window.innerWidth < 900;
      const map = new google.maps.Map(mapEl, {
        center: focusPin,
        zoom: drawable.length === 1 ? (focusPlace && focusPlace.zoom) || 17 : 12,
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
      let popupProp = null;
      const info = new google.maps.InfoWindow({
        maxWidth: Math.min(340, window.innerWidth - 40),
      });
      info.addListener("domready", function () {
        bindPopupInterestForm(info, popupProp);
      });
      info.addListener("closeclick", function () {
        setPopupOpen(false);
      });
      let activeOutline = null;

      function hideOutline() {
        if (activeOutline) {
          activeOutline.setMap(null);
          activeOutline = null;
        }
      }

      function openInfo(prop, at) {
        recordView(prop.id);
        startPresence(prop.id);
        popupProp = prop;
        if (canUseIwHeader(info)) {
          info.setHeaderContent(popupHeaderEl("summary", prop));
        }
        if (typeof info.setOptions === "function") {
          info.setOptions({ ariaLabel: prop.title || prop.id });
        }
        info.setContent(popupHtml(prop, { useHeader: canUseIwHeader(info) }));
        info.setPosition(at);
        info.open({ map: map });
        setPopupOpen(true);
        loadPropertyStats(prop.id);
      }

      function showListing(prop, at) {
        hideOutline();
        const colors = statusStyle(prop.status);
        const outline = outlineOf(prop);
        if (outline) {
          activeOutline = new google.maps.Polygon({
            paths: outline,
            strokeColor: colors.strokeColor,
            strokeOpacity: 0.95,
            strokeWeight: 2,
            fillColor: colors.fillColor,
            fillOpacity: 0.28,
            clickable: true,
            map: map,
          });
          activeOutline.addListener("click", function (event) {
            openInfo(prop, event.latLng);
          });
        }
        openInfo(prop, at || pinOf(prop));
      }

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const pulseGreen = "#178A4A";
      const beadPath = "M -0.32,-1 A 0.32,0.32 0 1,1 0.32,-1 A 0.32,0.32 0 1,1 -0.32,-1 Z";
      const motions = [];

      function coreIcon(fill, opacity) {
        return {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: fill,
          fillOpacity: opacity,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        };
      }

      function beadIcon(rotation) {
        return {
          path: beadPath,
          scale: 9,
          fillColor: pulseGreen,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1,
          rotation: rotation,
        };
      }

      function haloIcon(scale, opacity) {
        return {
          path: google.maps.SymbolPath.CIRCLE,
          scale: scale,
          fillColor: pulseGreen,
          fillOpacity: opacity,
          strokeWeight: 0,
          strokeColor: pulseGreen,
        };
      }

      drawable.forEach(function (prop) {
        const pin = pinOf(prop);
        const colors = statusStyle(prop.status);
        const halo = new google.maps.Marker({
          position: pin,
          map: map,
          clickable: false,
          optimized: false,
          zIndex: 1,
          icon: haloIcon(16, reduceMotion ? 0.22 : 0.36),
        });
        const marker = new google.maps.Marker({
          position: pin,
          map: map,
          title: prop.title || prop.id,
          optimized: false,
          zIndex: 2,
          icon: coreIcon(colors.strokeColor, 1),
        });
        marker.addListener("click", function () {
          showListing(prop, pin);
        });
        const spin = new google.maps.Marker({
          position: pin,
          map: map,
          clickable: false,
          optimized: false,
          zIndex: 3,
          icon: beadIcon(0),
        });
        if (!reduceMotion) {
          motions.push({
            halo: halo,
            core: marker,
            spin: spin,
            fill: colors.strokeColor,
          });
        }
      });
      if (motions.length) {
        const started = performance.now();
        function tick(now) {
          const t = now - started;
          const beep = 0.52 + 0.48 * (0.5 + 0.5 * Math.sin((t / 720) * Math.PI * 2));
          const deg = ((t / 2200) * 360) % 360;
          const pulse = (t % 1800) / 1800;
          let live = false;
          motions.forEach(function (item) {
            if (!item.core.getMap()) {
              return;
            }
            live = true;
            item.core.setIcon(coreIcon(item.fill, beep));
            item.spin.setIcon(beadIcon(deg));
            item.halo.setIcon(haloIcon(14 + 12 * pulse, 0.4 * (1 - pulse)));
          });
          if (live) {
            requestAnimationFrame(tick);
          }
        }
        requestAnimationFrame(tick);
      }
      info.addListener("closeclick", hideOutline);
      map.addListener("click", function () {
        hideOutline();
        info.close();
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
    if (document.querySelector("script[data-prashant-maps]")) { // property map loader
      return;
    }
    window.prashantMapsReady = function () { // Maps ready for the properties map
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
    s.setAttribute("data-prashant-maps", "1"); // one Maps script for property pins
    s.addEventListener("error", function () {
      const fallback = $("#map-fallback");
      if (fallback) {
        fallback.hidden = false;
      }
      const editorStatus = $("#admin-property-form .form-status");
      if (editorStatus) {
        editorStatus.className = "form-status is-error";
        editorStatus.textContent = "Google Maps failed to load. Check the API key referrers for this domain.";
      }
    });
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

  function setupAdminMapExpand(form) {
    const shell = $("#admin-map-shell");
    const btn = $("#admin-map-full-btn");
    if (!shell || !btn || form._adminMapExpandBound) {
      return;
    }
    form._adminMapExpandBound = true;
    let isFull = false;
    let pushedHash = false;

    function resizeEditor() {
      if (form._editorMap && window.google && window.google.maps) {
        google.maps.event.trigger(form._editorMap, "resize");
      }
    }

    function applyFull(next) {
      isFull = next;
      if (next) {
        if (!form._mapHome) {
          form._mapHome = { parent: shell.parentNode, next: shell.nextSibling };
        }
        document.body.appendChild(shell);
      } else if (form._mapHome && form._mapHome.parent) {
        form._mapHome.parent.insertBefore(shell, form._mapHome.next);
      }
      shell.classList.toggle("is-full", isFull);
      document.body.classList.toggle("is-map-full", isFull);
      btn.setAttribute("aria-expanded", isFull ? "true" : "false");
      btn.textContent = isFull ? "Close map" : "Full map";
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(resizeEditor);
      });
    }

    function openFull() {
      if (isFull) {
        return;
      }
      applyFull(true);
      if (location.hash !== "#admin-map-full") {
        history.pushState({ adminMapFull: true }, "", "#admin-map-full");
        pushedHash = true;
      }
      btn.focus();
    }

    function closeFull(fromPop) {
      if (!isFull) {
        return;
      }
      applyFull(false);
      if (!fromPop && pushedHash && location.hash === "#admin-map-full") {
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

    window.addEventListener("popstate", function () {
      if (isFull && location.hash !== "#admin-map-full") {
        pushedHash = false;
        closeFull(true);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isFull) {
        closeFull(false);
      }
    });

    window.addEventListener("resize", resizeEditor);
    window.addEventListener("orientationchange", resizeEditor);

    if (location.hash === "#admin-map-full") {
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
    let editorPin = form._editorPin || null;
    let editorPolygon = form._editorPolygon || null;
    let editorPoints = form._editorPoints || [];
    let placePin = form._placePin || null;
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
      if (editorPin) {
        editorPin.setMap(null);
        editorPin = null;
      }
      if (editorPolygon) {
        editorPolygon.setMap(null);
        editorPolygon = null;
      }
      if (placePin) {
        editorPin = new google.maps.Marker({
          position: placePin,
          map: editorMap,
          title: "Listing pin",
          draggable: true,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#178A4A",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        editorPin.addListener("dragend", function () {
          const pos = editorPin.getPosition();
          placePin = { lat: pos.lat(), lng: pos.lng() };
          form._placePin = placePin;
        });
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
          strokeColor: "#178A4A",
          strokeOpacity: 0.95,
          strokeWeight: 2,
          fillColor: "#0F5C32",
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
          strokeColor: "#178A4A",
          strokeOpacity: 0.95,
          strokeWeight: 2,
          fillColor: "#0F5C32",
          fillOpacity: 0.28,
          map: editorMap,
        });
      }
      coords.value = formatCoordText(editorPoints);
      form._editorPoints = editorPoints;
      form._editorMarkers = editorMarkers;
      form._editorPin = editorPin;
      form._placePin = placePin;
      form._editorPolygon = editorPolygon;
      const hint = $("#admin-map-hint");
      if (hint) {
        if (!editorPoints.length && placePin) {
          hint.textContent = "Pin set. Tap to add a boundary";
        } else if (!editorPoints.length) {
          hint.textContent = "Paste a Maps URL or tap a corner";
        } else if (editorPoints.length === 1) {
          hint.textContent = "1 corner. Tap to add another";
        } else {
          hint.textContent = editorPoints.length + " corners. Tap to add another";
        }
      }
    }

    function applyPlaceUrl(url) {
      const parsed = parseMapsPlace(url);
      if (!parsed) {
        return false;
      }
      placePin = { lat: parsed.lat, lng: parsed.lng };
      form._placePin = placePin;
      if (editorMap) {
        editorMap.panTo(placePin);
        editorMap.setZoom(parsed.zoom || 17);
      }
      if (!$("#admin-prop-location").value && parsed.name) {
        $("#admin-prop-location").value = parsed.name;
      }
      redrawEditor();
      return true;
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
      $("#admin-prop-hidden").checked = Boolean(prop.hidden);
      const fromUrl = parseMapsPlace(prop.placeUrl);
      placePin = pinOf(prop);
      form._placePin = placePin;
      editorPoints = (prop.boundary && prop.boundary.length ? prop.boundary : []).map(function (point) {
        return { lat: Number(point.lat), lng: Number(point.lng) };
      });
      redrawEditor();
      if (editorMap && placePin) {
        editorMap.panTo(placePin);
        editorMap.setZoom((fromUrl && fromUrl.zoom) || 17);
      }
      $("#admin-delete-prop").hidden = false;
    }

    function resetNew() {
      form.reset();
      if (loadSel) {
        loadSel.value = "";
      }
      editorPoints = [];
      placePin = null;
      form._placePin = null;
      redrawEditor();
      $("#admin-delete-prop").hidden = true;
      $("#admin-prop-hidden").checked = false;
      setStatus(true, "");
    }

    function openListing(id) {
      const prop = (form._listings || []).find(function (row) {
        return row.id === id;
      });
      if (!prop) {
        return;
      }
      if (loadSel) {
        loadSel.value = id;
      }
      fillForm(prop);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function removeListing(id) {
      const key = String(id || "").trim().toUpperCase();
      const prop = (form._listings || []).find(function (row) {
        return row.id === key;
      });
      if (!key || !prop) {
        return false;
      }
      if (!window.confirm("Remove " + key + " from the public map?")) {
        return false;
      }
      try {
        const inFile = Boolean((form._fileIds || {})[key]);
        if (liveIds[key] && !inFile) {
          await apiSend("/properties/" + encodeURIComponent(key), {
            method: "DELETE",
            headers: tokenHeader(),
          });
          delete liveIds[key];
        } else {
          const saved = await apiSend(liveIds[key] ? "/properties/" + encodeURIComponent(key) : "/properties", {
            method: liveIds[key] ? "PATCH" : "POST",
            headers: tokenHeader(),
            body: JSON.stringify({
              id: key,
              title: prop.title,
              location: prop.location,
              status: prop.status,
              listingDate: prop.listingDate,
              area: prop.area,
              dimensions: prop.dimensions,
              roadAccess: prop.roadAccess,
              landType: prop.landType,
              facing: prop.facing,
              priceGuidance: prop.priceGuidance,
              placeUrl: prop.placeUrl,
              boundaryNote: prop.boundaryNote,
              points: prop.boundary || [],
              hidden: true,
            }),
          });
          if (saved && saved.item) {
            liveIds[key] = true;
          }
        }
        setStatus(true, "Removed from the public map.");
        if (typeof form._onSaved === "function") {
          form._onSaved();
        }
        return true;
      } catch (err) {
        setStatus(false, "Could not remove that listing.");
        return false;
      }
    }

    form._fileIds = catalog.fileIds || {};
    form._openListing = openListing;
    form._newListing = resetNew;
    form._removeListing = removeListing;

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

    setupAdminMapExpand(form);
    loadMapsScript(function () {
      editorMap = new google.maps.Map(mapEl, {
        center: { lat: 12.9716, lng: 77.5946 },
        zoom: 11,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
          position: google.maps.ControlPosition.LEFT_BOTTOM,
        },
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: "greedy",
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_BOTTOM,
        },
      });
      form._editorMap = editorMap;
      editorMap.addListener("click", function (event) {
        addPoint({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
      if ($("#admin-prop-place") && $("#admin-prop-place").value) {
        applyPlaceUrl($("#admin-prop-place").value);
      }
      redrawEditor();
    });

    if (loadSel) {
      loadSel.addEventListener("change", function () {
        const id = loadSel.value;
        if (!id) {
          form.reset();
          editorPoints = [];
          placePin = null;
          form._placePin = null;
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
    const placeInput = $("#admin-prop-place");
    if (placeInput) {
      placeInput.addEventListener("change", function () {
        if (placeInput.value && !applyPlaceUrl(placeInput.value)) {
          setStatus(false, "Could not read a pin from that Maps URL. Use a place link with coordinates.");
        }
      });
      placeInput.addEventListener("paste", function () {
        window.setTimeout(function () {
          if (placeInput.value) {
            applyPlaceUrl(placeInput.value);
          }
        }, 0);
      });
    }

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
        placePin = point;
        form._placePin = placePin;
        if (editorMap) {
          editorMap.panTo(point);
          editorMap.setZoom(17);
        }
        redrawEditor();
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
      const parsedPlace = parseMapsPlace($("#admin-prop-place").value);
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
        hidden: $("#admin-prop-hidden").checked,
        center: placePin || (parsedPlace ? { lat: parsedPlace.lat, lng: parsedPlace.lng } : null),
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
        setStatus(false, err.status === 409 ? "That property ID already exists. Load it to edit." : "Could not save this listing. Check the ID, title, Maps URL, or map points.");
      }
    });

    $("#admin-delete-prop").addEventListener("click", async function () {
      const id = ($("#admin-prop-id").value || "").trim();
      await removeListing(id);
      resetNew();
    });
  }

  function listingLeads(row) {
    return (row.enquiry || 0) + (row["document-request"] || 0) + (row["site-visit"] || 0) + (row.offer || 0) + (row.interest || 0);
  }

  function setupListingsDesk(catalogProps, summaryRows, fileIds) {
    const table = $("#admin-listings");
    const tbody = table && $("tbody", table);
    const search = $("#admin-listing-search");
    const sortSel = $("#admin-listing-sort");
    if (!table || !tbody) {
      return;
    }
    const metrics = {};
    (summaryRows || []).forEach(function (row) {
      if (row.propertyId && row.propertyId !== "unspecified") {
        metrics[row.propertyId] = row;
      }
    });
    const rows = [];
    const seen = {};
    (catalogProps || []).forEach(function (prop) {
      const extra = metrics[prop.id] || {};
      seen[prop.id] = true;
      rows.push({
        id: prop.id,
        title: prop.title || prop.id,
        location: prop.location || "",
        status: extra.status || prop.status || "Available",
        listingDate: prop.listingDate || "",
        uniqueViews: extra.uniqueViews || 0,
        activeSessions: extra.activeSessions || 0,
        enquiry: extra.enquiry || 0,
        "document-request": extra["document-request"] || 0,
        "site-visit": extra["site-visit"] || 0,
        offer: extra.offer || 0,
        interest: extra.interest || 0,
        hidden: Boolean(prop.hidden),
        inFile: Boolean((fileIds || {})[prop.id]),
      });
    });
    Object.keys(metrics).forEach(function (id) {
      if (seen[id]) {
        return;
      }
      const extra = metrics[id];
      rows.push({
        id: id,
        title: id,
        location: "",
        status: extra.status || "",
        listingDate: "",
        uniqueViews: extra.uniqueViews || 0,
        activeSessions: extra.activeSessions || 0,
        enquiry: extra.enquiry || 0,
        "document-request": extra["document-request"] || 0,
        "site-visit": extra["site-visit"] || 0,
        offer: extra.offer || 0,
        interest: extra.interest || 0,
        hidden: false,
        inFile: Boolean((fileIds || {})[id]),
      });
    });
    table._rows = rows;
    if (!table._sortKey) {
      table._sortKey = "id";
      table._sortDir = "asc";
    }
    if (sortSel && !table._deskBound) {
      sortSel.value = table._sortKey;
    }

    function compare(a, b) {
      const key = table._sortKey;
      let av = key === "leads" ? listingLeads(a) : a[key];
      let bv = key === "leads" ? listingLeads(b) : b[key];
      if (typeof av === "string") {
        av = av.toLowerCase();
        bv = String(bv || "").toLowerCase();
      }
      if (av < bv) {
        return table._sortDir === "asc" ? -1 : 1;
      }
      if (av > bv) {
        return table._sortDir === "asc" ? 1 : -1;
      }
      return 0;
    }

    function renderDesk() {
      const q = ((search && search.value) || "").trim().toLowerCase();
      const shown = table._rows
        .filter(function (row) {
          if (!q) {
            return true;
          }
          return (
            String(row.id).toLowerCase().indexOf(q) !== -1 ||
            String(row.title).toLowerCase().indexOf(q) !== -1 ||
            String(row.location).toLowerCase().indexOf(q) !== -1 ||
            String(row.status).toLowerCase().indexOf(q) !== -1
          );
        })
        .slice()
        .sort(compare);
      $$(".sort-btn", table).forEach(function (btn) {
        const key = btn.getAttribute("data-sort");
        btn.setAttribute("aria-sort", key === table._sortKey ? (table._sortDir === "asc" ? "ascending" : "descending") : "none");
      });
      tbody.innerHTML = shown
        .map(function (row) {
          return (
            "<tr><td>" +
            escapeHtml(row.id) +
            "</td><td>" +
            escapeHtml(row.title) +
            (row.hidden ? ' <span class="muted">Hidden</span>' : "") +
            "</td><td>" +
            escapeHtml(row.location) +
            "</td><td>" +
            escapeHtml(row.status || "") +
            "</td><td>" +
            escapeHtml(row.uniqueViews) +
            "</td><td>" +
            escapeHtml(listingLeads(row)) +
            '</td><td><div class="listing-actions">' +
            '<select data-status-id="' +
            escapeHtml(row.id) +
            '" aria-label="Status for ' +
            escapeHtml(row.id) +
            '"><option>Available</option><option>Under offer</option><option>Sold</option></select>' +
            '<button type="button" class="btn btn-secondary" data-edit-id="' +
            escapeHtml(row.id) +
            '">Edit</button>' +
            '<button type="button" class="btn btn-secondary" data-copy-id="' +
            escapeHtml(row.id) +
            '">Duplicate</button>' +
            '<button type="button" class="btn btn-secondary" data-delete-id="' +
            escapeHtml(row.id) +
            '">Delete</button></div></td></tr>'
          );
        })
        .join("");
      $$("select[data-status-id]", tbody).forEach(function (sel) {
        const id = sel.getAttribute("data-status-id");
        const row = shown.find(function (item) {
          return item.id === id;
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
      $$("[data-edit-id]", tbody).forEach(function (btn) {
        btn.addEventListener("click", function () {
          const form = $("#admin-property-form");
          if (form && form._openListing) {
            form._openListing(btn.getAttribute("data-edit-id"));
          }
        });
      });
      $$("[data-copy-id]", tbody).forEach(function (btn) {
        btn.addEventListener("click", function () {
          const form = $("#admin-property-form");
          const id = btn.getAttribute("data-copy-id");
          const prop = (form && form._listings || []).find(function (row) {
            return row.id === id;
          });
          if (!form || !prop || !form._openListing) {
            return;
          }
          form._openListing(id);
          $("#admin-prop-id").value = "";
          $("#admin-prop-title").value = (prop.title || id) + " copy";
          $("#admin-delete-prop").hidden = true;
          if ($("#admin-load-id")) {
            $("#admin-load-id").value = "";
          }
        });
      });
      $$("[data-delete-id]", tbody).forEach(function (btn) {
        btn.addEventListener("click", function () {
          const form = $("#admin-property-form");
          if (form && form._removeListing) {
            form._removeListing(btn.getAttribute("data-delete-id"));
          }
        });
      });
    }

    table._renderDesk = renderDesk;
    renderDesk();

    if (table._deskBound) {
      return;
    }
    table._deskBound = true;
    function setSort(key) {
      if (table._sortKey === key) {
        table._sortDir = table._sortDir === "asc" ? "desc" : "asc";
      } else {
        table._sortKey = key;
        table._sortDir = key === "uniqueViews" || key === "leads" ? "desc" : "asc";
      }
      if (sortSel) {
        sortSel.value = table._sortKey;
      }
      renderDesk();
    }
    $$(".sort-btn", table).forEach(function (btn) {
      btn.addEventListener("click", function () {
        setSort(btn.getAttribute("data-sort"));
      });
    });
    if (sortSel) {
      sortSel.addEventListener("change", function () {
        table._sortKey = sortSel.value;
        table._sortDir = sortSel.value === "uniqueViews" || sortSel.value === "leads" ? "desc" : "asc";
        renderDesk();
      });
    }
    if (search) {
      search.addEventListener("input", renderDesk);
    }
    const addBtn = $("#admin-add-listing");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        const form = $("#admin-property-form");
        if (form && form._newListing) {
          form._newListing();
        }
        if (form) {
          form.scrollIntoView({ behavior: "smooth", block: "start" });
          $("#admin-prop-id").focus();
        }
      });
    }
  }

  function tokenHeader() {
    const token = sessionStorage.getItem("prashant-admin-token") || ""; // admin token for property desk
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
        catalogProps = await loadCatalog({ admin: true, includeHidden: true });
        const live = await apiSend("/properties", { method: "GET", headers: tokenHeader() });
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
      setupListingsDesk(catalogProps, summary.properties || [], catalog.fileIds || {});
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
      sessionStorage.setItem("prashant-admin-token", $("#admin-token").value); // unlocks the properties desk
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
