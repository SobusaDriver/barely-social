// BarelySocial — Reddit.
// Las superficies de descubrimiento no cargan: se redirigen. Los hides de
// posts promocionados/sugeridos, nav y rail viven en rules/reddit.css.
// Este módulo solo aporta el ancho responsive del feed cuando el rail derecho
// se queda sin contenido útil.
(() => {
  "use strict";

  const BS = globalThis.__BS;
  const DISCOVERY = /^\/(popular|news|explore|latest)\b|^\/r\/(popular|all|news|explore)\b/;

  const hideRailNav = () => {
    for (const div of document.querySelectorAll(".right-sidebar > div")) {
      const t = (div.textContent || "").replace(/\s+/g, " ").trim();
      // lista redundante de navegación: "Home Popular News Explore…"
      if (/^(home|inicio)\s+(popular|populares)\s+(news|noticias)/i.test(t)) {
        if (div.dataset.bsHidden) continue;
        div.style.setProperty("display", "none", "important");
        div.dataset.bsHidden = "1";
        div.dataset.bsReason = "reddit-nav";
      }
    }
  };

  // Home logueado: Reddit abre en "For You" (feed algorítmico). Forzamos la
  // pestaña "Following" (solo comunidades unidas) y no dejamos entrada atrás.
  // ids estables: feed-tab-1 = For You, feed-tab-2 = Following.
  const forceFollowing = () => {
    if (location.pathname !== "/") return;
    const following = document.getElementById("feed-tab-2");
    if (!following) return;
    if (!following.classList.contains("tab-selected")) following.click();
  };

  // El home es un grid `main-container` de 2 columnas (feed | right-sidebar).
  // En el home el rail es 100% descubrimiento/promos (Discover communities,
  // "recently viewed", ads), así que se colapsa siempre y el feed usa todo el
  // ancho. En /r/* y /comments/* el rail tiene Community information (útil):
  // no se toca (ocultarlo descargaría su contenido async y no volvería).
  const reflow = () => {
    const main = document.querySelector("main");
    const grid = main && main.parentElement;
    if (!grid || !grid.classList.contains("main-container") || location.pathname !== "/") {
      document.querySelectorAll(".bs-reddit-wide").forEach((g) => g.classList.remove("bs-reddit-wide"));
      return;
    }
    grid.classList.add("bs-reddit-wide");
  };

  BS.boot(() => {
    const route = () => {
      if (DISCOVERY.test(location.pathname)) location.replace("/");
    };
    route();
    BS.retry(() => { forceFollowing(); reflow(); return true; });
    forceFollowing();

    let timer = null;
    new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        try { route(); forceFollowing(); hideRailNav(); reflow(); } catch {}
      }, 300);
    }).observe(document.documentElement, { childList: true, subtree: true });
    addEventListener("resize", () => { try { hideRailNav(); reflow(); } catch {} });
    hideRailNav();
  });
})();
