// BarelySocial — youtube ad stripper (MAIN world, document_start).
// Patchea fetch/XHR de youtubei y elimina adPlacements/adSlots de las
// respuestas del player. Técnica estándar (misma idea que Unhook / Simple YT
// AdBlocker): los ads de YT viajan embebidos en JSON del propio dominio, no
// son bloqueables por red, así que se desechan en el camino.
(() => {
  "use strict";

  const stripAds = (data) => {
    if (!data || typeof data !== "object") return data;
    // solo tocar respuestas del player o de browse con módulos de ads
    const dive = (obj, depth) => {
      if (!obj || typeof obj !== "object" || depth > 25) return;
      if (Array.isArray(obj)) {
        for (const v of obj) dive(v, depth + 1);
        return;
      }
      for (const k of ["adPlacements", "adSlots", "adBreaks", "adFormats"]) {
        if (k in obj) obj[k] = []; // vaciar en vez de borrar (menos crash)
      }
      if ("adBreaksRenderer" in obj) obj.adBreaksRenderer = {};
      if ("adPlacementsRenderer" in obj) obj.adPlacementsRenderer = {};
      for (const v of Object.values(obj)) dive(v, depth + 1);
    };
    dive(data, 0);
    return data;
  };

  const isApiUrl = (url) =>
    typeof url === "string" &&
    (url.includes("/youtubei/v1/player") ||
      url.includes("/youtubei/v1/browse") ||
      url.includes("/youtubei/v1/next"));

  // --- fetch ---
  const origFetch = window.fetch?.bind(window);
  if (origFetch) {
    window.fetch = async (...args) => {
      const res = await origFetch(...args);
      try {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        if (isApiUrl(url)) {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("json")) {
            const json = await res.clone().json();
            stripAds(json);
            return new Response(JSON.stringify(json), {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers,
            });
          }
        }
      } catch {}
      return res;
    };
  }

  // --- XHR ---
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__bsUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (isApiUrl(this.__bsUrl)) {
      this.addEventListener("readystatechange", () => {
        if (this.readyState === this.DONE) {
          try {
            const parsed = JSON.parse(this.responseText);
            stripAds(parsed);
            Object.defineProperty(this, "responseText", {
              value: JSON.stringify(parsed),
              configurable: true,
            });
            Object.defineProperty(this, "response", {
              value: this.responseType === "json" ? parsed : JSON.stringify(parsed),
              configurable: true,
            });
          } catch {}
        }
      });
    }
    return origSend.apply(this, args);
  };

  // --- nursery safety: nunca romper YT si algo falla ---
  window.addEventListener("error", () => {}, { once: true });
})();
