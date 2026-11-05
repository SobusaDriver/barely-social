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
      .get(["sites", "allowance", "following"])
      .then((r) => {
        state.sites = r.sites || {};
        state.allowance = r.allowance || {};
        state._followingList = r.following || [];
      })
      .catch(() => {});
  }

  function chromeStorageSet(obj) {
    if (!api || !api.storage || !api.storage.local) return Promise.resolve();
    return api.storage.local.set(obj).then(() => {
      if (obj.following) state._followingList = obj.following;
    }).catch(() => {});
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
    // Estrategia geométrica: IG usa stylesheet ofuscado (nada matcheable por
    // nombre/clase/atributo), pero los "acento" son SIEMPRE elementos pequeños
    // y redondos respaldados por gradiente, shadow de color o SVG degradado:
    // story rings, badges de notificación, íconos. Escaneo limitado y barato.
    const ACCENT = /rgba?\(\s*(2(?:4[0-9]|5[0-5]))\s*,\s*(\d|[1-9]\d)\s*[),]/;
    const isAccent = (str) => ACCENT.test(str);
    const targets = new Set();
    for (const el of document.querySelectorAll("div, span, svg")) {
      const cs = getComputedStyle(el);
      if (!el.offsetParent || cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      // los elementos de acento nunca exceden ~ 220px (story avatar/máx);
      // por encima de eso es contenido real (cards, modales, fotos feas).
      if (r.width > 220 || r.height > 220) continue;
      let hit = false;
      if (el.tagName === "SVG") {
        hit = el.querySelector("linearGradient, radialGradient, stop") != null;
      } else if (el.tagName === "CANVAS") {
        // el anillo de historias de IG se dibuja en un canvas chico
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
    // ---- whitelist de seguidos (escaneo del modal "Siguiendo") ----
    // Único arbitro real de multi-creador: IG no expone "a quién sigo" en el
    // DOM del feed, así que escaneamos el modal del perfil (una sola vez)
    // y comparamos: cualquier creador NO seguido → post puesto unnecessary.
    const ROUTES = new Set(["p", "reel", "reels", "tv", "explore", "direct", "stories", "challenge", "about"]);
    const sanitizeHandle = (href) => {
      const m = /^\/([A-Za-z0-9._]+)\/?(\?.*)?$/.exec(href || "");
      const n = m && m[1].toLowerCase();
      return n && !ROUTES.has(n) ? n : null;
    };
    // Scanner del modal "Siguiendo": auto-scroll hasta el final (la lista
    // es paginada); persiste SOLO cuando dos rondas seguidas no traen nada
    // nuevo — una lista parcial genera falsos "no seguido" y es excluir
    // posts de gente que sí sigue (caso xataka). Sin escaneo completo:
    // no hay lista, no hay scrub por whitelist.
    const scanState = { tries: 0, idle: 0, el: null, cur: new Set() };
    const scrollableOf = (modal) => {
      let best = null;
      for (const d of modal.querySelectorAll("div")) {
        if (d.scrollHeight > d.clientHeight + 40) best = d;
      }
      return best || modal;
    };
    const scanFollowingModal = () => {
      const modal = document.querySelector("div[role='dialog']");
      if (!modal) { scanState.el = null; return false; }
      if (scanState.el !== modal) { scanState.el = modal; scanState.tries = 0; scanState.idle = 0; scanState.cur.clear(); }
      const names = new Set();
      for (const a of modal.querySelectorAll("a[href]")) {
        const n = sanitizeHandle(a.getAttribute("href"));
        if (n) names.add(n);
      }
      for (const n of names) scanState.cur.add(n);
      const scroller = scrollableOf(modal);
      const done = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 30;
      if (done || names.size === 0) {
        scanState.idle += 1;
        if (scanState.idle >= 2 && scanState.cur.size > 0) {
          chromeStorageSet({ following: [...scanState.cur].sort() });
          // deshacer la marca de "escaneo abierto" — el modal se cierra solo
          scanState.el = null;
          return true;
        }
      } else {
        scanState.idle = 0;
        scroller.scrollTop = Math.min(scroller.scrollTop + scroller.clientHeight, scroller.scrollHeight);
      }
      scanState.tries += 1;
      if (scanState.tries > 400) { scanState.el = null; } // reincidencia límite
      return true;
    };
    // ---- feed scrub con whitelist si existe; sin whitelist, heurística actual ----
    const showEmptyFeed = () => {
      if (!feedEnded) { feedEnded = true; document.documentElement.dataset.bsFeedEnd = "1"; }
      if (feedEnded && !document.getElementById("bs-feed-empty")) {
        const card = document.createElement("div");
        card.id = "bs-feed-empty";
        card.setAttribute("role", "status");
        Object.assign(card.style, {
          padding: "34px 22px", margin: "16vh auto", borderRadius: "12px",
          maxWidth: "470px", textAlign: "center", background: "#161822",
          color: "#9aa3af", font: "14px/1.5 -apple-system, system-ui, sans-serif",
        });
        card.textContent =
          "Tu feed está vacío ahora mismo — nadie de tu lista ha publicado todavía. Es silencio real, no un error.";
        const feed = document.querySelector("main article")?.parentElement
          || document.querySelector("main section");
        if (feed) feed.appendChild(card);
      }
    };
    const scrubByWhitelist = () => {
      const list = state._followingList;
      if (!list || !list.length) return false;
      const followed = new Set(list.map((s) => s.toLowerCase()));
      let changed = false;
      for (const art of document.querySelectorAll("article")) {
        const aTop = art.getBoundingClientRect().top;
        // creadores = SOLO los links de la zona de cabecera (primer ~140px
        // del article). Los @mentions del caption/lista de tags están MÁS
        // ABAJO y no cuentan — un post de tu gente con una mención a una
        // cuenta que no sigues debe seguir viéndose.
        const handles = [...art.querySelectorAll('a[href^="/"]')]
          .filter((a) => {
            const y = a.getBoundingClientRect().top - aTop;
            return y >= -4 && y <= 140 && a.getBoundingClientRect().height <= 40;
          })
          .map((a) => sanitizeHandle(a.getAttribute("href")))
          .filter(Boolean);
        if (!handles.length) continue;
        const followedInHeader = handles.some((h) => followed.has(h));
        // regla: collab (≥2 creadores) si alguien sigue; single si el creador sigue
        if (!followedInHeader) {
          hide(art); art.dataset.bsReason = "not-followed";
        }
      }
      // feed-end: cuando el scrub tapa el ÚLTIMO post no seguido, IG intenta
      // rellenar en su lugar: showFeedEnd lo marca; se llama en el observer
      // feed VACÍO real: cero articles visibles tras el scrub → aviso claro
      const visibleArticles = [...document.querySelectorAll("main article")]
        .filter((a) => !a.dataset.bsHidden && a.getBoundingClientRect().height > 0).length;
      if (!feedEnded) {
        if (visibleArticles === 0) showEmptyFeed();
        else if (!document.querySelector("main article")) showFeedEnd();
      }
      if (feedEnded && visibleArticles === 0 && !document.getElementById("bs-feed-empty")) {
        // IG puede borrar la card al re-renderizar el scroll: reinsertar
        showEmptyFeed();
      }
      return;
    };
    // seguidos: OCULTAR (no remove — derribar DOM rompe React de IG y genera
    // su error boundary "Something went wrong", que oculta posts reales).
    // La frase se matchea exacta + debe existir botón Follow/Seguir en el
    // article (firma de post sugerido; el caption de tu gente no lo tiene).
    const phrase = new Set(["suggested for you", "sugerencias para ti", "sugerido para ti", "recommended for you", "ver más como este", "see more like this"]);
    // firma de sugerido: botón "Follow"/"Seguir" REAL (por texto o aria) —
    // tus posts nunca lo traen; los sugeridos siempre lo traen
    const looksSuggested = (art) => {
      for (const b of art.querySelectorAll('button, [role="button"]')) {
        const l = ((b.getAttribute("aria-label") || b.textContent) || "").trim().toLowerCase();
        if (l === "follow" || l === "seguir") return true;
      }
      return false;
    };
    const hide = (art) => {
      art.style.setProperty("display", "none", "important");
      art.dataset.bsHidden = "1";
    };
    let feedEnded = false;
    // fin de feed visible y verde: cuando el algoritmo intenta rellenar,
    // BarelySocial declara el fin de tu contenido y detiene el scroll infinito
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
      const card = document.createElement("div");
      card.id = "bs-feed-end";
      card.setAttribute("role", "status");
      Object.assign(card.style, {
        padding: "28px 20px", margin: "12px auto 40px", borderRadius: "12px",
        maxWidth: "470px", textAlign: "center", background: "#161822",
        color: "#9aa3af", font: "14px/1.5 -apple-system, system-ui, sans-serif",
      });
      card.textContent =
        "Llegaste al final de tu feed de seguidos. Instagram quería rellenarlo con sugerencias — BarelySocial lo frenó.";
      // botón de cortesía: volver arriba, que es donde vive el contenido real
      const btn = document.createElement("button");
      btn.textContent = "Volver arriba ↑";
      Object.assign(btn.style, {
        display: "block", margin: "10px auto 0", padding: "8px 18px",
        borderRadius: "8px", border: "1px solid #2a2f3a", background: "transparent",
        color: "#c9ced6", font: "inherit", cursor: "pointer",
      });
      btn.onclick = () => {
        // IG scrollea en un contenedor interno (window.scrollY=0): buscar el
        // primer scrollable real y subirlo; fallback window.scrollTo
        let sc = null;
        for (const d of document.querySelectorAll("main div")) {
          if (d.scrollHeight > d.clientHeight + 60) { sc = d; break; }
        }
        if (sc) sc.scrollTo({ top: 0, behavior: "smooth" });
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      card.appendChild(btn);
      feed.appendChild(card);
      feedEnded = true;
      // pin permanente: la tarjeta VIAJA al final del feed y cualquier
      // article que IG apile DESPUÉS de ella se oculta (anti scroll infinito)
      window.enforceFeedEnd = () => {
        const c = document.getElementById("bs-feed-end");
        if (!c || !c.parentElement) return;
        c.parentElement.appendChild(c); // re-pin al fondo del feed
        let seen = false;
        for (const child of Array.from(c.parentElement.children)) {
          if (child === c) { seen = true; continue; }
          if (seen && child.tagName === "ARTICLE") {
            child.style.setProperty("display", "none", "important");
            child.dataset.bsHidden = "1";
            child.dataset.bsReason = "post-feed-end";
          }
        }
      };
      enforceFeedEnd();
      // banner en cuanto alcance el fondo del scroll interno (el trigger
      // humano: llegaste hasta abajo = fin de tu contenido)
      const scr = () => {
        for (const d of document.querySelectorAll("main div")) {
          if (d.scrollHeight > d.clientHeight + 60) {
            if (d.scrollTop + d.clientHeight >= d.scrollHeight - 200) {
              showFeedEnd();
              enforceFeedEnd();
            }
            break;
          }
        }
      };
      addEventListener("scroll", () => { try { scr(); } catch {} }, { passive: true });
    };
    const pruneSuggested = () => {
      let changed = false;
      for (const el of document.querySelectorAll("span, div, h2")) {
        const t = (el.textContent || "").trim().toLowerCase();
        if (!phrase.has(t) || !el.offsetParent) continue;
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
        // (b): escalar al ancestro alto-más, que envuelve TODAS las tarjetas
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
      // (ocurre cuando IG re-renderiza el DOM tras hide), se restaura
      for (const art of document.querySelectorAll('[data-bs-hidden="1"]')) {
        const t = (art.textContent || "").toLowerCase();
        if (!looksSuggested(art) && !/suggested|sugerid/.test(t)) {
          art.style.removeProperty("display");
          delete art.dataset.bsHidden; changed = true;
        }
      }
      return changed;
    };
    retry(pruneSuggested);
    retry(scrubByWhitelist);
    retry(scanFollowingModal);
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
    // acento neutro: anillos de historias, badges de notificación, iconos con
    // gradiente rosa/rojo de IG → escala de grises (CSS no puede matchear color)
    retry(() => { neutralizeAccent(); return true; });
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
    // Estantes del feed de Suscripciones: "Más relevantes" (algoritmo) fuera;
    // queda cronológico ("Más recientes") — regla del usuario.
    const pruneShelves = () => {
      let changed = false;
      for (const sh of document.querySelectorAll("ytd-rich-section-renderer")) {
        const t = (sh.textContent || "").trim();
        if (/relevant/i.test(t)) { sh.remove(); changed = true; }
      }
      return changed;
    };
    retry(pruneShelves);
    // el guía se (re)renderiza al expandir el hamburger → observador persistente
    let ytTimer = null;
    new MutationObserver(() => {
      if (ytTimer) return;
      ytTimer = setTimeout(() => { ytTimer = null; try { pruneGuide(); pruneShelves(); } catch {} }, 600);
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
    // SPA: las redes cambian de ruta con pushState/replaceState (sin request
    // de red) — en YouTube eso permitiría que el home reaparezca sin que el
    // redirect del home (DNR) se entere. Re-disparo el handler en cada cambio.
    if (site === "youtube") {
      ["pushState", "replaceState"].forEach((f) => {
        const orig = history[f];
        history[f] = function (...a) {
          const r = orig.apply(this, a);
          setTimeout(() => { try { handlers[site](); } catch {} }, 60);
          return r;
        };
      });
      addEventListener("popstate", () => { try { handlers[site](); } catch {} });
    }
  });
})();
