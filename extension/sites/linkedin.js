// BarelySocial — LinkedIn.
// Superficie única: My Network. El feed algorítmico ("For you" y home) no
// existe, y la publicidad del feed / upsells de Premium se ocultan.
(() => {
  "use strict";

  const BS = globalThis.__BS;
  const NETWORK = "/feed/network/";

  // El tab "For you" navega con pushState a /feed/foryou/ sin recargar; el
  // home (/feed/) es el mismo feed algorítmico. Los posts individuales
  // (/feed/update/...) NO se tocan: son contenido, no superficie.
  const isFeedSurface = (p) =>
    p === "" || p === "/" || p === "/feed" || p === "/feed/" ||
    /^\/feed\/foryou\b/.test(p);

  const route = () => {
    if (isFeedSurface(location.pathname)) location.replace(NETWORK);
  };

  const hide = (el, reason) => {
    if (!el || el.dataset.bsHidden) return;
    el.style.setProperty("display", "none", "important");
    el.dataset.bsHidden = "1";
    el.dataset.bsReason = reason;
  };

  // Oculta el bloque cuyo título casa, subiendo solo mientras el padre siga
  // empezando por ese mismo título (así no se come el panel de detalle).
  const hideTitleBlock = (re, maxH) => {
    for (const el of document.querySelectorAll("main p, main h2, main h3")) {
      const title = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!re.test(title)) continue;
      let card = el;
      for (let i = 0; i < 6 && card.parentElement; i++) {
        const p = card.parentElement;
        const pt = (p.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (p.getBoundingClientRect().height > maxH || !pt.startsWith(title.toLowerCase())) break;
        card = p;
      }
      hide(card, "jobs-ad");
    }
  };

  // Publicidad dentro del detalle de la oferta: "See jobs where you're a top
  // applicant" y "Get personalized tips to stand out to hirers" (Premium).
  const hideJobAds = () => {
    hideTitleBlock(/^see jobs where you.re a top applicant$/i, 300);
    hideTitleBlock(/^get personalized tips to stand out to hirers$/i, 300);
    // slot por id: cubre variantes de copy
    for (const el of document.querySelectorAll('[id^="JobDetails_PremiumApplicantInsights_"]')) {
      hide(el, "jobs-ad");
    }
  };

  // Home: si el rail derecho quedó vacío (puzzles/ads ocultos), el feed
  // reclama ese ancho. La clase se pone en el grid de 24 columnas.
  const reflowFeed = () => {
    const list = document.querySelector('[data-testid="NetworkFeedListCollection"]');
    const grid = list?.closest('section[aria-label="Primary content"]')?.parentElement;
    if (!grid || window.innerWidth < 1024) {
      document.querySelectorAll(".bs-wide-feed").forEach((g) => g.classList.remove("bs-wide-feed"));
      return;
    }
    const aside = grid.querySelector(':scope > aside[aria-label="Aside"]');
    if (!aside) return;
    const hasContent = [...aside.querySelectorAll("*")].some(
      (e) => e.offsetParent && e.getBoundingClientRect().height > 20
    );
    grid.classList.toggle("bs-wide-feed", !hasContent);
  };

  // Ads, promos y relleno del feed/rail/My Network. "People you may know"
  // (en sus dos variantes) y "Suggestions for you" son personas reales: se
  // quedan.
  const clean = () => {
    // Feed: el ad se marca con el texto exacto "Promoted" (o "Promocionado").
    // El card es el [role="listitem"] que lo contiene — la lista está
    // virtualizada, así que el nodo existe aunque esté fuera de viewport.
    const q = document.evaluate(
      "//main//*[normalize-space()='Promoted' or normalize-space()='Promocionado']",
      document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
    );
    for (let i = 0; i < q.snapshotLength; i++) {
      const card = q.snapshotItem(i).closest('[role="listitem"]');
      if (card) hide(card, "promoted");
    }
    // Mensajería: LinkedIn inyecta conversaciones publicitarias en la lista
    // con etiqueta propia ("Promoted"/"Sponsored") o "LinkedIn Offer".
    // InMail y mensajes reales se quedan.
    for (const row of document.querySelectorAll('ul[aria-label="Conversation List"] > li')) {
      const promo = [...row.querySelectorAll("span, p")].some((e) =>
        /^(promoted|promocionado|sponsored|patrocinado|linkedin offer)$/i.test((e.textContent || "").trim())
      );
      if (promo) hide(row, "promoted-message");
    }
    // Rail: upsell de Premium (ancla exacta). Se oculta solo su bloque,
    // subiendo mientras el padre contenga EXACTAMENTE el mismo texto — el
    // mini-perfil (que contiene el link) jamás entra en el hide.
    for (const a of document.querySelectorAll('a[href*="upsellSlotId=IDENTITY_MODULE"]')) {
      const t = (a.textContent || "").replace(/\s+/g, " ").trim();
      let e = a;
      while (e.parentElement && e.parentElement.tagName !== "ASIDE" &&
             (e.parentElement.textContent || "").replace(/\s+/g, " ").trim() === t) {
        e = e.parentElement;
      }
      hide(e, "premium-upsell");
    }
    // /mynetwork/grow/: promos de juegos ("Need a 30 second break? … Zip") y
    // "People who viewed your profile" (analytics + Unlock all with Premium).
    // La sección externa es la tarjeta; People you may know NO empieza así.
    for (const s of document.querySelectorAll("main section")) {
      const t = (s.textContent || "").replace(/\s+/g, " ").trim();
      if (/^(need a 30 second break|zip is linkedin)/i.test(t) ||
          /^(people who viewed your profile|personas que vieron tu perfil)/i.test(t)) {
        hide(s, "junk");
      }
    }
    // Jobs: panel de filtros avanzados + blocklists (solo en /jobs/*)
    if (onJobs()) {
      hideJobAds();
      injectJobs();
      applyCardFilters();
    } else {
      injectJobs(); // limpia la UI al salir de /jobs
    }
    reflowFeed();
  };

  // ---- Jobs: filtros avanzados ----
  // Set alineado con los proyectos open-source de referencia para búsqueda de
  // empleo (spinlud/linkedin-jobs-scraper, JobFunnel): fecha, experiencia,
  // tipo de empleo, Easy Apply y listas de exclusión por título/empresa.
  // La UI actual de LinkedIn solo respeta f_TPR/f_AL en la URL, así que el
  // resto se aplica sobre sus propios controles (misma sesión de búsqueda,
  // sin recargar).
  const onJobs = () => location.pathname.startsWith("/jobs");

  const DATE_OPTS = {
    "1h": ["Past 24 hours", "Últimas 24 horas"], // LinkedIn no tiene "última hora": 24 h + filtro local
    "24h": ["Past 24 hours", "Últimas 24 horas"],
    week: ["Past week", "Última semana"],
    month: ["Past month", "Último mes"],
  };
  const EXP_OPTS = {
    entry: ["Entry-level", "Nivel inicial"],
    senior: ["Senior"],
    manager: ["Manager", "Gerente"],
    director: ["Director"],
    executive: ["Executive", "Ejecutivo"],
  };
  const EMP_OPTS = {
    full: ["Full-time", "Jornada completa"],
    part: ["Part-time", "Media jornada"],
    contract: ["Contract", "Contrato"],
    temporary: ["Temporary", "Temporal"],
    internship: ["Internship", "Prácticas"],
    volunteer: ["Volunteer", "Voluntariado"],
  };
  const FILTER_RES = {
    date: /^(Date posted|Past 24 hours|Past week|Past month)$/i,
    experience: /^(Experience level|Entry-level|Senior|Manager|Director|Executive)$/i,
    employment: /^(Employment type|Full-time|Part-time|Contract|Temporary|Internship|Volunteer)$/i,
  };
  const JOBS_DEFAULT = {
    date: "", experience: "", employment: "", remote: false, easy: false,
    excludeTitles: "", excludeCompanies: "",
  };

  const jobsState = () => Object.assign({}, JOBS_DEFAULT, BS.state.jobs || {});
  const norm = (e) => (e ? (e.textContent || "").replace(/\s+/g, " ").trim() : "");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 2500) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      let v = null;
      try { v = fn(); } catch {}
      if (v) return v;
      await sleep(80);
    }
    return null;
  };

  const jobsBar = () => document.querySelector("#JobsSearchFilters");
  const barButton = (kind) => {
    const bar = jobsBar();
    return bar ? [...bar.querySelectorAll('[role="button"]')].find((b) => FILTER_RES[kind].test(norm(b))) : null;
  };
  const portal = () => document.querySelector("[data-floating-ui-portal]");
  const showResults = () => {
    const p = portal();
    return p ? [...p.querySelectorAll('button, [role="button"]')].find((b) => /^(show results|ver resultados)$/i.test(norm(b))) : null;
  };

  const setCheck = async (label, on) => {
    const input = await until(() => document.querySelector('#JobsSearchFilters input[aria-label="Filter by ' + label + '"]'));
    if (!input || input.checked === on) return;
    input.click();
    await sleep(450);
  };

  const applyOption = async (kind, texts) => {
    const btn = await until(() => barButton(kind));
    if (!btn) return;
    if (btn.getAttribute("aria-expanded") !== "true") btn.click();
    const p = await until(portal);
    if (!p) return;
    const opt = [...p.querySelectorAll("p")].find((el) =>
      texts.some((t) => norm(el).toLowerCase() === t.toLowerCase())
    );
    if (!opt) return;
    (opt.closest("label") || opt).click();
    const show = await until(showResults);
    if (show) show.click();
    await until(() => !portal(), 3000);
    await sleep(400);
  };

  const clearOption = async (kind, opts) => {
    const btn = await until(() => barButton(kind));
    if (!btn) return;
    const label = norm(btn).toLowerCase();
    const applied = Object.values(opts).some((texts) => texts.some((t) => t.toLowerCase() === label));
    if (!applied) return; // nada que limpiar
    if (btn.getAttribute("aria-expanded") !== "true") btn.click();
    const p = await until(portal);
    if (!p) return;
    const input = [...p.querySelectorAll("input")].find((i) => i.checked);
    if (input) (input.closest("label") || input).click();
    const show = await until(showResults);
    if (show) show.click();
    await until(() => !portal(), 3000);
    await sleep(350);
  };

  const applyNative = async () => {
    const j = jobsState();
    if (!(await until(jobsBar, 4000))) return false;
    await setCheck("Remote", !!j.remote);
    await setCheck("Easy Apply", !!j.easy);
    for (const [kind, opts] of [["date", DATE_OPTS], ["experience", EXP_OPTS], ["employment", EMP_OPTS]]) {
      if (j[kind]) await applyOption(kind, opts[j[kind]] || []);
      else await clearOption(kind, opts);
    }
    return true;
  };

  // Blocklist (estilo JobFunnel) + "última hora" (filtro local): oculta
  // tarjetas ya renderizadas. El card es el [role="button"] que contiene el
  // botón "Dismiss <puesto> job".
  const termsOf = (v) => String(v || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

  // antigüedad de la oferta en minutos; null = sin dato → fail-open
  const ageMinutes = (text) => {
    const t = text.toLowerCase();
    if (/just now|ahora mismo|hace un momento/.test(t)) return 0;
    let m = /hace\s+(\d+)\s*(?:min|minuto)/.exec(t) ||
            /(\d+)\s*(?:min|minute|minuto)s?\s*(?:ago|atrás)/.exec(t);
    if (m) return Number(m[1]);
    m = /hace\s+(\d+)\s*(?:hora|h\b)/.exec(t) ||
        /(\d+)\s*(?:hour|hrs?|h|hora)s?\s*(?:ago|atrás)/.exec(t);
    if (m) return Number(m[1]) * 60;
    m = /hace\s+(\d+)\s*(?:día|semana|mes|año)/.exec(t) ||
        /(\d+)\s*(?:day|días?|week|semanas?|month|mes(?:es)?|year|años?)\s*(?:ago|atrás)/.exec(t);
    if (m) return Number(m[1]) * 1440; // basta para descartar (>1 h)
    return null;
  };

  const setCard = (card, reason) => {
    card.style.setProperty("display", "none", "important");
    card.dataset.bsHidden = "1";
    card.dataset.bsReason = reason;
  };
  const clearCard = (card) => {
    card.style.removeProperty("display");
    delete card.dataset.bsHidden;
    delete card.dataset.bsReason;
  };

  const applyCardFilters = () => {
    const j = jobsState();
    const blocked = [...termsOf(j.excludeTitles), ...termsOf(j.excludeCompanies)];
    const lastHour = j.date === "1h";
    for (const dismiss of document.querySelectorAll('main button[aria-label^="Dismiss "]')) {
      const card = dismiss.closest('[role="button"]');
      if (!card) continue;
      const t = (card.textContent || "").toLowerCase();
      let reason = null;
      if (blocked.some((b) => t.includes(b))) reason = "jobs-block";
      else if (lastHour) {
        const age = ageMinutes(t);
        if (age !== null && age > 60) reason = "jobs-hour";
      }
      if (reason) {
        if (card.dataset.bsReason !== reason) setCard(card, reason);
      } else if (/^jobs-/.test(card.dataset.bsReason || "")) {
        clearCard(card);
      }
    }
  };

  const UI_STYLE = `
#bsj-toggle{margin-left:8px;align-self:center;padding:6px 12px;border:1px solid #0a66c2;border-radius:999px;background:#fff;color:#0a66c2;font:600 14px system-ui,sans-serif;cursor:pointer}
#bsj-panel{position:fixed;top:104px;right:16px;width:300px;max-height:80vh;overflow:auto;z-index:2147483000;background:#fff;color:#1d2226;border:1px solid #d9dce0;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:14px;font:13px system-ui,sans-serif}
#bsj-panel[hidden]{display:none}
.bsj-title{font-weight:600;font-size:14px;margin-bottom:10px}
.bsj-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.bsj-row label{color:#5f6163}
.bsj-row select,.bsj-row input[type=text]{flex:1;max-width:172px;padding:4px 6px;border:1px solid #d9dce0;border-radius:6px;font:inherit;background:#fff;color:inherit}
.bsj-check{display:flex;align-items:center;gap:6px;margin:6px 0}
.bsj-actions{display:flex;gap:8px;margin-top:10px}
.bsj-actions button{flex:1;padding:7px 10px;border-radius:999px;border:0;font:600 13px system-ui,sans-serif;cursor:pointer}
#bsj-apply{background:#0a66c2;color:#fff}
#bsj-clear{background:#eef3f8;color:#0a66c2}
.bsj-status{margin-top:8px;min-height:16px;color:#5f6163;font-size:12px}
.bsj-hint{margin-top:6px;color:#8a8d91;font-size:11px;line-height:1.3}
`;

  const syncPanel = () => {
    const j = jobsState();
    const el = (id) => document.getElementById(id);
    if (!el("bsj-panel")) return;
    el("bsj-date").value = j.date;
    el("bsj-experience").value = j.experience;
    el("bsj-employment").value = j.employment;
    el("bsj-remote").checked = !!j.remote;
    el("bsj-easy").checked = !!j.easy;
    el("bsj-titles").value = j.excludeTitles;
    el("bsj-companies").value = j.excludeCompanies;
  };

  const buildPanel = () => {
    const panel = document.createElement("div");
    panel.id = "bsj-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="bsj-title">Filtros avanzados</div>
      <div class="bsj-row"><label for="bsj-date">Fecha</label>
        <select id="bsj-date"><option value="">Cualquiera</option><option value="1h">Última hora</option><option value="24h">Últimas 24 h</option><option value="week">Última semana</option><option value="month">Último mes</option></select></div>
      <div class="bsj-row"><label for="bsj-experience">Experiencia</label>
        <select id="bsj-experience"><option value="">Cualquiera</option><option value="entry">Inicial</option><option value="senior">Senior</option><option value="manager">Manager</option><option value="director">Director</option><option value="executive">Ejecutivo</option></select></div>
      <div class="bsj-row"><label for="bsj-employment">Tipo de empleo</label>
        <select id="bsj-employment"><option value="">Cualquiera</option><option value="full">Jornada completa</option><option value="part">Media jornada</option><option value="contract">Contrato</option><option value="temporary">Temporal</option><option value="internship">Prácticas</option><option value="volunteer">Voluntariado</option></select></div>
      <label class="bsj-check"><input type="checkbox" id="bsj-remote"> Remoto</label>
      <label class="bsj-check"><input type="checkbox" id="bsj-easy"> Easy Apply</label>
      <div class="bsj-row"><label for="bsj-titles">Excluir títulos</label><input id="bsj-titles" type="text" placeholder="lead, manager"></div>
      <div class="bsj-row"><label for="bsj-companies">Excluir empresas</label><input id="bsj-companies" type="text" placeholder="Consultora X"></div>
      <div class="bsj-actions"><button id="bsj-apply" type="button">Aplicar</button><button id="bsj-clear" type="button">Limpiar</button></div>
      <div class="bsj-status" id="bsj-status"></div>
      <div class="bsj-hint">Aplica los filtros nativos de LinkedIn y oculta las ofertas que contengan tus palabras o empresas excluidas.</div>`;
    panel.addEventListener("click", (e) => e.stopPropagation());
    const status = (t) => { const s = document.getElementById("bsj-status"); if (s) s.textContent = t; };

    panel.querySelector("#bsj-apply").addEventListener("click", async () => {
      const j = {
        date: panel.querySelector("#bsj-date").value,
        experience: panel.querySelector("#bsj-experience").value,
        employment: panel.querySelector("#bsj-employment").value,
        remote: panel.querySelector("#bsj-remote").checked,
        easy: panel.querySelector("#bsj-easy").checked,
        excludeTitles: panel.querySelector("#bsj-titles").value.trim(),
        excludeCompanies: panel.querySelector("#bsj-companies").value.trim(),
      };
      BS.state.jobs = j;
      BS.setStore({ jobs: j });
      status("Aplicando…");
      applyCardFilters();
      const ok = await applyNative();
      applyCardFilters(); // tarjetas nuevas tras aplicar los filtros nativos
      status(ok ? "Listo" : "No encontré la barra de filtros de LinkedIn");
    });

    panel.querySelector("#bsj-clear").addEventListener("click", () => {
      const j = Object.assign({}, JOBS_DEFAULT);
      BS.state.jobs = j;
      BS.setStore({ jobs: j });
      syncPanel();
      applyCardFilters();
      const reset = [...document.querySelectorAll('#JobsSearchFilters a, #JobsSearchFilters [role="button"]')]
        .find((e) => /^(reset|restablecer)$/i.test(norm(e)));
      if (reset) reset.click();
      status("Filtros limpiados");
    });

    return panel;
  };

  const injectJobs = () => {
    if (!onJobs()) {
      for (const id of ["bsj-toggle", "bsj-panel", "bsj-style"]) {
        const el = document.getElementById(id);
        if (el) el.remove();
      }
      return;
    }
    if (!jobsBar()) return;
    if (!document.getElementById("bsj-style")) {
      const style = document.createElement("style");
      style.id = "bsj-style";
      style.textContent = UI_STYLE;
      document.head.appendChild(style);
    }
    let toggle = document.getElementById("bsj-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.id = "bsj-toggle";
      toggle.type = "button";
      toggle.textContent = "Filtros avanzados";
      toggle.addEventListener("click", () => {
        const p = document.getElementById("bsj-panel");
        if (!p) return;
        syncPanel();
        p.hidden = !p.hidden;
      });
    }
    if (!toggle.isConnected) {
      const anchor = document.querySelector('[componentkey="SearchResults_AllFiltersButton"]');
      if (anchor && anchor.parentElement) anchor.after(toggle);
      else jobsBar().appendChild(toggle);
    }
    if (!document.getElementById("bsj-panel")) document.body.appendChild(buildPanel());
  };

  BS.boot(() => {
    route();
    // anti-loop: /feed/network/ es el destino
    const orig = { pushState: history.pushState, replaceState: history.replaceState };
    for (const f of ["pushState", "replaceState"]) {
      history[f] = function (...a) {
        const r = orig[f].apply(this, a);
        setTimeout(route, 30);
        return r;
      };
    }
    addEventListener("popstate", route);
    addEventListener("resize", () => { try { reflowFeed(); } catch {} });
    addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const p = document.getElementById("bsj-panel");
        if (p) p.hidden = true;
      }
    });

    BS.retry(() => { clean(); return true; });
    let timer = null;
    new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; try { clean(); } catch {} }, 400);
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
})();
