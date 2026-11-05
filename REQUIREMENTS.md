# BarelySocial — Requisitos (Safari Web Extension)

> Extensión de Safari (iOS + macOS) que limpia Instagram, YouTube, Reddit, LinkedIn y TikTok. No comercial, personal.

## Prioridad de plataformas (orden de ataque)

1. **Instagram** — instagram.com
2. **YouTube** — youtube.com
3. **Reddit** — reddit.com
4. **LinkedIn** — linkedin.com
5. **TikTok** — tiktok.com

Cada plataforma es independiente: si un site se rompe (cambio de HTML), las otras siguen.

---

## Requisitos funcionales

### RF1 — Inyección de reglas por sitio
- La extensión declara `matches` solo para los 5 dominios.
- Selector de qué reglas aplicar según sitio (CSS + JS mínimo).
- Todas las reglas core activas por defecto; un toggle por sitio por si algo se rompe.

### RF2 — Instagram (bloqueo core, paridad SocialLite)
- Ocultar Reels: tab + reels en feed + player de reels (con allowance diario opcional, RF10).
- Ocultar Explore y búsqueda sugerida.
- Ocultar livestreams (badges + viewer).
- Ocultar shopping (product tabs, selección de compras, stickers de compra en stories).
- **Regla de alimentación de feed**: el feed home de instagram.com abre directo en el tab **Siguiendo** (JS: click/redirect a /#following o query de UI); el feed general/For-You (reels sugeridos, explorar recomends) no existe como superficie navegable. Posts mezclados de no-seguidos fuera del tab Siguiendo se ocultan vía CSS.
- Filtrar ads y "Suggested for you".
- Toggles extra (estilo SocialLite, off por defecto): ocultar historias; ocultar feed → "solo DMs" completo; ocultar comentarios; ocultar posts guardados; bloquear cuenta switcher (solo primera cuenta).
- Preservar: feed de gente que sigues, historias, DMs, perfiles, postear desde web.

### RF3 — YouTube (bloqueo core, paridad SocialLite)
- Ocultar Shorts: tab, shorts en home, shorts en sidebar, shorts en canal.
- Vaciar recomendaciones de home (subscripciones y búsqueda siguen).
- Ocultar "up next", end screens y cards al final del video.
- Ocultar livestreams sugeridas; ocultar tab Shopping.
- Video-ads y audio-ads vía red (RF9). Comentarios ocultables (toggle, off por defecto).
- Preservar: suscripciones, búsqueda, watch normal.

### RF4 — Reddit (bloqueo core, paridad SocialLite)
- Ocultar Popular / News / Explore.
- Feed solo de comunidades suscritas (filtrar sugeridas).
- Ocultar ads, sugeridas y "Latest" feed.

### RF5 — LinkedIn (bloqueo core, paridad SocialLite)
- Ocultar home feed por completo (lo que News Feed Eradicator hace).
- Ocultar juegos, secciones promocionadas y "cover stories".
- Preservar: búsqueda de personas, perfiles, mensajes, notificaciones.

### RF6 — TikTok (bloqueo core, paridad SocialLite)
- **Regla de alimentación (default)**: abrir tiktok.com → **feed Siguiendo** (host por defecto); For You nunca existe como tab ni como default de la web.
- Redirect alternativo: "solo mensajes" como toggle (off por defecto): tiktok.com → /messages.
- Ocultar Explore (y opcionalmente búsqueda), cuentas/videos sugeridos, livestreams, tab Shop, sugestión de For You como primer plano.
- Bloqueo de posteo (toggle, off por defecto): ocultar botón de grabar/subir.
- Preservar: mensajería, búsqueda y perfiles visitados a propósito.

### RF7 — Guardrail anti-scroll (cross-site, opcional)
- Ligeramente distinto de SocialLite: en Instagram y TikTok (scroll decks), cuando el foco entra al player largo, mostrar un aviso inline "¿sigues?" y cortar tras X videos por sesión, configurable.
- MVP: solo aviso; auto-corte para v2.

### RF8 — Toggle rápido por sitio
- Botón en la toolbar de Safari: pausa/reanuda reglas del sitio actual (para debugging o cuando algo deje de funcionar).
- Estado persistido por dominio en default storage (local, sin servidor).

---

### RF9 — Bloqueo de ads "todas las maneras posibles" (core, no opcional)
Tres capas, en orden de profundidad:
1. **DOM (CSS)**: ocultar contenedores de ads y patrocinados (la capa base de las reglas por sitio).
2. ** Red (DeclarativeNetRequest)**: bloquear requests a dominios conocidos de ads/tracking de cada plataforma (ad-creatives, ad servers, analytics de los 5 sitios). Safari Web Extension soporta `declarativeNetRequest` — mismo modelo de reglas de uBlock. watermark: bloquear request a nivel de red evita que el ad cargue y que el DOM entre en loop de retry.
3. **Listas mantenidas**: consumir como referencia Listas públicas de filtros para ads de redes sociales (p. ej. listas de Annoyance/ads de uBlock que cubren instagram.com, youtube.com, reddit.com, linkedin.com, tiktok.com) — se adaptan, no se escriben desde cero.
- Meta: verificar que en una sesión normal en cada sitio no aparezca ningún ad ni post sugerido visible (comprobación manual por sitio tras cada cambio de selectores).
- Nota honesta: video-ads de YouTube (las que se ponen DENTRO del player) pueden bloquearse vía red (anuncios a dominio de googleads) — es más frágil pero se intenta; si falla, el ad dura más pero el scroll sigue controlado.

### RF10 — Experiencia estilo SocialLite (app-like)
- **Auto-redirect a la versión útil**: abrir instagram.com → directo a DMs o feed (configurable, default DMs); abrir tiktok.com → /messages; abrir linkedin.com → no-feed home.
- **Modo staging**: HIDE UI no esencial/atención: suggestions row de Instagram OCULTA, "up next" tapado, etc. El webview de SocialLite se siente "app" porque le pone skins; nuestra aproximación equivalente en Safari es: UI propia mínima =
  - popup de toolbar como panel de control (switches por sitio, allowance del día)
  - una "pantalla shield" inyectada cuando el usuario intenta abrir una superficie bloqueada (tap en Reels → overlay "Modo BarelySocial: bloqueado. Vuelve al feed/de DMs") — equivalente al shield screen de SocialLite.
- **Delay opcional**: 2–3 segundos en abrir una superficie bloqueada antes de redirigir (el "guardo" anti-autopilot de SocialLite). Off por defecto.
- **Allowance diario** (cross-sitio simple): contador por sitio +ej: "3 reels hoy" — al agotarse, el bloqueo es total hasta mañana. Persistido en `storage` local.

---

## Requisitos no funcionales

- **RNF1 — cero backend**: sin login, sin analytics, sin fetch externo. Todo on-device.
- **RNF2 — solo CSS-first**: cada regla es primero CSS (barato, silencioso); JS solo para lo que CSS no alcanza (redirects, guardrail, cuando el elemento carga dinámicamente).
- **RNF3 — fragilidad contenida**: selectores de cada sitio aislados en un archivo independiente. Si un sitio cambia su HTML, la extensión seguirá funcionando en los otros 4 (fail-open: si el selector no matchea, no rompe nada).
- **RNF4 — performance**: inyección en `document_start` para elementos core (evitar flash de contenido), CSS inyectado antes que JS.
- **RNF5 — liviana**: sin frameworks, JS vanilla, < 50 KB empaquetado.
- **RNF6 — privada por diseño**: ningún permiso extra; solo `host_permissions` sobre los 5 dominios + `storage`.
- **RNF7 — mantenibilidad > features**: un sitio roto se arregla actualizando selectores/filtros, no agregando código.

---

## Opciones propuestas — no reinventar la rueda

### F1 — Element-hiding estilo uBlock (apuesta principal de CSS)
- Usar el modelo de uBlock Origin para "cosmetic filtering": reglas declarativas de hide-by-selector, que es la técnica estándar y probada (uBO lleva >10 años haciéndolo).
- Reutilizar la idea de **syntax `##` selector** en archivos de reglas; no reescribir el motor.
- Docs de referencia: uBlock Static Filter Syntax + `DeclarativeNetRequest` no aplica per se (es para requests, no DOM), así que CSS + `MutationObserver` mínimo.

### F2 — Rompe-work para YouTube ads de video (si fuese necesario)
- No intentarlos con CSS. Opciones existentes:
  - Recomendación: **no bloquear video-ads via la extensión** para el MVP (fuera de scope del producto: lo adictivo no es el ad, es el scroll).
  - Fallback documentado: pointer al `SponsorBlock`/`uBlock` existentes para quien quiera ese nivel.

### F3 — Empaquetado / entorno
- **Xcode + Safari Web Extension template** (oficial de Apple) — el camino estándar, auto-genera el app contenedor de la extensión.
- **Cuenta de Apple Developer pagada**: se puede firmar y auto-distribuir:
  - TestFlight para dispositivos propios/familia (path mínimo con cuenta pagada), o
  - publicar en App Store (gratuita, sin monetización) si algún día se quiere compartir — el review de Safari extensions es estándar.
- Sin costo marginal: la cuenta ya está pagada.

### F3b — Permisos que la fase RF9 añade
- `declarativeNetRequest` (permiso de bloqueo de red) + `host_permissions` de los 5 dominios ya lo cubren para red+DOM.
- Sin permisos extra: no proxies, no VPN, no servidores.

### F4 — Patrones de lo que ya probó el mercado
- **News Feed Eradicator** (ext con buena fama): patrón para LinkedIn — reemplazar feed por un quote/blank. Copiar el approach, no el código.
- **Unhook** (YouTube): su lista de features es el blueprint de RF3.
- **Distill / Minimize Instagram** (Chrome): inspiración para RF2 (los selectores de instagram.com están bien documentados en issues públicos de esas ext).
- **Reddit enhancement / uBO lists**: listas de selectores de reddit.com ya mantenidas por la comunidad — cargar y adaptar.
- **TikTok → mensajes**: patrón "redirect on load" usando `web_navigation`-like API de la extensión (en Safari: `browser.webNavigation.onCompleted` o simplemente JS en `document_start`).

### F5 — Distribution y updates
- Uso personal: repositorio local + Safari Developer Mode. Sin App Store review.
- Si algún día se quiere compartir: Xcode Cloud o GitHub releases + instrucciones de firma. Fuera de scope.

---

## MVP mínimo (una tarde + iteración de ads)

1. Scaffold con Xcode template de Safari Web Extension (cuenta dev ya contratada).
2. Archivos de reglas: `instagram.css`, `youtube.css`, `reddit.css`, `linkedin.css`, `tiktok.css` + reglas `declarativeNetRequest` por sitio para red.
3. Sal de listas públicas de filtros (uBlock ads/annoyance por sitio) adaptadas como punto de partida para los dos niveles.
4. `sites/<id>.js` (uno por web): redirects (TikTok→/messages, IG→DMs opcional), overlay shield en surfaces bloqueadas, contador de allowance.
5. Popup de toolbar: 5 switches por sitio + allowance del día + toggle delay.
6. Test manual por sitio: sin ads visibles, surfaces core funcionando; anotar selectores que se rompen con fecha.

Fuera de scope del primer release: RF7 (guardrail de sesión), allowance granular por superfice (solo contador por sitio), sitios nuevos.
