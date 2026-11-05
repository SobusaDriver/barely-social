# BarelySocial

> Usa las redes sin caer en el scroll. Proyecto personal, no comercial, sin backend, sin monetización.

## Qué es

Una **extensión de Safari (iOS + macOS)** que limpia Instagram, YouTube, Reddit, LinkedIn y TikTok al estilo SocialLite: elimina lo adictivo, conserva lo social. Nada de apps nativas ni contenedores propios — Safari es el contenedor y la extensión limpia el DOM y bloquea la red.

## Filosofía única

El feed de descubrimiento no se "filtra": **no existe**.

- Reels, Shorts, For You, Explore, livestreams, shopping, ads, sugeridos → bloqueados (core, no opcional).
- DMs, perfiles que visitas a propósito, búsqueda, postear → intactos.
- El feed home siempre es **Siguiendo** (Instagram, TikTok, YouTube, Reddit); en LinkedIn las superficies de feed redirigen a **My Network**, no se dejan en blanco.

Ver requisitos completos en [REQUIREMENTS.md](REQUIREMENTS.md).

## Estado: 1.0

Código y build cerrados; publicación pendiente de la cuenta de Apple.

- Los 5 sitios están implementados y verificados en vivo contra un Chrome con
  sesión real (real-browser-mcp), no con Playwright.
- `xcodebuild` Release compila **macOS e iOS** sin firma (`BUILD SUCCEEDED`).
- Faltan: Team de firma en Xcode, archivo/subida a App Store Connect,
  TestFlight y URL pública de privacidad. Detalle en [RELEASE.md](RELEASE.md).
- `dist/` contiene los zips Safari/Chrome generados por `tools/package.sh`.

## Decisiones de arquitectura

- **Un registro, un runtime, un módulo por sitio.** `lib/sites.js` es la única
  lista de sitios (la consumen content scripts, background y popup);
  `lib/core.js` concentra storage, reintentos y allowance; `sites/<id>.js` solo
  contiene la lógica de esa web. Añadir un sitio no toca los demás.
- **CSS y JS tienen dueños separados.** CSS hace los hides estáticos y limpia
  el primer paint; JS solo lo dinámico (redirects, feeds virtualizados, texto
  que cambia). Una misma superficie nunca se filtra desde ambos lados.
- **Ocultar, nunca eliminar.** Los nodos se marcan con `display:none` +
  `data-bs-hidden`/`data-bs-reason`; borrarlos rompe la reconciliación de
  React (Instagram llegó a comerse posts reales).
- **Fail-open.** Si un selector desaparece, el contenido vuelve a mostrarse;
  la página nunca se rompe. Los cambios se hacen sobre anclas estables
  (`role`, `aria-label`, `href`, texto exacto, custom elements), no sobre
  clases ofuscadas que rotan por deploy.
- **Estado local únicamente** (`browser.storage.local`): `sites`, `allowance`,
  `following`, `jobs`. Sin backend, sin analytics, sin fetch externo.
- **DNR para red y navegación en frío**: ads/trackers y redirects que deben
  ganar la carrera al boot de la SPA (YouTube → suscripciones, LinkedIn →
  My Network). Los redirects de navegación interna (pushState) los cubre JS.
- **Safari primero.** El manifest usa `background.scripts` (event page, lo que
  Safari MV3 soporta). `tools/package.sh` genera además el zip de Chrome con
  `service_worker`; misma fuente, distinto background.

## Plataformas (orden de ataque)

1. Instagram
2. YouTube
3. Reddit
4. LinkedIn
5. TikTok

## Stack

- Safari Web Extension (Xcode template oficial de Apple)
- JS vanilla + CSS por sitio + `declarativeNetRequest` para bloqueo de red
- Sin frameworks, sin servidor, sin login, todo on-device
- Cuenta Apple Developer pagada → TestFlight para dispositivos propios/familia

## Privacidad

Cero backend. Cero analytics. Cero fetch externo. La sesión vive en el browser. Tu atención es tuya. Detalle en [PRIVACY.md](PRIVACY.md).

## Notas por sitio

- [Instagram](instagram-notes.md) — feed Siguiendo, whitelist, fin de feed.
- [YouTube](youtube-notes.md) — suscripciones, Shorts, ads en el player.
- [Reddit](reddit-notes.md) — solo comunidades unidas, rail del home.
- [LinkedIn](linkedin-notes.md) — My Network, jobs, responsive.
- [TikTok](tiktok-notes.md) — mensajes primero, Siguiendo como fallback.

---

Detalles de requisitos y MVP: [REQUIREMENTS.md](REQUIREMENTS.md)
