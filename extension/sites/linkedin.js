// BarelySocial — LinkedIn.
// Único cambio conservado: aterrizar en My Network (nada de feed).
(() => {
  "use strict";

  globalThis.__BS.boot(() => {
    // "/feed/network/" TAMBIÉN empieza por "/feed" — excluir el target del
    // redirect o el handler se auto-dispara (lección del loop infinito).
    const IS_TARGET = /^\/feed\/network\/?$/.test(location.pathname);
    const NEEDS = location.pathname === "" || location.pathname === "/" ||
      (location.pathname.startsWith("/feed") && !IS_TARGET);
    if (NEEDS) location.replace("https://www.linkedin.com/feed/network/");
  });
})();
