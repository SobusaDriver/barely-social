# Plan: BarelySocial — Safari Web Extension

## Regla de entorno de pruebas (fijada por el usuario)

> **Playwright/automatización de Chromium es SIEMPRE el ÚLTIMO recurso.**
> Primero: pruebas manuales por el usuario en **Chrome real** (cuenta dev ya
> paga) inspeccionado vía **real-browser-mcp** (Extensión real-browser-mcp
> conectada por Native Messaging a su propio Chrome, tab con acceso a su
> sesión). Solo si real-browser-mcp no puede (caso extremo), Playwright.

## Tech (única decisión técnica razonable)
- **Safari Web Extension, Manifest V3** (Safari soporta `declarativeNetRequest` y MV3 desde 15.4+; en Safari MV3 usa event page, no service worker).
- Generación del proyecto Xcode: `xcrun safari-web-extension-converter` sobre una extensión web vanilla (camino estándar de Apple, sin tocar el proyecto a mano).
- Vanilla JS + CSS + JSON estáticos.

## Estructura
```
extension/            # fuente web-extension (indep de Xcode)
  manifest.json       # MV3, matches de los 5 dominios
  rules/instagram.css youtube.css reddit.css linkedin.css tiktok.css
  rules/dnr.json      # static ruleset: ads/tracking por dominio
  lib/sites.js        # registro único de sitios (content/background/popup)
  lib/core.js         # estado, retry, allowance, findTab, boot
  sites/<id>.js       # una web por módulo: overlays + redirecciones
  background.js       # event page: estado por sitio, contador diario
  popup/popup.html|js # panel por sitio
barely-social/        # proyecto Xcode que produce el converter
```

## Contenidos
1. **manifest**: `content_scripts` con `matches` por sitio, css por sitio, `document_start`; `declarative_net_request` con static ruleset; popup; host permissions exactos (5 dominios + subdominios www); storage.
2. **dnr.json**: bloques de dominios de ads/tracking por plataforma (googleads, doubleclick, adcreative, analytics, ads de reddit/linkedin/meta IG, tiktok ad pixel).
3. **css por sitio**: ocultar elementos — core surfaces + ads + recomendados; variables state-consistent; placeholders documentados donde el shortcode exacto depende del live DOM con fecha de verificación.
4. **sites/<id>.js + lib/core.js**: un módulo por web; forzar vista "Siguiendo" (redirect/hash/click), redirecciones F4, interceptor del elemento bloqueado (overlay), contador allowance con storage local (con day-rollover), fail-open en detectores.
5. **background.js**: maneja toggles-on/off por sitio para timelines de reglas CSS (Runtime DNR toggles rápidos), counters, day rollover.
6. **popup**: switches on/off (storage → background), allowance interactivo.
7. **Xcode**: converter → proyecto generatizado; firmar con equipo Developer; targets macOS + iOS; scheme build scripts unificados con éxito.

## Riesgos
- Selectores de HTML de terceros cambian → archivos con fecha + toggle off por sitio (fail-open).
- youtube video-ads por red frágiles → se registran dominios y se mantienen; si fallan, sigue la capa CSS/DOM.
- Converter requiere Xcode 14.2+; macOS disponible en el host.

## Verificación
- `xcodebuild build` de ambas targets sin errores.
- Cargar en Safari (Developer → Allow unsigned) y patrón manual por sitio.
- Revisar reglas de red con Web Inspector (0 ads requests).
