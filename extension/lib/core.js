// BarelySocial — runtime compartido de los content scripts.
// Un solo dueño del estado y de los helpers; cada web vive en sites/<id>.js
// y solo llama a __BS.boot(). Todo fail-open: nada aquí rompe el sitio.
(() => {
  "use strict";

  const api = globalThis.browser || globalThis.chrome;

  const site = (globalThis.BS_SITES || []).find((s) => location.hostname.includes(s.id));
  if (!site) return;
  window.__BS_SITE = site.id; // marcador de diagnóstico: confirma inyección
  // los content scripts viven en el world aislado; este dataset sí es visible
  // desde la página (verificación en vivo con real-browser-mcp)
  document.documentElement.dataset.bsSite = site.id;

  // claves reservadas por background.js: "sites", "allowance", "following"
  const state = { sites: {}, allowance: {}, following: [], jobs: {} };

  const RETRY_MS = 300;
  const RETRY_WINDOW_MS = 5000;

  function load() {
    if (!api || !api.storage || !api.storage.local) return Promise.resolve();
    return api.storage.local
      .get(["sites", "allowance", "following", "jobs"])
      .then((r) => {
        state.sites = r.sites || {};
        state.allowance = r.allowance || {};
        state.following = r.following || [];
        state.jobs = r.jobs || {};
      })
      .catch(() => {});
  }

  function setStore(obj) {
    if (!api || !api.storage || !api.storage.local) return Promise.resolve();
    return api.storage.local.set(obj).then(() => {
      if (obj.following) state.following = obj.following;
      if (obj.jobs) state.jobs = obj.jobs;
    }).catch(() => {});
  }

  // Ejecuta fn cada RETRY_MS hasta que pred() devuelve true o se agota el tiempo.
  function retry(pred) {
    let n = 0;
    const tick = () => {
      let done = false;
      try { done = !!pred(); } catch {}
      if (!done && n++ < Math.ceil(RETRY_WINDOW_MS / RETRY_MS)) setTimeout(tick, RETRY_MS);
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
  function consumeAllowance(s) {
    try { api.runtime.sendMessage({ type: "consume", site: s }); } catch {}
    const a = allowanceFor(s); // actualización optimista para el UI
    if (a) { a.used = Math.min(a.limit, (a.used || 0) + 1); state.allowance[s] = a; return a; }
    return null;
  }

  // Pestaña/enlace de la propia web que casa con el texto ("Siguiendo").
  function findTab(re) {
    return Array.from(document.querySelectorAll('a[role="link"], [role="tab"], button'))
      .find((el) => re.test((el.textContent || "").trim())) || null;
  }

  function boot(start) {
    load().catch(() => {}).then(() => {
      try { start(); } catch {} // nunca romper el sitio
    });
  }

  globalThis.__BS = {
    site: site.id,
    state,
    setStore,
    retry,
    findTab,
    allowanceFor: () => allowanceFor(site.id),
    consumeAllowance: () => consumeAllowance(site.id),
    boot,
    RETRY_WINDOW_MS,
  };
})();
