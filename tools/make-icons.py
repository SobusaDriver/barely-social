#!/usr/bin/env python3
"""Genera todos los iconos desde un PNG cuadrado (idealmente 1024x1024).

    python3 tools/make-icons.py <fuente.png> [--preview <dir>]

- iOS 1024: cuadrado completo, sin alfa (App Store lo exige).
- macOS: squircle con margen y esquinas transparentes, todas las tallas.
- Extensión: 16/32/48/128 (squircle, alfa).
- Reescribe AppIcon.appiconset/Contents.json.
"""
import json
import os
import sys
from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/barelysocial-icon-src.png"
PREVIEW = None
if "--preview" in sys.argv:
    PREVIEW = sys.argv[sys.argv.index("--preview") + 1]

EXT = "extension/icons"
APP = "BarelySocial/Shared (App)/Assets.xcassets/AppIcon.appiconset"


def square(im):
    im = im.convert("RGBA")
    side = min(im.size)
    left = (im.width - side) // 2
    top = (im.height - side) // 2
    return im.crop((left, top, left + side, top + side))


def squircle(im, size, radius=0.225, margin=0.06):
    """Icono macOS: fuente recortada en squircle con margen transparente."""
    inner = max(1, round(size * (1 - 2 * margin)))
    off = (size - inner) // 2
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img = im.resize((inner, inner), Image.LANCZOS)
    mask = Image.new("L", (inner, inner), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, inner - 1, inner - 1], radius=round(inner * radius), fill=255
    )
    canvas.paste(img, (off, off), mask)
    return canvas


def out(path):
    if PREVIEW:
        path = os.path.join(PREVIEW, os.path.basename(path))
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    return path


src = square(Image.open(SRC))

# --- extensión ---
for s in (16, 32, 48, 128):
    squircle(src, s, margin=0.04).save(out(f"{EXT}/icon-{s}.png"))

# --- app ---
mac = {
    "icon_16.png": 16, "icon_16@2x.png": 32,
    "icon_32.png": 32, "icon_32@2x.png": 64,
    "icon_128.png": 128, "icon_128@2x.png": 256,
    "icon_256.png": 256, "icon_256@2x.png": 512,
    "icon_512.png": 512, "icon_512@2x.png": 1024,
}
for name, px in mac.items():
    squircle(src, px).save(out(f"{APP}/{name}"))

# iOS: cuadrado completo, aplanado (sin canal alfa)
ios = src.resize((1024, 1024), Image.LANCZOS)
flat = Image.new("RGB", ios.size, (21, 23, 28))
flat.paste(ios, mask=ios.split()[-1])
flat.save(out(f"{APP}/icon_ios_1024.png"))

contents = {
    "images": [
        {"filename": "icon_ios_1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"},
        {"appearances": [{"appearance": "luminosity", "value": "dark"}], "filename": "icon_ios_1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"},
        {"appearances": [{"appearance": "luminosity", "value": "tinted"}], "filename": "icon_ios_1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"},
        {"filename": "icon_16.png", "idiom": "mac", "scale": "1x", "size": "16x16"},
        {"filename": "icon_16@2x.png", "idiom": "mac", "scale": "2x", "size": "16x16"},
        {"filename": "icon_32.png", "idiom": "mac", "scale": "1x", "size": "32x32"},
        {"filename": "icon_32@2x.png", "idiom": "mac", "scale": "2x", "size": "32x32"},
        {"filename": "icon_128.png", "idiom": "mac", "scale": "1x", "size": "128x128"},
        {"filename": "icon_128@2x.png", "idiom": "mac", "scale": "2x", "size": "128x128"},
        {"filename": "icon_256.png", "idiom": "mac", "scale": "1x", "size": "256x256"},
        {"filename": "icon_256@2x.png", "idiom": "mac", "scale": "2x", "size": "256x256"},
        {"filename": "icon_512.png", "idiom": "mac", "scale": "1x", "size": "512x512"},
        {"filename": "icon_512@2x.png", "idiom": "mac", "scale": "2x", "size": "512x512"},
    ],
    "info": {"author": "xcode", "version": 1},
}
if not PREVIEW:
    with open(f"{APP}/Contents.json", "w") as f:
        f.write(json.dumps(contents, indent=2) + "\n")

print("icons listos" + (f" en {PREVIEW}" if PREVIEW else ""))
