// BarelySocial — TikTok.
// Mensajes como superficie de aterrizaje; si no, pestaña "Siguiendo" (nunca
// For You). Los hides de Explore/LIVE/Shop/sugeridos viven en rules/tiktok.css.
(() => {
  "use strict";

  const BS = globalThis.__BS;
  const state = BS.state;

  BS.boot(() => {
    const cfg = state.sites.tiktok || {};
    // onlyDMs → mensajes
    if (cfg.onlyDMs && !location.pathname.startsWith("/messages")) {
      location.replace("/messages");
      return;
    }
    const onForyou =
      location.pathname === "/" || /^\/(foryou)\b/.test(location.pathname);
    if (!onForyou || location.pathname.startsWith("/following")) return;
    // intentar pestaña "Siguiendo"; como último recurso, ruta /following
    let clicked = false;
    BS.retry(() => {
      const tab = BS.findTab(/^(siguiendo|following)$/i);
      if (tab) { tab.click(); clicked = true; return true; }
      return false;
    });
    setTimeout(() => {
      if (!clicked) {
        try { history.replaceState(null, "", "/following"); } catch {}
      }
    }, BS.RETRY_WINDOW_MS);
  });
})();
