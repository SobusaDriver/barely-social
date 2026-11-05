// BarelySocial — content script (MV3, compatible con Safari)
// Solo comportamientos que el CSS no puede expresar. Todo fail-open.

(() => {
  "use strict";

  const SITES = ["instagram", "youtube", "reddit", "linkedin", "tiktok"];
  const RETRY_MS = 300;
  const RETRY_MAX = Math.ceil(5000 / RETRY_MS); // reintento ≤ 5s

  const site = SITES.find((s) => location.hostname.includes(s)) || null;
  if (!site) return;

  // ---- estado (claves reservadas por background.js: "sites", "allowance") ----
  const state = { sites: {}, allowance: {} };
  const api = globalThis.browser || globalThis.chrome; // Safari expone browser.*

  function loadState() {
    if (!api || !api.storage || !api.storage.local) return Promise.resolve();
    return api.storage.local
      .get(["sites", "allowance"])
      .then((r) => {
        state.sites = r.sites || {};
        state.allowance = r.allowance || {};
      })
      .catch(() => {});
  }

  // ---- helpers ----
  // Ejecuta fn cada RETRY_MS hasta que pred() devuelve true o se agota el tiempo.
  function retry(pred) {
    let n = 0;
    const tick = () => {
      let done = false;
      try { done = !!pred(); } catch {}
      if (!done && n++ < RETRY_MAX) setTimeout(tick, RETRY_MS);
    };
    tick();
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  // límite 0 = sin límite → no hay allowance aplicable
  function allowanceFor(s) {
    const a = state.allowance[s];
    if (!a || !a.limit || a.date !== today()) return null;
    return a;
  }

  // El conteo lo hace background.js; solo pedimos consumir.
  function consumeAllowance() {
    try { api.runtime.sendMessage({ type: "consume", site }); } catch {}
    const a = allowanceFor(site); // actualización optimista para el UI
    if (a) { a.used = Math.min(a.limit, (a.used || 0) + 1); state.allowance[site] = a; return a; }
    return null;
  }

  // ---- overlay bloqueante (F2 / F3) ----
  function blockOverlay() {
    if (document.getElementById("bs-overlay")) return;
    const a = allowanceFor(site);
    const avail = a && a.used < a.limit;

    const ov = document.createElement("div");
    ov.id = "bs-overlay";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-label", "Bloqueado por BarelySocial");
    Object.assign(ov.style, {
      position: "fixed", inset: "0", zIndex: "2147483647",
      background: "rgba(10,10,12,.92)", display: "flex",
      alignItems: "center", justifyContent: "center", overflow: "hidden",
      fontFamily: "-apple-system,system-ui,sans-serif", color: "#f2f2f2",
    });
    ov.innerHTML =
      '<div style="max-width:26rem;margin:1rem;padding:2rem;border-radius:16px;' +
      'background:#16181d;box-shadow:0 8px 40px rgba(0,0,0,.5);text-align:center">' +
      '<div style="font-size:1.15rem;font-weight:600;margin-bottom:.5rem">' +
      "Bloqueado por BarelySocial</div>" +
      '<div id="bs-sub" style="font-size:.9rem;opacity:.75;margin-bottom:1.25rem">' +
      "Vuelve a tu feed de seguidos</div>" +
      '<div id="bs-actions" style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap"></div>' +
      "</div>";
    const actions = ov.querySelector("#bs-actions");

    if (avail) {
      ov.querySelector("#bs-sub").textContent =
        "Te queda allowance hoy: " + (a.limit - a.used) + " de " + a.limit;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Usar allowance (usados " + a.used + "/" + a.limit + ")";
      Object.assign(btn.style, {
        padding: ".6rem 1.1rem", borderRadius: "8px", border: "0",
        background: "#4c8dff", color: "#fff", fontSize: ".9rem", cursor: "pointer",
      });
      btn.addEventListener("click", () => {
        consumeAllowance();
        const release = removeOverlay();
        release();
        // deja pasar UNA pieza; el próximo scroll/navegación re-bloquea
        armReblock();
      });
      actions.appendChild(btn);
    }

    const back = document.createElement("a");
    back.href = "#";
    back.textContent = "Volver";
    Object.assign(back.style, {
      padding: ".6rem 1.1rem", borderRadius: "8px",
      background: "#24262c", color: "#f2f2f2", fontSize: ".9rem",
      textDecoration: "none", cursor: "pointer",
    });
    back.addEventListener("click", (e) => {
      e.preventDefault();
      removeOverlay()();
      try { history.back(); } catch {}
    });
    actions.appendChild(back);

    document.documentElement.appendChild(ov);
  }

  function removeOverlay() {
    const ov = document.getElementById("bs-overlay");
    const scroller =
      document.querySelector('[data-testid="ScrollSnap-List"]') ||
      document.querySelector("main") ||
      document.body;
    const prev = scroller.style.overflow;
    if (ov) { try { ov.remove(); } catch {} }
    return () => { try { scroller.style.overflow = prev; } catch {} };
  }

  // Tras gastar allowance: re-bloquear en el próximo scroll/navegación
  function armReblock() {
    const blockedHere = () =>
      site === "instagram" && /^\/(reels|explore)\b/.test(location.pathname);
    const h = () => {
      if (blockedHere() && !document.getElementById("bs-overlay")) {
        const a = allowanceFor(site);
        if (!a || a.used >= a.limit) blockOverlay(); // allowance agotado → bloqueo de nuevo
      }
    };
    addEventListener("scroll", h, { passive: true });
    addEventListener("popstate", h);
  }

  // ---- Instagram ----
  function neutralizeAccent() {
    // todo lo "rojo/rosa de Meta" → gris. Heurística de color en estilos
    // computados: fondos, box-shadows (badge) y SVG con gradiente/acento.
    const ACCENT_RE = /rgba?\(\s*(255|247|246)\s*,\s*(48|59)\s*/;
    const isAccent = (str) => ACCENT_RE.test(str);
    const targets = new Set();
    for (const el of document.querySelectorAll("svg, span, div")) {
      const cs = getComputedStyle(el);
      let hit = false;
      if (el.tagName === "SVG") {
        hit = el.querySelector("linearGradient, radialGradient") != null;
        if (!hit) hit = [...el.querySelectorAll("*")].some((c) => {
          const f = getComputedStyle(c).fill || "";
          return isAccent(f) || f.includes("url(#");
        });
      } else {
        hit =
          isAccent(cs.backgroundColor) ||
          isAccent(cs.boxShadow) ||
          /linear|radial/.test(cs.backgroundImage);
      }
      if (hit && el.offsetParent) targets.add(el);
    }
    for (const el of targets) {
      if (el.dataset.bsGray) continue;
      el.dataset.bsGray = "1";
      el.style.setProperty("filter", "grayscale(1) brightness(0.85)", "important");
    }
  }

  function instagram() {
    const cfg = state.sites.instagram || {};
    // onlyDMs → direct inbox (F4)
    if (cfg.onlyDMs && !location.pathname.startsWith("/direct")) {
      location.replace("/direct/inbox");
      return;
    }
    // reels/explore → bloquear sin dejar cargar contenido
    if (/^\/(reels|explore)\b/.test(location.pathname)) {
      document.documentElement.style.overflow = "hidden";
      blockOverlay();
      armReblock();
      return;
    }
    // acento neutro: anillos de historias, badges de notificación, iconos con
    // gradiente rosa/rojo de IG → escala de grises (CSS no puede matchear color)
    retry(() => { neutralizeAccent(); return true; });
    // afectado de re-scan: primer cycle inmediato y re-debounce corto (120ms)
    const accentObs = new MutationObserver((_, obs) => {
      // primer cambio → corre YA (sin debounce) para cubrir el primer paint
      try { neutralizeAccent(); } catch {}
      obs.disconnect();
      // a partir de aquí, debounce 120 ms
      let t = null;
      const fast = new MutationObserver(() => {
        if (t) return;
        t = setTimeout(() => { t = null; try { neutralizeAccent(); } catch {} }, 120);
      });
      fast.observe(document.body, { childList: true, subtree: true });
      obs.disconnect();
    });
    accentObs.observe(document.body, { childList: true, subtree: true });
    // home → asegurar pestaña "Siguiendo"
    if (location.pathname === "/" || location.pathname === "") {
      retry(() => {
        const tab = Array.from(
          document.querySelectorAll('a[role="link"], [role="tab"], button')
        ).find((el) => /^siguiendo$|^following$/i.test((el.textContent || "").trim()));
        if (tab) { tab.click(); return true; }
        return false;
      });
      // "Sugerencias para ti" (dcha): anchor = link "Ver todo"
      // (a[href="/explore/people/"]). Escalar hasta el hijo directo de la
      // fila de dos columnas y ocultar SOLO el de la derecha (left > 55%
      // viewport) que no contenga el feed.
      retry(() => {
        const link = document.querySelector('a[href="/explore/people/"]');
        if (!link) return false;
        const main = document.querySelector('main[role="main"]');
        if (!main) return false;
        let panel = null;
        for (const cand of main.querySelectorAll("div")) {
          if (!cand.contains(link)) continue;
          const r = cand.getBoundingClientRect();
          if (r.left > window.innerWidth * 0.55 && !cand.querySelector("article, section[role='feed']")) {
            // el primer match en orden de documento es el ancestro externo: el
            // panel entero. Los siguientes son sus descendientes.
            panel = cand;
            break;
          }
        }
        if (panel) {
          panel.style.display = "none";
          return true;
        }
        return false;
      });
    }
  }

  // ---- YouTube ----
  function youtube() {
    // Sidebar: fuera Explorar (todo el section), Más de YouTube (section),
    // Principal (entry) e Historial de denuncias (entry). Los entries son
    // a#endpoint sin href estable → matchear por TEXTO del entry/section.
    // Regla del usuario: la guía queda con SOLO "Suscripciones"; todo el resto
    // (Principal, Shorts, Tú, Historial, Explorar, Más de YouTube…) fuera.
    const pruneGuide = () => {
      let changed = false;
      // guía expandida + miniguía colapsada (sidebar de iconos)
      for (const ent of document.querySelectorAll(
        "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer"
      )) {
        const t = (ent.textContent || "").trim();
        const KEEP = /suscripciones|subscriptions|\bt[uú]\b|\byou\b|historial|history/i;
        if (!KEEP.test(t)) {
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
      // footer del guía (Acerca de, Prensa, Derechos de autor, etc.)
      for (const f of document.querySelectorAll(
        "ytd-guide-footer-renderer, ytd-mini-guide-footer-renderer"
      )) {
        f.remove(); changed = true;
      }
      return changed;
    };
    retry(pruneGuide);
    // el guía se (re)renderiza al expandir el hamburger → observador persistente
    let ytTimer = null;
    new MutationObserver(() => {
      if (ytTimer) return;
      ytTimer = setTimeout(() => { ytTimer = null; try { pruneGuide(); } catch {} }, 600);
    }).observe(document.body, { childList: true, subtree: true });
    // Shorts → feed de suscripciones; el "solo seguidos" del home lo hace CSS
    if (/^\/shorts\//.test(location.pathname)) {
      location.replace("/feed/subscriptions");
    }
    // regla del usuario: el home SIEMPRE es suscripciones, nunca "Principal"
    if (location.pathname === "/" || location.pathname === "") {
      location.replace("/feed/subscriptions");
    }
  }

  // ---- Reddit ----
  function reddit() {
    if (/^\/(popular|news|explore)\b/.test(location.pathname)) {
      location.replace("/");
    }
  }

  // ---- LinkedIn ----
  function linkedin() {
    const cfg = state.sites.linkedin || {};
    if (location.pathname.startsWith("/feed/")) {
      if (cfg.onlyDMs) { location.replace("/"); return; } // F4: a inicio (CSS lo deja en blanco)
      const col =
        document.querySelector("main .scaffold-finite-scroll__content") ||
        document.querySelector("main");
      if (!col || document.getElementById("bs-linkin-overlay")) return;
      const ov = document.createElement("div");
      ov.id = "bs-linkin-overlay";
      ov.setAttribute("role", "dialog");
      ov.setAttribute("aria-label", "Feed apagado por BarelySocial");
      Object.assign(ov.style, {
        padding: "3rem 1.5rem", borderRadius: "12px",
        background: "#16181d", color: "#f2f2f2",
        fontFamily: "-apple-system,system-ui,sans-serif",
        fontSize: "1.1rem", textAlign: "center", margin: "2rem auto",
        maxWidth: "32rem",
      });
      ov.textContent = "Feed apagado por BarelySocial";
      col.prepend(ov);
    }
  }

  // ---- TikTok ----
  function tiktok() {
    const cfg = state.sites.tiktok || {};
    // onlyDMs → mensajes (F4)
    if (cfg.onlyDMs && !location.pathname.startsWith("/messages")) {
      location.replace("/messages");
      return;
    }
    const onForyou =
      location.pathname === "/" || /^\/(foryou)\b/.test(location.pathname);
    if (!onForyou || location.pathname.startsWith("/following")) return;
    // intentar pestaña "Siguiendo"; como último recurso, ruta /following
    let clicked = false;
    retry(() => {
      const tab = Array.from(
        document.querySelectorAll('a[role="link"], [role="tab"], button')
      ).find((el) => /^(siguiendo|following)$/i.test((el.textContent || "").trim()));
      if (tab) { tab.click(); clicked = true; return true; }
      return false;
    });
    setTimeout(() => {
      if (!clicked) {
        try { history.replaceState(null, "", "/following"); } catch {}
      }
    }, RETRY_MAX * RETRY_MS);
  }

  // ---- arranque: todos fail-open ----
  const handlers = { instagram, youtube, reddit, linkedin, tiktok };
  loadState().catch(() => {}).then(() => {
    try { handlers[site](); } catch {} // nunca romper el sitio
  });
})();
