// BarelySocial — Reddit.
// Las superficies de descubrimiento no cargan: se redirigen. Los hides de
// posts promocionados/sugeridos y de las pestañas viven en rules/reddit.css.
(() => {
  "use strict";

  globalThis.__BS.boot(() => {
    if (/^\/(popular|news|explore)\b/.test(location.pathname)) location.replace("/");
  });
})();
