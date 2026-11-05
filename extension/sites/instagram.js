// BarelySocial — Instagram.
// Feed de solo-seguidos, sugeridos prohibidos, whitelist escaneada del modal
// "Siguiendo", fin/feed-vacío, acento neutro y bloqueo de Reels/Explore.
(() => {
  "use strict";

  const BS = globalThis.__BS;
  const state = BS.state;

  // ---- overlay bloqueante (Reels / Explore) ----
  function blockOverlay() {
    if (document.getElementById("bs-overlay")) return;
    const a = BS.allowanceFor();
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
        BS.consumeAllowance();
        removeOverlay()();
        armReblock(); // deja pasar UNA pieza; el próximo scroll re-bloquea
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

  const blockedPath = () => /^\/(reels|explore)\b/.test(location.pathname);

  // Tras gastar allowance: re-bloquear en el próximo scroll/navegación
  function armReblock() {
    const h = () => {
      if (blockedPath() && !document.getElementById("bs-overlay")) {
        const a = BS.allowanceFor();
        if (!a || a.used >= a.limit) blockOverlay(); // allowance agotado
      }
    };
    addEventListener("scroll", h, { passive: true });
    addEventListener("popstate", h);
  }

  // ---- helpers del feed ----
  const hide = (art, reason) => {
    art.style.setProperty("display", "none", "important");
    art.dataset.bsHidden = "1";
    if (reason) art.dataset.bsReason = reason;
  };

  const ROUTES = new Set(["p", "reel", "reels", "tv", "explore", "direct", "stories", "challenge", "about"]);
  const sanitizeHandle = (href) => {
    const m = /^\/([A-Za-z0-9._]+)\/?(\?.*)?$/.exec(href || "");
    const n = m && m[1].toLowerCase();
    return n && !ROUTES.has(n) ? n : null;
  };

  // frases exactas de sugerido (post a mitad del feed / bloque de fin de feed)
  const PHRASES = new Set(["suggested for you", "sugerencias para ti", "sugerido para ti", "recommended for you", "ver más como este", "see more like this"]);

  // firma de sugerido: botón Follow/Seguir REAL — tus posts nunca lo traen
  const looksSuggested = (art) => {
    for (const b of art.querySelectorAll('button, [role="button"]')) {
      const l = ((b.getAttribute("aria-label") || b.textContent) || "").trim().toLowerCase();
      if (l === "follow" || l === "seguir") return true;
    }
    return false;
  };

  // tarjeta de estado reutilizada por fin-de-feed y feed-vacío
  const banner = (id, text, padding, margin) => {
    let card = document.getElementById(id);
    if (card) return card;
    card = document.createElement("div");
    card.id = id;
    card.setAttribute("role", "status");
    Object.assign(card.style, {
      padding, margin, borderRadius: "12px", maxWidth: "470px",
      textAlign: "center", background: "#161822", color: "#9aa3af",
      font: "14px/1.5 -apple-system, system-ui, sans-serif",
    });
    card.textContent = text;
    return card;
  };

  // ---- whitelist de seguidos (escaneo del modal "Siguiendo") ----
  // IG no expone "a quién sigo" en el DOM del feed: escaneamos el modal del
  // perfil y comparamos. Se persiste SOLO al terminar dos rondas sin novedad —
  // una lista parcial excluye a gente que sí sigues (caso xataka).
  const scan = { tries: 0, idle: 0, el: null, cur: new Set() };
  const scrollableOf = (modal) => {
    let best = null;
    for (const d of modal.querySelectorAll("div")) {
      if (d.scrollHeight > d.clientHeight + 40) best = d;
    }
    return best || modal;
  };
  const scanFollowingModal = () => {
    const modal = document.querySelector("div[role='dialog']");
    if (!modal) { scan.el = null; return false; }
    if (scan.el !== modal) { scan.el = modal; scan.tries = 0; scan.idle = 0; scan.cur.clear(); }
    const names = new Set();
    for (const a of modal.querySelectorAll("a[href]")) {
      const n = sanitizeHandle(a.getAttribute("href"));
      if (n) names.add(n);
    }
    for (const n of names) scan.cur.add(n);
    const scroller = scrollableOf(modal);
    const done = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 30;
    if (done || names.size === 0) {
      scan.idle += 1;
      if (scan.idle >= 2 && scan.cur.size > 0) {
        BS.setStore({ following: [...scan.cur].sort() });
        scan.el = null; // deshacer la marca: el modal se cierra solo
        return true;
      }
    } else {
      scan.idle = 0;
      scroller.scrollTop = Math.min(scroller.scrollTop + scroller.clientHeight, scroller.scrollHeight);
    }
    scan.tries += 1;
    if (scan.tries > 400) { scan.el = null; } // reincidencia límite
    return true;
  };

  // ---- fin de feed / feed vacío ----
  let feedEnded = false;

  const showEmptyFeed = () => {
    if (!feedEnded) { feedEnded = true; document.documentElement.dataset.bsFeedEnd = "1"; }
    if (document.getElementById("bs-feed-empty")) return;
    const card = banner(
      "bs-feed-empty",
      "Tu feed está vacío ahora mismo — nadie de tu lista ha publicado todavía. Es silencio real, no un error.",
      "34px 22px", "16vh auto"
    );
    const feed = document.querySelector("main article")?.parentElement
      || document.querySelector("main section");
    if (feed) feed.appendChild(card);
  };

  // el algoritmo intenta rellenar → declaramos el fin y frenamos el scroll infinito
  const showFeedEnd = () => {
    feedEnded = true;
    // flag persistente (sobrevive reciclos de DOM de IG) + mata los loaders
    document.documentElement.dataset.bsFeedEnd = "1";
    for (const sp of document.querySelectorAll('main [role="progressbar"], main svg[role="progressbar"]')) {
      sp.style.setProperty("display", "none", "important");
    }
    if (document.getElementById("bs-feed-end")) return;
    // ancla estable: el contenedor real del feed es el padre del 1er article
    const feed = document.querySelector("main article")?.parentElement;
    if (!feed) return;
    const card = banner(
      "bs-feed-end",
      "Llegaste al final de tu feed de seguidos. Instagram quería rellenarlo con sugerencias — BarelySocial lo frenó.",
      "28px 20px", "12px auto 40px"
    );
    // botón de cortesía: volver arriba, que es donde vive el contenido real
    const btn = document.createElement("button");
    btn.textContent = "Volver arriba ↑";
    Object.assign(btn.style, {
      display: "block", margin: "10px auto 0", padding: "8px 18px",
      borderRadius: "8px", border: "1px solid #2a2f3a", background: "transparent",
      color: "#c9ced6", font: "inherit", cursor: "pointer",
    });
    btn.onclick = () => {
      // IG scrollea en un contenedor interno (window.scrollY=0)
      let sc = null;
      for (const d of document.querySelectorAll("main div")) {
        if (d.scrollHeight > d.clientHeight + 60) { sc = d; break; }
      }
      if (sc) sc.scrollTo({ top: 0, behavior: "smooth" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    card.appendChild(btn);
    feed.appendChild(card);
    // pin permanente: la tarjeta VIAJA al final y cualquier article apilado
    // DESPUÉS de ella se oculta (anti scroll infinito)
    window.enforceFeedEnd = () => {
      const c = document.getElementById("bs-feed-end");
      if (!c || !c.parentElement) return;
      c.parentElement.appendChild(c); // re-pin al fondo del feed
      let seen = false;
      for (const child of Array.from(c.parentElement.children)) {
        if (child === c) { seen = true; continue; }
        if (seen && child.tagName === "ARTICLE") {
          hide(child, "post-feed-end");
        }
      }
    };
    window.enforceFeedEnd();
    // banner en cuanto alcance el fondo del scroll interno
    addEventListener("scroll", () => {
      if (location.pathname !== "/" && location.pathname !== "") return;
      try {
        for (const d of document.querySelectorAll("main div")) {
          if (d.scrollHeight > d.clientHeight + 60) {
            if (d.scrollTop + d.clientHeight >= d.scrollHeight - 200) {
              showFeedEnd();
              window.enforceFeedEnd();
            }
            break;
          }
        }
      } catch {}
    }, { passive: true });
  };

  // ---- scrub del feed: whitelist si existe; si no, heurística exacta ----
  const scrubByWhitelist = () => {
    const list = state.following;
    if (!list || !list.length) return;
    const followed = new Set(list.map((s) => s.toLowerCase()));
    for (const art of document.querySelectorAll("article")) {
      const aTop = art.getBoundingClientRect().top;
      // creadores = SOLO links de la zona de cabecera (~140px). Los @mentions
      // del caption están más abajo y no cuentan.
      const handles = [...art.querySelectorAll('a[href^="/"]')]
        .filter((a) => {
          const y = a.getBoundingClientRect().top - aTop;
          return y >= -4 && y <= 140 && a.getBoundingClientRect().height <= 40;
        })
        .map((a) => sanitizeHandle(a.getAttribute("href")))
        .filter(Boolean);
      if (!handles.length) continue;
      // regla: collab (≥2 creadores) si al menos uno sigue
      if (!handles.some((h) => followed.has(h))) hide(art, "not-followed");
    }
    // feed-end / feed-vacío SOLO en la página de feed ("/") — perfiles,
    // /explore y grids no usan article
    if (location.pathname !== "/" && location.pathname !== "") return;
    const visibleArticles = [...document.querySelectorAll("main article")]
      .filter((a) => !a.dataset.bsHidden && a.getBoundingClientRect().height > 0).length;
    if (!feedEnded) {
      if (visibleArticles === 0) showEmptyFeed();
      else if (!document.querySelector("main article")) showFeedEnd();
    }
    if (feedEnded && visibleArticles === 0) showEmptyFeed(); // reinsertar si IG la borró
  };

  const pruneSuggested = () => {
    let changed = false;
    for (const el of document.querySelectorAll("span, div, h2")) {
      const t = (el.textContent || "").trim().toLowerCase();
      if (!PHRASES.has(t) || !el.offsetParent) continue;
      //  (a) <article> con botón Seguir/Follow (sugeridos a mitad del feed)
      //  (b) bloque grande (≥380px) con el heading exacto (fin-de-feed)
      const art = el.closest("article") || el.closest("[role='article']") || el.closest("[role='presentation']");
      if (art) {
        if (!art.dataset.bsHidden && looksSuggested(art)) {
          hide(art); changed = true;
          if (!feedEnded) showFeedEnd();
        }
        continue;
      }
      // (b): escalar al ancestro de ≥380px, que envuelve TODAS las tarjetas
      let block = el.parentElement;
      for (let i = 0; i < 8 && block; i++) {
        if (block.getBoundingClientRect().height >= 380) {
          if (!block.dataset.bsHidden) {
            hide(block); changed = true;
            if (!feedEnded) showFeedEnd();
          }
          break;
        }
        block = block.parentElement;
      }
    }
    // auto-reparación: si un post oculto NO tiene firma de sugerido
    // (IG re-renderiza el DOM tras hide), se restaura
    for (const art of document.querySelectorAll('[data-bs-hidden="1"]')) {
      const t = (art.textContent || "").toLowerCase();
      if (!looksSuggested(art) && !/suggested|sugerid/.test(t)) {
        art.style.removeProperty("display");
        delete art.dataset.bsHidden; changed = true;
      }
    }
    return changed;
  };

  // ---- acento neutro ----
  // IG usa stylesheet ofuscado, pero los "acentos" son SIEMPRE elementos
  // pequeños y redondos con gradiente, shadow de color o SVG degradado:
  // story rings, badges, iconos.
  const neutralizeAccent = () => {
    const ACCENT = /rgba?\(\s*(2(?:4[0-9]|5[0-5]))\s*,\s*(\d|[1-9]\d)\s*[),]/;
    const isAccent = (str) => ACCENT.test(str);
    const targets = new Set();
    for (const el of document.querySelectorAll("div, span, svg")) {
      const cs = getComputedStyle(el);
      if (!el.offsetParent || cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      // los acentos nunca exceden ~220px; por encima es contenido real.
      if (r.width > 220 || r.height > 220) continue;
      let hit = false;
      if (el.tagName === "SVG") {
        hit = el.querySelector("linearGradient, radialGradient, stop") != null;
      } else if (el.tagName === "CANVAS") {
        // el anillo de historias se dibuja en un canvas chico
        hit = r.width <= 220 && r.height <= 220;
      } else {
        hit =
          /gradient/i.test(cs.backgroundImage) ||
          isAccent(cs.backgroundColor) ||
          isAccent(cs.boxShadow);
      }
      if (hit) targets.add(el);
    }
    for (const el of targets) {
      if (el.dataset.bsGray) continue;
      el.dataset.bsGray = "1";
      el.style.setProperty("filter", "grayscale(1) brightness(0.85)", "important");
    }
  };

  // ---- arranque ----
  BS.boot(() => {
    const cfg = state.sites.instagram || {};
    // onlyDMs → direct inbox
    if (cfg.onlyDMs && !location.pathname.startsWith("/direct")) {
      location.replace("/direct/inbox");
      return;
    }
    // reels/explore → bloquear sin dejar cargar contenido
    if (blockedPath()) {
      document.documentElement.style.overflow = "hidden";
      blockOverlay();
      armReblock();
      return;
    }

    BS.retry(pruneSuggested);
    BS.retry(scrubByWhitelist);
    BS.retry(scanFollowingModal);

    let igTimer = null;
    new MutationObserver(() => {
      if (igTimer) return;
      igTimer = setTimeout(() => {
        igTimer = null;
        for (const n of [pruneSuggested, scrubByWhitelist, neutralizeAccent, scanFollowingModal]) {
          try { n(); } catch {}
        }
        if (feedEnded && window.enforceFeedEnd) { try { window.enforceFeedEnd(); } catch {} }
      }, 150);
    }).observe(document.body, { childList: true, subtree: true });

    BS.retry(() => { neutralizeAccent(); return true; });

    // home → asegurar pestaña "Siguiendo"
    if (location.pathname === "/" || location.pathname === "") {
      BS.retry(() => {
        const tab = BS.findTab(/^(siguiendo|following)$/i);
        if (tab) { tab.click(); return true; }
        return false;
      });
      // "Sugerencias para ti" (dcha): anchor = link "Ver todo"; escalar al
      // hijo directo de la fila de dos columnas y ocultar SOLO el de la
      // derecha (left > 55% viewport) que no contenga el feed.
      BS.retry(() => {
        const link = document.querySelector('a[href="/explore/people/"]');
        if (!link) return false;
        const main = document.querySelector('main[role="main"]');
        if (!main) return false;
        for (const cand of main.querySelectorAll("div")) {
          if (!cand.contains(link)) continue;
          const r = cand.getBoundingClientRect();
          if (r.left > window.innerWidth * 0.55 && !cand.querySelector("article, section[role='feed']")) {
            cand.style.display = "none";
            return true;
          }
        }
        return false;
      });
    }
  });
})();
