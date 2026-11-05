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

    BS.retry(() => { clean(); return true; });
    let timer = null;
    new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; try { clean(); } catch {} }, 400);
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
})();
