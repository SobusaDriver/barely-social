#!/usr/bin/env bash
# Empaqueta la extensión para publicar.
#   ./tools/package.sh
# Genera en dist/:
#   barely-social-<version>-safari.zip  → fuente para el converter/Xcode (background.scripts)
#   barely-social-<version>-chrome.zip  → Chrome Web Store (service worker)
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
OUT="dist"
rm -rf "$OUT"
mkdir -p "$OUT"

# Safari (event page) / fuente
(cd extension && zip -qr "../$OUT/barely-social-${VERSION}-safari.zip" . \
  -x "_metadata/*" -x "*.DS_Store" -x "*.map")

# Chrome MV3: service worker obligatorio
cp -R extension "$OUT/chrome"
rm -rf "$OUT/chrome/_metadata"
cat > "$OUT/chrome/background-sw.js" <<'EOF'
// Chrome MV3 exige service worker. Safari usa background.scripts (event page).
importScripts("lib/sites.js", "background.js");
EOF
python3 - "$OUT/chrome/manifest.json" <<'PY'
import json, sys
p = sys.argv[1]
m = json.load(open(p))
m["background"] = {"service_worker": "background-sw.js"}
open(p, "w").write(json.dumps(m, indent=2, ensure_ascii=False) + "\n")
PY
(cd "$OUT/chrome" && zip -qr "../barely-social-${VERSION}-chrome.zip" . -x "*.DS_Store")
rm -rf "$OUT/chrome"

echo "→ dist/barely-social-${VERSION}-safari.zip"
echo "→ dist/barely-social-${VERSION}-chrome.zip"
shasum -a 256 "$OUT"/*.zip
