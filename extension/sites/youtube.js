// BarelySocial — YouTube.
// Home/Shorts nunca existen (aterrizan en /feed/subscriptions), guía reducida
// a Suscripciones/Tú/Historial y estantes de algoritmo fuera.
(() => {
  "use strict";

  const BS = globalThis.__BS;
  const SUB_FEED = "/feed/subscriptions";

  // guía + estantes en una sola pasada (mismo observer para ambos)
  const prune = () => {
    let changed = false;
    const KEEP = /suscripciones|subscriptions|\bt[uú]\b|\byou\b|historial|history/i;
    for (const ent of document.querySelectorAll(
      "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer"
    )) {
      if (!KEEP.test((ent.textContent || "").trim())) {
        ent.remove(); changed = true;
      }
    }
    // secciones que quedaron sin entradas (Explorar, Más de YouTube…)
    for (const sec of document.querySelectorAll(
      "ytd-guide-section-renderer, ytd-mini-guide-renderer"
    )) {
      if (!sec.querySelector("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer")) {
        sec.remove(); changed = true;
      }
    }
    // footer de la guía (Acerca de, Prensa, Derechos de autor…)
    for (const f of document.querySelectorAll(
      "ytd-guide-footer-renderer, ytd-mini-guide-footer-renderer"
    )) {
      f.remove(); changed = true;
    }
    // "Más relevantes" (algoritmo) fuera; queda lo cronológico
    for (const sh of document.querySelectorAll("ytd-rich-section-renderer")) {
      if (/relevant/i.test(sh.textContent || "")) { sh.remove(); changed = true; }
    }
    return changed;
  };

  // ruta: home y shorts no existen como superficie navegable
  const route = () => {
    if (/^\/shorts\//.test(location.pathname) ||
        location.pathname === "/" || location.pathname === "") {
      location.replace(SUB_FEED);
    }
  };

  // el guía se (re)renderiza al expandir el hamburger → observer persistente
  BS.boot(() => {
    BS.retry(prune);
    let ytTimer = null;
    new MutationObserver(() => {
      if (ytTimer) return;
      ytTimer = setTimeout(() => { ytTimer = null; try { prune(); } catch {} }, 600);
    }).observe(document.body, { childList: true, subtree: true });

    route();
    // SPA: YT cambia de ruta sin request de red → DNR no se entera
    const orig = { pushState: history.pushState, replaceState: history.replaceState };
    for (const f of ["pushState", "replaceState"]) {
      history[f] = function (...a) {
        const r = orig[f].apply(this, a);
        setTimeout(() => { try { route(); } catch {} }, 60);
        return r;
      };
    }
    addEventListener("popstate", () => { try { route(); } catch {} });
  });
})();
