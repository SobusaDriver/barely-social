# BarelySocial 1.0 — Release / Publishing Guide

Estado: **1.0 (build 1)**. Extensión empaquetada y Xcode Release compilando
(macOS e iOS). Para subir falta la **firma con tu Team** y el registro de la
app en App Store Connect (requiere tu cuenta); la ficha todavía necesita la
privacy URL pública y las capturas.

Verificado el 2026-11-05:

- `xcodebuild` Release **macOS** e **iOS Simulator** → `BUILD SUCCEEDED` sin
  firma. El `.appex` empaquetado incluye `lib/`, `sites/`, `rules/`, `ads.js`,
  `popup/` e `icons/`.
- `AppIcon.icns` (macOS) y `Assets.car` (iOS) se generan; el set de iconos ya
  no está vacío.
- Reddit con sesión real: el home abre en **Following**, For You no es visible
  y el rail colapsado deja el feed en **1057 px** (viewport 1089).
- Zips regenerados desde `tools/package.sh`; `node tools/check-modules.mjs` OK.

## Artefactos

```bash
./tools/package.sh
```

Genera:

| Archivo | Destino |
|---|---|
| `dist/barely-social-1.0-safari.zip` | fuente de la extensión (converter/Xcode; `background.scripts`) |
| `dist/barely-social-1.0-chrome.zip` | Chrome Web Store (service worker) |

Verificación previa:

```bash
node tools/check-modules.mjs     # estructura + helpers + iconos
```

Xcode Release (sin firma) verificado en macOS e iOS:

```bash
xcodebuild -scheme "BarelySocial (macOS)" -configuration Release \
  -derivedDataPath /tmp/bs-release CODE_SIGNING_ALLOWED=NO build

xcodebuild -scheme "BarelySocial (iOS)" -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/bs-release-ios CODE_SIGNING_ALLOWED=NO build
```

## 1. Safari / TestFlight (macOS + iOS)

1. Abre `BarelySocial/BarelySocial.xcodeproj` en Xcode.
2. **Signing & Capabilities** en los 4 targets:
   - `BarelySocial (macOS)` y `BarelySocial (iOS)` → Team = tu Apple Developer.
   - `BarelySocial Extension (macOS)` y `BarelySocial Extension (iOS)` → mismo
     Team y "Automatically manage signing".
   Bundle IDs actuales: `com.barelysocial.app` y
   `com.barelysocial.app.Extension`. Cámbialos si ya están en uso en tu cuenta.
3. **macOS**: selecciona "Any Mac" → Product → Archive → Distribute App →
   App Store Connect → Upload.
4. **iOS**: selecciona "Any iOS Device (arm64)" → Product → Archive →
   Distribute App → App Store Connect → Upload.
5. En App Store Connect:
   - Crea la app (bundle ID `com.barelysocial.app`, SKU `barelysocial-1`).
   - Privacy: **Data Not Collected**.
   - Internal Testing → añádete como tester → instala vía TestFlight.

La primera subida pide un **privacy policy URL** público. Sube `PRIVACY.md` a
cualquier hosting (GitHub Pages sirve) y pega la URL.

## 2. Chrome Web Store (opcional)

1. Sube `dist/barely-social-1.0-chrome.zip`.
2. Privacy practices: "No data collected"; justifica los permisos:
   - Host permissions (5 dominios): ejecutar los content scripts que ocultan
     feeds/ads.
   - `declarativeNetRequest`: bloquear ads/trackers en esos dominios.
   - `storage`: guardar ajustes localmente.
3. Screenshots 1280×800 (mínimo 1) y descripción.

## 3. Ficha de la tienda (es)

- **Nombre**: BarelySocial
- **Subtítulo**: Redes sin scroll: solo lo que sigues
- **Categoría**: Productividad (o Utilidades)
- **Descripción**:
  > BarelySocial convierte Instagram, YouTube, Reddit, LinkedIn y TikTok en
  > herramientas: fuera Reels, Shorts, For You, Explore y publicidad. Solo ves
  > el contenido de las cuentas que sigues, tus mensajes y la búsqueda.
  > Sin cuentas, sin analytics, sin servidores: todo se ejecuta en tu navegador.
- **Keywords**: redes sociales, productividad, enfoque, sin scroll, adblock
- **Soporte**: `<YOUR-SUPPORT-URL>`
- **Privacidad**: `<YOUR-PRIVACY-URL>`

## 4. Versión siguiente

1. `extension/manifest.json` → `version`.
2. Xcode → `MARKETING_VERSION` (+1 en `CURRENT_PROJECT_VERSION` por subida).
3. `./tools/package.sh` y archivar de nuevo.

## Notas

- El icono se genera con `tools/draw-icon.py` (fuente 1024×1024) y
  `tools/make-icons.py` (iOS sin alfa, macOS squircle, extensión 16–128).
  Cambia colores o la marca en `draw-icon.py` y vuelve a ejecutar ambos.
- **Marca**: un post — avatar coral `#FF5B3D` + tres líneas sobre charcoal
  `#15171C`; solo la primera línea es blanca y las otras se funden en el fondo.
  Se dibuja a 4096 px y se reduce, así que no depende de assets externos.
- **Restricciones del formato**: el icono iOS 1024 se aplana sobre el fondo
  (App Store rechaza alfa); macOS usa squircle con margen y esquinas
  transparentes; la extensión usa las mismas formas en 16/32/48/128. El
  `AppIcon.appiconset/Contents.json` lo reescribe `make-icons.py`.
- Safari usa `background.scripts` (event page); el zip de Chrome ya se genera
  con `background.service_worker`.
- No hay build number compartido entre mac e iOS: App Store Connect exige uno
  distinto por subida en la misma versión.

## Pendiente antes de enviar (checklist)

- [ ] Team de firma en los 4 targets y Archive firmado (macOS + iOS).
- [ ] App Store Connect: app creada, privacy = **Data Not Collected**, build
      subido, testers internos de TestFlight.
- [ ] `PRIVACY.md` publicado en una URL pública y pegada en la ficha.
- [ ] Sustituir `<YOUR-EMAIL>` / `<YOUR-SUPPORT-URL>` / `<YOUR-PRIVACY-URL>`.
- [ ] Screenshots de tienda (1280×800 mínimo para Chrome; sizes de App Store).
- [ ] Gap conocido: el toggle maestro del popup **no** detiene todavía content
      scripts ni reglas DNR (ver RF8 en `REQUIREMENTS.md`). No anunciarlo como
      pausa global hasta arreglarlo.
- [ ] Opcional: subir el zip de Chrome y verificar el service worker.

## Verificación en vivo

La extensión se carga **desempaquetada** desde `extension/`; cada cambio exige
**Reload** manual en `chrome://extensions` (no se puede automatizar por CDP) y
recargar la pestaña. Para confirmar inyección, mira
`document.documentElement.dataset.bsSite` (`instagram`, `youtube`, `reddit`,
`linkedin` o `tiktok`); `window.__BS_SITE` vive en el world aislado y no es
visible desde la página.
